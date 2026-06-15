export const daysUntil = (date) => {
  const now = new Date();
  const target = new Date(date);
  return Math.floor((target.getTime() - now.getTime()) / 86400000);
};

export const getCancellationRefundPercent = (startDate) => {
  const days = daysUntil(startDate);
  if (days >= 14) return 100;
  if (days >= 7) return 50;
  return 0;
};

export const getRescheduleFeePercent = (startDate) => {
  const days = daysUntil(startDate);
  if (days > 14) return 0;
  if (days >= 7) return 10;
  return null;
};

export const isRescheduleAllowed = (startDate) => getRescheduleFeePercent(startDate) !== null;
