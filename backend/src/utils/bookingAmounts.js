// Bookings are paid in two installments: 50% deposit at booking time, the
// remaining 50% online at check-out. The deposit amount is derived from
// totalPrice rather than stored, so it always reflects the booking's current
// price (e.g. after a reschedule).
export const getDepositAmount = (booking) => Math.round(booking.totalPrice / 2);

export const getAmountDue = (booking, payInFull = false) => {
  if (booking.paymentStatus === 'paid') return 0;
  if (booking.paymentStatus === 'partially_paid') return booking.totalPrice - getDepositAmount(booking);
  return payInFull ? booking.totalPrice : getDepositAmount(booking);
};

// What the guest has actually paid for this booking so far. Use this anywhere
// a "Total Paid" figure is shown — for partially-paid bookings, this is the
// 50% deposit (plus any reschedule fee if applicable), not the full total.
export const getAmountPaid = (booking) => {
  const deposit = getDepositAmount(booking);
  const rescheduleFee = Number(booking.rescheduleFeeAmount || 0);

  if (booking.paymentStatus === 'paid') {
    return booking.totalPrice + rescheduleFee;
  }
  if (booking.paymentStatus === 'partially_paid') {
    return deposit + rescheduleFee;
  }
  return rescheduleFee; // 'pending' or 'failed' — only the reschedule fee if any
};
