import Booking from '../models/Booking.js';
import Listing from '../models/Listing.js';
import { calculateBookingPrice } from './pricing.js';
import { parseIcsEvents } from './ical.js';
import { isSheetsConfigured, writeFullBookingToSheet, clearBookingFromSheet } from './googleSheets.js';

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
  return results;
};
