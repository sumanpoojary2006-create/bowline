// One-shot re-sync of booking cells to the Google Sheet with current colors.
// Clears cancelled/failed bookings, repaints live ones (green/yellow/white).
// Usage: node src/scripts/resyncSheetColors.js
import 'dotenv/config';
import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import '../models/Listing.js';
import { clearBookingFromSheet, writeBookingToSheet } from '../utils/googleSheets.js';

await mongoose.connect(process.env.MONGODB_URI);

const windowStart = new Date('2026-01-01');
const all = await Booking.find({ endDate: { $gte: windowStart } }).populate('listing', 'name');

const dead = all.filter((b) => b.status === 'cancelled' || b.paymentStatus === 'failed');
const live = all.filter((b) => b.status !== 'cancelled' && b.paymentStatus !== 'failed');

console.log(`Bookings in window: ${all.length} (${dead.length} cancelled/failed to clear, ${live.length} live to repaint)`);

let cleared = 0;
for (const b of dead) {
  if (!b.listing?.name) continue;
  try {
    await clearBookingFromSheet(b);
    cleared++;
  } catch (e) {
    console.error('clear failed:', b._id.toString(), e.message);
  }
  if (cleared % 25 === 0) console.log(`cleared ${cleared}/${dead.length}`);
}
console.log(`Cleared: ${cleared}`);

let painted = 0;
for (const b of live) {
  if (!b.listing?.name) continue;
  try {
    await writeBookingToSheet(b);
    painted++;
  } catch (e) {
    console.error('paint failed:', b._id.toString(), e.message);
  }
  if (painted % 25 === 0) console.log(`painted ${painted}/${live.length}`);
}
console.log(`Repainted: ${painted}`);

await mongoose.disconnect();
console.log('Re-sync complete');
