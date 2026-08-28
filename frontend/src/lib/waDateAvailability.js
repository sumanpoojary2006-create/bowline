function toLocalMidnight(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function blocksRoom(range) {
  return range.status === 'confirmed' || range.status === 'blocked';
}

export function isBookedDay(date, bookedRanges) {
  return bookedRanges.some(
    (range) =>
      blocksRoom(range) &&
      toLocalMidnight(range.startDate) <= date &&
      toLocalMidnight(range.endDate) > date
  );
}

// A guest may check out on the day the next booking begins. Any booked night
// before the proposed checkout, however, makes the whole range invalid.
export function wouldCheckoutConflict(date, startDate, bookedRanges) {
  if (!startDate) return false;
  return bookedRanges.some(
    (range) =>
      blocksRoom(range) &&
      toLocalMidnight(range.startDate) < date &&
      toLocalMidnight(range.endDate) > startDate
  );
}
