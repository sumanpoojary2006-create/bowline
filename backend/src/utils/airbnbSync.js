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
        const oldStartDate = existing.startDate;
        const oldEndDate = existing.endDate;
        existing.startDate = event.start;
        existing.endDate = event.end;
        await existing.save();
        result.updated++;

        // The old date range is now stale in the calendar tab — clear it so a
        // postponed/moved Airbnb reservation doesn't leave a phantom booking
        // behind on its original dates.
        if (isSheetsConfigured()) {
          await clearBookingFromSheet({ listing, startDate: oldStartDate, endDate: oldEndDate }).catch(() => {});
        }
      }
      continue;
    }

    const pricing = await calculateBookingPrice({
      listing,
      bookingType: 'room',
      startDate: event.start,
      endDate: event.end,
      guests: 1,
      applyGst: false,
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

// Generic placeholders that don't count as evidence of a real guest — seeing
// the same one of these across several rooms means nothing (it's just our
// own default text), unlike a real name repeated across rooms.
const GENERIC_CONTACT_NAMES = new Set([
  '', 'airbnb guest', 'offline booking', 'offline block', 'test', 'bowline admin',
]);

const isGenericContactName = (name) => {
  const normalized = String(name || '').trim().toLowerCase();
  return !normalized || GENERIC_CONTACT_NAMES.has(normalized) || normalized.startsWith('airbnb guest');
};

const FULLHOUSE_EXTERNAL_ID_RE = /^fullhouse:(.+):([0-9a-fA-F]{24})$/;

// Airbnb sells the whole property as its own separate listing ("Full House")
// with its own iCal feed, distinct from the per-room feeds above. Its "Not
// available" blocks are an UNRELIABLE signal though — they fire just as
// often because several rooms happen to be independently booked by
// different guests at once (so the bundle can't be sold as a whole) as they
// do for an actual full-house sale. Blindly blocking every room for every
// such date risks blocking rooms nobody actually booked.
//
// So instead of trusting the feed directly, we only act when our own DB
// already shows two-or-more rooms independently booked under the SAME real
// guest name for those dates (e.g. a guest recorded as "Nithin" on 3 of 5
// rooms) — that's strong evidence of one real full-house guest, and we fill
// in the remaining unbooked rooms under that same name. If no such name
// match exists, we leave it alone and flag it for manual review instead of
// guessing.
export const syncFullHouseFromAirbnb = async () => {
  const result = { listing: 'Full House', created: 0, updated: 0, cancelled: 0, needsReview: [], errors: [] };

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
  const feedUids = new Set(events.map((e) => e.uid));

  const rooms = await Listing.find({
    type: 'room',
    $or: [{ active: true }, { slug: { $in: BUNDLE_ALWAYS_INCLUDE_SLUGS } }],
  });

  const existingFullHouseBookings = await Booking.find({
    source: 'airbnb',
    status: { $ne: 'cancelled' },
    externalId: { $regex: '^fullhouse:' },
  });

  for (const event of events) {
    // A multi-night "not available" block can be fully booked out for
    // entirely different reasons on different nights (e.g. one guest for
    // night 1, several unrelated single-room guests for night 2). Evaluate
    // name evidence per night rather than once for the whole event, so a
    // guest whose real booking only covers part of the block doesn't get
    // extrapolated onto nights they were never part of.
    const nights = [];
    for (const d = new Date(event.start); d < event.end; d.setDate(d.getDate() + 1)) {
      nights.push(new Date(d));
    }

    const nightlyInfo = await Promise.all(
      nights.map(async (night) => {
        const nightEnd = new Date(night);
        nightEnd.setDate(nightEnd.getDate() + 1);

        const nameRoomCounts = new Map();
        for (const room of rooms) {
          const bookings = await getExistingBookingsForRange({
            listingId: room._id,
            startDate: night,
            endDate: nightEnd,
            statuses: ['pending', 'confirmed'],
          }).then((list) => list.filter((b) => !String(b.externalId || '').startsWith('fullhouse:')));

          const namesInThisRoom = new Set(
            bookings.map((b) => String(b.contactName || '').trim()).filter((n) => !isGenericContactName(n))
          );
          for (const name of namesInThisRoom) {
            const key = name.toLowerCase();
            const entry = nameRoomCounts.get(key) || { name, rooms: 0 };
            entry.rooms += 1;
            nameRoomCounts.set(key, entry);
          }
        }

        const best = [...nameRoomCounts.values()].sort((a, b) => b.rooms - a.rooms)[0];
        return { night, guestName: best && best.rooms >= 2 ? best.name : null };
      })
    );

    for (const { night, guestName } of nightlyInfo) {
      if (guestName) continue;
      const nightEnd = new Date(night);
      nightEnd.setDate(nightEnd.getDate() + 1);
      result.needsReview.push({
        startDate: night.toISOString().slice(0, 10),
        endDate: nightEnd.toISOString().slice(0, 10),
      });
    }

    // Group consecutive nights confirmed under the same guest name into one
    // span per room, matching how guests actually book — a run that stops
    // early (or was never confirmed to begin with) doesn't drag other rooms
    // in beyond the nights that run actually covers.
    let i = 0;
    while (i < nightlyInfo.length) {
      if (!nightlyInfo[i].guestName) { i++; continue; }
      const guestName = nightlyInfo[i].guestName;
      let j = i;
      while (j + 1 < nightlyInfo.length && nightlyInfo[j + 1].guestName === guestName) j++;

      const spanStart = nightlyInfo[i].night;
      const spanEnd = new Date(nightlyInfo[j].night);
      spanEnd.setDate(spanEnd.getDate() + 1);

      for (const room of rooms) {
        const fhExternalId = `fullhouse:${event.uid}:${room._id}`;
        const existing = existingFullHouseBookings.find((b) => b.externalId === fhExternalId);

        if (existing) {
          if (
            existing.startDate.getTime() !== spanStart.getTime() ||
            existing.endDate.getTime() !== spanEnd.getTime()
          ) {
            const oldStartDate = existing.startDate;
            const oldEndDate = existing.endDate;
            existing.startDate = spanStart;
            existing.endDate = spanEnd;
            await existing.save();
            result.updated++;

            if (isSheetsConfigured()) {
              await clearBookingFromSheet({ listing: room, startDate: oldStartDate, endDate: oldEndDate }).catch(() => {});
            }
          }
          continue;
        }

        const roomBookings = await getExistingBookingsForRange({
          listingId: room._id,
          startDate: spanStart,
          endDate: spanEnd,
          statuses: ['pending', 'confirmed'],
        }).then((list) => list.filter((b) => !String(b.externalId || '').startsWith('fullhouse:')));

        if (roomBookings.length) continue; // already independently covered

        const pricing = await calculateBookingPrice({
          listing: room,
          bookingType: 'room',
          startDate: spanStart,
          endDate: spanEnd,
          guests: 1,
          applyGst: false,
        });

        await Booking.create({
          bookingType: 'room',
          listing: room._id,
          user: null,
          startDate: spanStart,
          endDate: spanEnd,
          guests: 1,
          unitPrice: pricing.unitPrice,
          totalPrice: pricing.totalPrice,
          pricingBreakdown: { basePrice: pricing.basePrice, adjustments: pricing.adjustments },
          status: 'confirmed',
          paymentStatus: 'paid',
          paymentMethod: 'airbnb',
          contactName: guestName,
          contactEmail: 'airbnb-sync@bowline.internal',
          contactPhone: '',
          specialRequests: 'Synced from Airbnb Full House calendar',
          source: 'airbnb',
          externalId: fhExternalId,
        });
        result.created++;
      }

      i = j + 1;
    }
  }

  // Cancel gap-fill bookings whose event disappeared from the feed entirely
  for (const booking of existingFullHouseBookings) {
    const match = booking.externalId.match(FULLHOUSE_EXTERNAL_ID_RE);
    const uid = match?.[1];
    if (!uid || !feedUids.has(uid)) {
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
