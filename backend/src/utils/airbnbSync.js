import Booking from '../models/Booking.js';
import Listing from '../models/Listing.js';
import AppSetting from '../models/AppSetting.js';
import { calculateBookingPrice } from './pricing.js';
import { parseIcsEvents } from './ical.js';
import { getExistingBookingsForRange } from './availability.js';
import { isSheetsConfigured, writeFullBookingToSheet, refreshSheetRange } from './googleSheets.js';

// Dormitory is inactive (not bookable standalone) but is still part of the
// Full House bundle — keep this in sync with listingController.js.
const BUNDLE_ALWAYS_INCLUDE_SLUGS = ['dormitory-open-loft'];

export const FULL_HOUSE_SETTING_KEY = 'airbnb_full_house_ical_url';

const DAY_MS = 24 * 60 * 60 * 1000;

// Airbnb marks real reservations "Reserved". Everything else in the feed
// ("Airbnb (Not available)") is a date Airbnb considers unbookable — which
// includes every date it imported from our own published iCal feed.
const isBlockEvent = (event) => !/reserved/i.test(event.summary || '');

const mergeRanges = (ranges) => {
  const merged = [];
  for (const range of [...ranges].sort((a, b) => a.start - b.start)) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) {
      if (range.end > last.end) last.end = new Date(range.end);
    } else {
      merged.push({ start: new Date(range.start), end: new Date(range.end) });
    }
  }
  return merged;
};

// Airbnb imports our published calendar, then re-exports those same dates in
// its own feed as "not available". Ingesting one of those creates a phantom
// reservation sitting on top of the block we ourselves published — and since
// Airbnb reissues the UID on every refresh, each sync cancels the phantom and
// creates a replacement, which is what kept wiping names out of the sheet.
// So a not-available night only counts when the room is otherwise free that
// night, which leaves genuine Airbnb-side blocks working as before.
const uncoveredNights = async (listing, event) => {
  const ourBookings = await Booking.find({
    listing: listing._id,
    source: { $ne: 'airbnb' },
    startDate: { $lt: event.end },
    endDate: { $gt: event.start },
    $or: [
      { status: { $in: ['confirmed', 'blocked'] } },
      { status: 'pending', paymentStatus: { $in: ['paid', 'partially_paid'] } },
    ],
  }).select('startDate endDate');

  const ranges = [];
  for (let time = event.start.getTime(); time < event.end.getTime(); time += DAY_MS) {
    const night = new Date(time);
    if (ourBookings.some((b) => b.startDate <= night && b.endDate > night)) continue;

    const last = ranges[ranges.length - 1];
    if (last && last.end.getTime() === time) {
      last.end = new Date(time + DAY_MS);
    } else {
      ranges.push({ start: night, end: new Date(time + DAY_MS) });
    }
  }
  return ranges;
};

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

  // Only the dates this run actually changed need redrawing in the sheet.
  const touched = [];
  const liveExternalIds = new Set();

  for (const event of events) {
    const blockEvent = isBlockEvent(event);
    const ranges = blockEvent
      ? await uncoveredNights(listing, event)
      : [{ start: event.start, end: event.end }];

    for (const range of ranges) {
      // A not-available event can survive as several disjoint runs once our
      // own published dates are carved out of it, so the external id has to
      // identify the run rather than the event.
      const externalId = blockEvent
        ? `${event.uid}#${range.start.toISOString().slice(0, 10)}`
        : event.uid;
      liveExternalIds.add(externalId);

      const existing = existingAirbnbBookings.find((b) => b.externalId === externalId);

      if (existing) {
        if (
          existing.startDate.getTime() !== range.start.getTime() ||
          existing.endDate.getTime() !== range.end.getTime()
        ) {
          touched.push({ start: existing.startDate, end: existing.endDate });
          existing.startDate = range.start;
          existing.endDate = range.end;
          await existing.save();
          touched.push({ start: range.start, end: range.end });
          result.updated++;
        }
        continue;
      }

      const pricing = blockEvent
        ? null
        : await calculateBookingPrice({
            listing,
            bookingType: 'room',
            startDate: range.start,
            endDate: range.end,
            guests: 1,
            applyGst: false,
          });

      const created = await Booking.create({
        bookingType: 'room',
        listing: listing._id,
        user: null,
        startDate: range.start,
        endDate: range.end,
        guests: 1,
        unitPrice: pricing?.unitPrice ?? 0,
        totalPrice: pricing?.totalPrice ?? 0,
        pricingBreakdown: pricing
          ? { basePrice: pricing.basePrice, adjustments: pricing.adjustments }
          : { basePrice: 0, adjustments: [] },
        status: blockEvent ? 'blocked' : 'confirmed',
        paymentStatus: 'paid',
        paymentMethod: 'airbnb',
        contactName: blockEvent ? 'Airbnb Block' : 'Airbnb Guest',
        contactEmail: 'airbnb-sync@bowline.internal',
        contactPhone: '',
        blockNote: blockEvent ? 'Blocked on Airbnb' : null,
        specialRequests: blockEvent ? 'Blocked on Airbnb' : 'Synced from Airbnb',
        source: 'airbnb',
        externalId,
      });

      touched.push({ start: range.start, end: range.end });
      result.created++;

      if (!blockEvent && isSheetsConfigured()) {
        await writeFullBookingToSheet({ ...created.toObject(), listing }).catch(() => {});
      }
    }
  }

  // Cancel bookings that disappeared from the Airbnb feed
  for (const booking of existingAirbnbBookings) {
    if (!liveExternalIds.has(booking.externalId)) {
      booking.status = 'cancelled';
      await booking.save();
      touched.push({ start: booking.startDate, end: booking.endDate });
      result.cancelled++;
    }
  }

  if (isSheetsConfigured()) {
    for (const range of mergeRanges(touched)) {
      await refreshSheetRange(listing, range.start, range.end).catch(() => {});
    }
  }

  return result;
};

// Generic placeholders that don't count as evidence of a real guest — seeing
// the same one of these across several rooms means nothing (it's just our
// own default text), unlike a real name repeated across rooms.
const GENERIC_CONTACT_NAMES = new Set([
  '', 'airbnb guest', 'airbnb block', 'offline booking', 'offline block', 'test', 'bowline admin',
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

  // Only the room/date combinations this run changed need redrawing.
  const touched = [];

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
            touched.push({ room, start: existing.startDate, end: existing.endDate });
            existing.startDate = spanStart;
            existing.endDate = spanEnd;
            await existing.save();
            touched.push({ room, start: spanStart, end: spanEnd });
            result.updated++;
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
        touched.push({ room, start: spanStart, end: spanEnd });
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
      const room = rooms.find((r) => r._id.equals(booking.listing));
      if (room) touched.push({ room, start: booking.startDate, end: booking.endDate });
      result.cancelled++;
    }
  }

  if (isSheetsConfigured()) {
    for (const room of rooms) {
      const roomRanges = touched.filter((t) => t.room._id.equals(room._id));
      for (const range of mergeRanges(roomRanges)) {
        await refreshSheetRange(room, range.start, range.end).catch(() => {});
      }
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
    try {
      results.push(await syncListingFromAirbnb(listing));
    } catch (error) {
      results.push({ listing: listing.name, created: 0, updated: 0, cancelled: 0, errors: [error.message] });
    }
  }

  try {
    results.push(await syncFullHouseFromAirbnb());
  } catch (error) {
    results.push({ listing: 'Full House', created: 0, updated: 0, cancelled: 0, errors: [error.message] });
  }

  return results;
};
