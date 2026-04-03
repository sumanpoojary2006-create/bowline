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
      { listing: null, listingType: listing.type },
      { listing: null, listingType: 'all' },
    ],
  }).sort({ priority: -1, createdAt: -1 });

  return rules;
};

const isWeekendNight = (date) => {
  const day = dayjs(date).day();
  return day === 5 || day === 6;
};

const isRuleApplicableForDate = (rule, date) => {
  const target = dayjs(date).startOf('day');
  const startsOnOrBefore = dayjs(rule.startDate).startOf('day').isSame(target) || dayjs(rule.startDate).startOf('day').isBefore(target);
  const endsOnOrAfter = dayjs(rule.endDate).startOf('day').isSame(target) || dayjs(rule.endDate).startOf('day').isAfter(target);

  if (!startsOnOrBefore || !endsOnOrAfter) {
    return false;
  }

  if (/weekend/i.test(rule.name)) {
    return isWeekendNight(target);
  }

  return true;
};

const summarizeAdjustments = (counts) =>
  Array.from(counts.entries()).map(([name, count]) =>
    count > 1 ? `${name} for ${count} nights` : name
  );

export const calculateBookingPrice = async ({
  listing,
  bookingType,
  startDate,
  endDate,
  guests,
}) => {
  const units = calculateDurationUnits(bookingType, startDate, endDate);
  const effectiveBase = listing.manualPriceOverride ?? listing.price;
  const rules = await getAppliedRules(listing, startDate, endDate);

  if (bookingType === 'room') {
    const start = dayjs(startDate).startOf('day');
    const end = dayjs(endDate).startOf('day');
    const adjustmentCounts = new Map();
    let totalPrice = 0;

    for (let cursor = start; cursor.isBefore(end, 'day'); cursor = cursor.add(1, 'day')) {
      let nightlyPrice = effectiveBase;

      for (const rule of rules) {
        if (!isRuleApplicableForDate(rule, cursor)) {
          continue;
        }

        if (rule.adjustmentType === 'percentage') {
          nightlyPrice += nightlyPrice * (rule.adjustmentValue / 100);
        } else {
          nightlyPrice += rule.adjustmentValue;
        }

        adjustmentCounts.set(rule.name, (adjustmentCounts.get(rule.name) || 0) + 1);
      }

      nightlyPrice = Math.max(Math.round(nightlyPrice), 0);
      totalPrice += nightlyPrice * Number(guests || 1);
    }

    const averageNightlyTariff =
      units > 0 && Number(guests || 1) > 0
        ? Math.round(totalPrice / (units * Number(guests || 1)))
        : Math.round(effectiveBase);

    return {
      unitPrice: averageNightlyTariff,
      totalPrice,
      basePrice: effectiveBase,
      adjustments: summarizeAdjustments(adjustmentCounts),
    };
  }

  const multiplier = listing.priceUnit === 'person' ? guests : 1;
  let unitPrice = effectiveBase;
  const adjustments = [];

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
