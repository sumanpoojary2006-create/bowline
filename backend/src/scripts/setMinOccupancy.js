import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDb } from '../config/db.js';
import Listing from '../models/Listing.js';

dotenv.config();

const MIN_OCCUPANCY = {
  'Cozy 1': 2,
  'Cozy 2': 2,
  'Cozy Mini': 1,
  'Dormitory (Open Loft)': 1,
  'Pent House': 2,
};

const run = async () => {
  await connectDb();

  for (const [name, minOccupancy] of Object.entries(MIN_OCCUPANCY)) {
    const result = await Listing.updateOne({ name }, { minOccupancy });
    console.log(`${name}: matched ${result.matchedCount}, modified ${result.modifiedCount}`);
  }

  await mongoose.connection.close();
  process.exit(0);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
