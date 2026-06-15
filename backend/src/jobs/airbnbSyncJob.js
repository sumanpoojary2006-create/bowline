import cron from 'node-cron';
import { syncAllAirbnbCalendars } from '../utils/airbnbSync.js';

export const scheduleAirbnbSyncJob = () => {
  const schedule = process.env.AIRBNB_SYNC_CRON || '0 * * * *';

  cron.schedule(schedule, () => {
    syncAllAirbnbCalendars().catch((error) => {
      console.error('Failed to sync Airbnb calendars', error);
    });
  });

  console.log(`Airbnb calendar sync scheduled (${schedule})`);
};
