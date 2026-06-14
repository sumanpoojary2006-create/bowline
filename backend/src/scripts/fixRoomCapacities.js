import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDb } from '../config/db.js';
import Listing from '../models/Listing.js';

dotenv.config();

const CAPACITIES = {
  'Cozy 1': 4,
  'Cozy 2': 4,
  'Cozy Mini': 3,
  'Dormitory (Open Loft)': 5,
  'Pent House': 4,
};

const run = async () => {
  await connectDb();

  for (const [name, capacity] of Object.entries(CAPACITIES)) {
    const result = await Listing.updateOne({ name }, { capacity, maxOccupancy: capacity });
    console.log(`${name}: matched ${result.matchedCount}, modified ${result.modifiedCount}`);
  }

  await mongoose.connection.close();
  process.exit(0);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
