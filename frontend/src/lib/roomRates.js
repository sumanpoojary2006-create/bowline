// Occupancy/display metadata only. Nightly prices come from each listing's
// own `price`/`manualPriceOverride` (the same value the backend charges) so
// the displayed total always matches the amount sent to Razorpay.
export const roomMeta = {
  'cozy-1': { min: 2, max: 4, floor: 'Ground' },
  'cozy-2': { min: 2, max: 4, floor: 'Ground' },
  'cozy-mini': { min: 1, max: 3, floor: '1st' },
  'dormitory-open-loft': { min: 1, max: 5, floor: '1st' },
  'pent-house': { min: 2, max: 4, floor: '2nd' },
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
    label: 'Group Booking 1',
    minGuests: 10,
    maxGuests: 15,
    weekday: 1699,
    weekend: 1899,
  },
  'full-house': {
    key: 'full-house',
    label: 'Group Booking 2',
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

  const meta = roomMeta[listing?.slug] || { min: 1, max: listing?.capacity || 1, floor: '' };
  const nightlyPrice = listing?.manualPriceOverride ?? listing?.price ?? 0;

  return { weekday: nightlyPrice, weekend: nightlyPrice, ...meta };
};

export const isWeekendStayDate = (date) => {
  const day = new Date(date).getDay();
  return day === 5 || day === 6;
};

export const getNightlyRoomRate = (listing, date) => {
  const rates = getRoomRate(listing);
  return isWeekendStayDate(date) ? rates.weekend : rates.weekday;
};
