export const roomRates = {
  'cozy-1': { weekday: 1999, weekend: 2199, min: 2, max: 4, floor: 'Ground' },
  'cozy-2': { weekday: 1999, weekend: 2199, min: 2, max: 4, floor: 'Ground' },
  'cozy-mini': { weekday: 1799, weekend: 1999, min: 1, max: 3, floor: '1st' },
  'dormitory-open-loft': { weekday: 1399, weekend: 1499, min: 1, max: 5, floor: '1st' },
  'pent-house': { weekday: 2399, weekend: 2599, min: 2, max: 4, floor: '2nd' },
};

export const petFee = 400;

export const getRoomRate = (listing) =>
  roomRates[listing?.slug] || {
    weekday: listing?.price || 0,
    weekend: listing?.price || 0,
    min: 1,
    max: listing?.capacity || 1,
    floor: '',
  };

export const isWeekendStayDate = (date) => {
  const day = new Date(date).getDay();
  return day === 5 || day === 6;
};

export const getNightlyRoomRate = (listing, date) => {
  const rates = getRoomRate(listing);
  return isWeekendStayDate(date) ? rates.weekend : rates.weekday;
};

export const getGroupRoomsForGuests = (rooms, guests) => {
  const guestCount = Number(guests || 0);
  if (guestCount >= 15 && guestCount <= 20) return rooms;
  if (guestCount >= 10 && guestCount < 15) {
    return rooms.filter((room) => room.slug !== 'pent-house');
  }
  return [];
};

export const getGroupBookingLabel = (guests) => {
  const guestCount = Number(guests || 0);
  if (guestCount >= 15 && guestCount <= 20) return 'Full house';
  if (guestCount >= 10 && guestCount < 15) return 'All rooms except Pent House';
  return 'Available for 10 to 20 guests';
};
