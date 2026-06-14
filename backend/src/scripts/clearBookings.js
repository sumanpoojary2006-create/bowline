import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDb } from '../config/db.js';
import Booking from '../models/Booking.js';
import Notification from '../models/Notification.js';

dotenv.config();

const run = async () => {
  await connectDb();

  const bookingResult = await Booking.deleteMany({});
  const notificationResult = await Notification.deleteMany({ type: 'booking' });

  console.log(`Deleted ${bookingResult.deletedCount} bookings`);
  console.log(`Deleted ${notificationResult.deletedCount} booking notifications`);

  await mongoose.connection.close();
  process.exit(0);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
