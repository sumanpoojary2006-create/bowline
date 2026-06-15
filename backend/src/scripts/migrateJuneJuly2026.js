import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDb } from '../config/db.js';
import { importLegacy, pushToSheet } from '../controllers/syncController.js';

dotenv.config();

function fakeRes(label) {
  return {
    status: () => fakeRes(label),
    json: (body) => console.log(`[${label}]`, JSON.stringify(body, null, 2)),
  };
}

function fakeNext(label) {
  return (err) => {
    console.error(`[${label}] error:`, err);
    process.exitCode = 1;
  };
}

async function main() {
  await connectDb();

  await importLegacy({}, fakeRes('import-legacy'), fakeNext('import-legacy'));
  await pushToSheet({}, fakeRes('push'), fakeNext('push'));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
