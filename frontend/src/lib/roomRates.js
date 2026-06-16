// Published tariff card. Weekday prices match each listing's base `price` in
// the database; weekend prices match an active "Weekend surcharge" pricing
// rule for that listing, so the displayed total matches the amount charged.
export const roomRates = {
  'cozy-1': { weekday: 1999, weekend: 2199, min: 2, max: 4, floor: 'Ground' },
  'cozy-2': { weekday: 1999, weekend: 2199, min: 2, max: 4, floor: 'Ground' },
  'cozy-mini': { weekday: 1799, weekend: 1999, min: 1, max: 3, floor: '1st' },
  'dormitory-open-loft': { weekday: 1399, weekend: 1499, min: 1, max: 5, floor: '1st' },
  'pent-house': { weekday: 2399, weekend: 2599, min: 2, max: 4, floor: '2nd' },
};

export const petFee = 400;

const ROOM_DISPLAY_ORDER = ['pent-house', 'cozy-1', 'cozy-2', 'cozy-mini', 'dormitory-open-loft'];

export const getRoomDisplayOrder = (listing) => {
  const index = ROOM_DISPLAY_ORDER.indexOf(listing?.slug);
  return index === -1 ? ROOM_DISPLAY_ORDER.length : index;
};

// Group booking bundles: fixed per-person rates that override each room's
// individual tariff when guests book the whole bundle together.
export const groupBookingTiers = {
  'except-pent-house': {
    key: 'except-pent-house',
    label: 'Group Booking',
    minGuests: 10,
    maxGuests: 15,
    weekday: 1699,
    weekend: 1899,
  },
  'full-house': {
    key: 'full-house',
    label: 'Full House',
    minGuests: 16,
    maxGuests: 20,
    weekday: 1599,
    weekend: 1699,
  },
};

export const getGroupBundleRooms = (rooms, bundle) =>
  bundle === 'full-house' ? rooms : rooms.filter((room) => room.slug !== 'pent-house');

export const getRoomRate = (listing) => {
  if (listing?.isGroupBundle) {
    const tier = groupBookingTiers[listing.bundle];
    return { weekday: tier.weekday, weekend: tier.weekend, min: tier.minGuests, max: tier.maxGuests, floor: '' };
  }

  return (
    roomRates[listing?.slug] || {
      weekday: listing?.manualPriceOverride ?? listing?.price ?? 0,
      weekend: listing?.manualPriceOverride ?? listing?.price ?? 0,
      min: 1,
      max: listing?.capacity || 1,
      floor: '',
    }
  );
};

export const isWeekendStayDate = (date) => {
  const day = new Date(date).getDay();
  return day === 0 || day === 6;
};

export const getNightlyRoomRate = (listing, date) => {
  const rates = getRoomRate(listing);
  return isWeekendStayDate(date) ? rates.weekend : rates.weekday;
};
