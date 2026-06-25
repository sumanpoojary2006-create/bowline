import Booking from '../models/Booking.js';
import Listing from '../models/Listing.js';
import AppSetting from '../models/AppSetting.js';
import { calculateBookingPrice } from './pricing.js';
import { parseIcsEvents } from './ical.js';
import { getExistingBookingsForRange } from './availability.js';
import { isSheetsConfigured, writeBookingToSheet, writeFullBookingToSheet, clearBookingFromSheet } from './googleSheets.js';

// Dormitory is inactive (not bookable standalone) but is still part of the
// Full House bundle — keep this in sync with listingController.js.
const BUNDLE_ALWAYS_INCLUDE_SLUGS = ['dormitory-open-loft'];

export const FULL_HOUSE_SETTING_KEY = 'airbnb_full_house_ical_url';

// Pulls a listing's Airbnb "export calendar" iCal feed and mirrors its busy
// dates into our Booking collection as source:'airbnb' bookings, so the
// website's availability check blocks rooms Airbnb has already sold.
// Also cancels any previously-synced Airbnb bookings whose dates no longer
// appear in the feed (i.e. the Airbnb reservation was cancelled/changed).
export const syncListingFromAirbnb = async (listing) => {
  const result = { listing: listing.name, created: 0, updated: 0, cancelled: 0, errors: [] };

  if (!listing.airbnbIcalUrl) return result;

  let text;
  try {
    const res = await fetch(listing.airbnbIcalUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    text = await res.text();
  } catch (err) {
    result.errors.push(`Failed to fetch calendar: ${err.message}`);
    return result;
  }

  const events = parseIcsEvents(text);

  const existingAirbnbBookings = await Booking.find({
    listing: listing._id,
    source: 'airbnb',
    status: { $ne: 'cancelled' },
  });

  for (const event of events) {
    const existing = existingAirbnbBookings.find((b) => b.externalId === event.uid);

    if (existing) {
      if (
        existing.startDate.getTime() !== event.start.getTime() ||
        existing.endDate.getTime() !== event.end.getTime()
      ) {
        existing.startDate = event.start;
        existing.endDate = event.end;
        await existing.save();
        result.updated++;
      }
      continue;
    }

    const pricing = await calculateBookingPrice({
      listing,
      bookingType: 'room',
      startDate: event.start,
      endDate: event.end,
      guests: 1,
    });

    await Booking.create({
      bookingType: 'room',
      listing: listing._id,
      user: null,
      startDate: event.start,
      endDate: event.end,
      guests: 1,
      unitPrice: pricing.unitPrice,
      totalPrice: pricing.totalPrice,
      pricingBreakdown: { basePrice: pricing.basePrice, adjustments: pricing.adjustments },
      status: 'confirmed',
      paymentStatus: 'paid',
      paymentMethod: 'airbnb',
      contactName: 'Airbnb Guest',
      contactEmail: 'airbnb-sync@bowline.internal',
      contactPhone: '',
      specialRequests: 'Synced from Airbnb',
      source: 'airbnb',
      externalId: event.uid,
    });
    result.created++;
  }

  // Cancel bookings that disappeared from the Airbnb feed
  const feedUids = new Set(events.map((e) => e.uid));
  for (const booking of existingAirbnbBookings) {
    if (!feedUids.has(booking.externalId)) {
      booking.status = 'cancelled';
      await booking.save();
      result.cancelled++;
    }
  }

  if (isSheetsConfigured() && (result.created || result.updated || result.cancelled)) {
    const populated = await Booking.find({ listing: listing._id, source: 'airbnb' })
      .populate('listing')
      .populate('user', 'name email');
    for (const booking of populated) {
      if (booking.status === 'cancelled') {
        await clearBookingFromSheet(booking).catch(() => {});
      } else {
        await writeBookingToSheet(booking).catch(() => {});
      }
      await writeFullBookingToSheet(booking).catch(() => {});
    }
  }

  return result;
};

// Airbnb sells the whole property as its own separate listing ("Full House")
// with its own iCal feed, distinct from the per-room feeds above. In practice
// that feed mostly just mirrors whichever individual rooms are already
// booked (same event UID, sometimes with a merged/extended date range), but
// a guest can also book ONLY the Full House listing — that stay won't appear
// in any single room's own feed at all. So instead of trusting per-room
// mirroring, we fill the gap from our own DB: for every Full House event, any
// room that doesn't already have an overlapping booking (from its own feed,
// admin entry, etc.) gets one created here, source-tagged so it can be
// tracked/cancelled independently of the per-room sync.
export const syncFullHouseFromAirbnb = async () => {
  const result = { listing: 'Full House', created: 0, updated: 0, cancelled: 0, errors: [] };

  const setting = await AppSetting.findOne({ key: FULL_HOUSE_SETTING_KEY });
  const icalUrl = (setting?.value || '').trim();
  if (!icalUrl) return result;

  let text;
  try {
    const res = await fetch(icalUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    text = await res.text();
  } catch (err) {
    result.errors.push(`Failed to fetch Full House calendar: ${err.message}`);
    return result;
  }

  const events = parseIcsEvents(text);

  const rooms = await Listing.find({
    type: 'room',
    $or: [{ active: true }, { slug: { $in: BUNDLE_ALWAYS_INCLUDE_SLUGS } }],
  });

  const existingFullHouseBookings = await Booking.find({
    source: 'airbnb',
    status: { $ne: 'cancelled' },
    externalId: { $regex: '^fullhouse:' },
  });

  const handledExternalIds = new Set();

  for (const event of events) {
    for (const room of rooms) {
      const fhExternalId = `fullhouse:${event.uid}:${room._id}`;
      handledExternalIds.add(fhExternalId);

      const existing = existingFullHouseBookings.find((b) => b.externalId === fhExternalId);
      if (existing) {
        if (
          existing.startDate.getTime() !== event.start.getTime() ||
          existing.endDate.getTime() !== event.end.getTime()
        ) {
          existing.startDate = event.start;
          existing.endDate = event.end;
          await existing.save();
          result.updated++;
        }
        continue;
      }

      // Already blocked independently (own feed, manual booking, etc.) — no gap to fill.
      const overlapping = await getExistingBookingsForRange({
        listingId: room._id,
        startDate: event.start,
        endDate: event.end,
        statuses: ['pending', 'confirmed'],
      });
      if (overlapping.length) continue;

      const pricing = await calculateBookingPrice({
        listing: room,
        bookingType: 'room',
        startDate: event.start,
        endDate: event.end,
        guests: 1,
      });

      await Booking.create({
        bookingType: 'room',
        listing: room._id,
        user: null,
        startDate: event.start,
        endDate: event.end,
        guests: 1,
        unitPrice: pricing.unitPrice,
        totalPrice: pricing.totalPrice,
        pricingBreakdown: { basePrice: pricing.basePrice, adjustments: pricing.adjustments },
        status: 'confirmed',
        paymentStatus: 'paid',
        paymentMethod: 'airbnb',
        contactName: 'Airbnb Guest (Full House)',
        contactEmail: 'airbnb-sync@bowline.internal',
        contactPhone: '',
        specialRequests: 'Synced from Airbnb Full House calendar',
        source: 'airbnb',
        externalId: fhExternalId,
      });
      result.created++;
    }
  }

  // Cancel Full House gap-fill bookings whose event disappeared from the feed
  for (const booking of existingFullHouseBookings) {
    if (!handledExternalIds.has(booking.externalId)) {
      booking.status = 'cancelled';
      await booking.save();
      result.cancelled++;
    }
  }

  if (isSheetsConfigured() && (result.created || result.updated || result.cancelled)) {
    const populated = await Booking.find({ source: 'airbnb', externalId: { $regex: '^fullhouse:' } })
      .populate('listing')
      .populate('user', 'name email');
    for (const booking of populated) {
      if (booking.status === 'cancelled') {
        await clearBookingFromSheet(booking).catch(() => {});
      } else {
        await writeBookingToSheet(booking).catch(() => {});
      }
      await writeFullBookingToSheet(booking).catch(() => {});
    }
  }

  return result;
};

export const syncAllAirbnbCalendars = async () => {
  const listings = await Listing.find({
    type: 'room',
    active: true,
    airbnbIcalUrl: { $ne: '' },
  });

  const results = [];
  for (const listing of listings) {
    results.push(await syncListingFromAirbnb(listing));
  }
  results.push(await syncFullHouseFromAirbnb());
  return results;
};
