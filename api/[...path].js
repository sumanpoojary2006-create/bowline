import { connectDb } from '../backend/src/config/db.js';
import app from '../backend/src/app.js';

let connectionPromise;

export default async function handler(req, res) {
  if (!connectionPromise) {
    connectionPromise = connectDb();
  }

  await connectionPromise;
  return app(req, res);
}
