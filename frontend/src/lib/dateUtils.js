export const addDays = (value, days) => {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
};

export const formatDateParam = (value) => {
  if (!value) return '';

  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseDateParam = (value, fallback = null) => {
  if (!value) return fallback;

  const match = String(value).match(/\d{4}-\d{2}-\d{2}/);
  if (!match) return fallback;

  const [year, month, day] = match[0].split('-').map(Number);
  if (!year || !month || !day) return fallback;

  return new Date(year, month - 1, day);
};

export const ensureCheckoutDate = (startDate, endDate, minNights = 1) => {
  if (!startDate) return endDate;
  if (!endDate) return addDays(startDate, minNights);

  const minimumCheckout = addDays(startDate, minNights);
  if (endDate < minimumCheckout) {
    return minimumCheckout;
  }

  return endDate;
};
