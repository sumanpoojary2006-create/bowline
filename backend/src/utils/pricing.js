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
  return day === 0 || day === 6;
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
  adultGuests,
  childGuests = 0,
  pets = 0,
  groupRate = null,
}) => {
  const units = calculateDurationUnits(bookingType, startDate, endDate);
  const effectiveBase = listing.manualPriceOverride ?? listing.price;
  const rules = groupRate ? [] : await getAppliedRules(listing, startDate, endDate);
  const adults = Number(adultGuests ?? guests ?? 1);
  const children = Number(childGuests || 0);
  const petCount = Number(pets || 0);
  // Group bookings charge every guest (adults and children) the same flat
  // per-person tariff, with no half-price discount for children.
  const payableGuestMultiplier = groupRate ? adults + children : adults + children * 0.5;

  if (bookingType === 'room') {
    const start = dayjs(startDate).startOf('day');
    const end = dayjs(endDate).startOf('day');
    const adjustmentCounts = new Map();
    let totalPrice = 0;

    for (let cursor = start; cursor.isBefore(end, 'day'); cursor = cursor.add(1, 'day')) {
      let nightlyPrice = groupRate ? (isWeekendNight(cursor) ? groupRate.weekend : groupRate.weekday) : effectiveBase;

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
      totalPrice += nightlyPrice * payableGuestMultiplier;
    }

    if (petCount > 0) {
      totalPrice += petCount * 400;
      adjustmentCounts.set('Pet fee', (adjustmentCounts.get('Pet fee') || 0) + petCount);
    }

    const averageNightlyTariff =
      units > 0 && payableGuestMultiplier > 0
        ? Math.round((totalPrice - petCount * 400) / (units * payableGuestMultiplier))
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
