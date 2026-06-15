import dotenv from 'dotenv';
import { connectDb } from './config/db.js';
import app from './app.js';
import { scheduleDailyGuestEmailJob } from './jobs/dailyGuestEmailJob.js';
import { scheduleAirbnbSyncJob } from './jobs/airbnbSyncJob.js';

dotenv.config();

const port = process.env.PORT || 5000;

connectDb()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
    scheduleDailyGuestEmailJob();
    scheduleAirbnbSyncJob();
  })
  .catch((error) => {
    console.error('Failed to start server', error);
    process.exit(1);
  });
