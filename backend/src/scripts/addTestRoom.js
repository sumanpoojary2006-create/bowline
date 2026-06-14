import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDb } from '../config/db.js';
import Listing from '../models/Listing.js';

dotenv.config();

const run = async () => {
  await connectDb();

  const existing = await Listing.findOne({ slug: 'test-room-rs-1' });

  if (existing) {
    console.log('Test room already exists:', existing._id.toString());
  } else {
    const listing = await Listing.create({
      type: 'room',
      name: 'Test Room (Rs 1)',
      slug: 'test-room-rs-1',
      location: 'Bowline Nature Stay',
      description: 'Test room for payment testing purposes.',
      shortDescription: 'For testing only',
      price: 1,
      priceUnit: 'night',
      maxOccupancy: 2,
      capacity: 2,
      amenities: [],
      facilities: [],
      images: [],
      featured: false,
      active: true,
    });
    console.log('Created test room:', listing._id.toString());
  }

  await mongoose.connection.close();
  process.exit(0);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
