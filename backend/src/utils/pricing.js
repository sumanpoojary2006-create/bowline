import dayjs from 'dayjs';
import PricingRule from '../models/PricingRule.js';

export const calculateDurationUnits = (bookingType, startDate, endDate) => {
  const start = dayjs(startDate);
  const end = dayjs(endDate);
  const dayDiff = Math.max(end.diff(start, 'day'), 1);

  if (bookingType === 'room') {
    return dayDiff;
  }

  return 1;
};

export const getAppliedRules = async (listing, startDate, endDate) => {
  const rules = await PricingRule.find({
    active: true,
    startDate: { $lte: endDate },
    endDate: { $gte: startDate },
    $or: [
      { listing: listing._id },
      { listingType: listing.type },
      { listingType: 'all' },
    ],
  }).sort({ priority: -1, createdAt: -1 });

  return rules;
};

export const calculateBookingPrice = async ({
  listing,
  bookingType,
  startDate,
  endDate,
  guests,
}) => {
  const units = calculateDurationUnits(bookingType, startDate, endDate);
  const effectiveBase = listing.manualPriceOverride ?? listing.price;
  const multiplier = bookingType === 'room' ? units : guests;
  let unitPrice = effectiveBase;
  const adjustments = [];

  const rules = await getAppliedRules(listing, startDate, endDate);

  for (const rule of rules) {
    if (rule.adjustmentType === 'percentage') {
      unitPrice += unitPrice * (rule.adjustmentValue / 100);
      adjustments.push(`${rule.name}: ${rule.adjustmentValue}%`);
    } else {
      unitPrice += rule.adjustmentValue;
      adjustments.push(`${rule.name}: ₹${rule.adjustmentValue}`);
    }
  }

  unitPrice = Math.max(Math.round(unitPrice), 0);

  return {
    unitPrice,
    totalPrice: unitPrice * multiplier,
    basePrice: effectiveBase,
    adjustments,
  };
};
