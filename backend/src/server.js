import dotenv from 'dotenv';
import { connectDb } from './config/db.js';
import app from './app.js';
import { scheduleDailyGuestEmailJob } from './jobs/dailyGuestEmailJob.js';
import { scheduleAirbnbSyncJob } from './jobs/airbnbSyncJob.js';
import { scheduleMonthlyLaundryDamageReport } from './jobs/monthlyLaundryDamageReportJob.js';

dotenv.config();

const port = process.env.PORT || 5000;

connectDb()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
    scheduleDailyGuestEmailJob();
    scheduleAirbnbSyncJob();
    scheduleMonthlyLaundryDamageReport();
  })
  .catch((error) => {
    console.error('Failed to start server', error);
    process.exit(1);
  });
