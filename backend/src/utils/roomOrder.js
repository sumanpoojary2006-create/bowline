const ROOM_DISPLAY_ORDER = ['pent-house', 'cozy-1', 'cozy-2', 'cozy-mini', 'dormitory-open-loft'];

export const getRoomDisplayOrder = (room) => {
  const index = ROOM_DISPLAY_ORDER.indexOf(room?.slug);
  return index === -1 ? ROOM_DISPLAY_ORDER.length : index;
};

export const sortRoomsForDisplay = (rooms) =>
  [...rooms].sort((a, b) => getRoomDisplayOrder(a) - getRoomDisplayOrder(b));
