import { sendUpcomingCheckinReport } from '../jobs/dailyGuestEmailJob.js';
import { sendMonthlyLaundryDamageReport } from '../jobs/monthlyLaundryDamageReportJob.js';
import { sendMonthlySalarySlips } from '../jobs/monthlySalarySlipJob.js';

const verifyCron = (req, res) => {
  const auth = req.headers.authorization || '';
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401);
    throw new Error('Invalid cron secret');
  }
};

export const sendUpcomingCheckinsCron = async (req, res, next) => {
  try {
    verifyCron(req, res);
    const result = await sendUpcomingCheckinReport();
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const sendMonthlyLaundryDamageCron = async (req, res, next) => {
  try {
    verifyCron(req, res);
    const result = await sendMonthlyLaundryDamageReport();
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const sendMonthlySalarySlipsCron = async (req, res, next) => {
  try {
    verifyCron(req, res);
    const result = await sendMonthlySalarySlips();
    res.json(result);
  } catch (error) {
    next(error);
  }
};
