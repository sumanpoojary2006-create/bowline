export function calendarDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
// Mirrors the server's tariff order, matching weekend rules on Saturday/Sunday.
export function calendarNightRate(room, day, rules) {
  let rate = Number(room.manualPriceOverride ?? room.price ?? 0);
  const applicable = rules.filter(r => r.active && (!r.listing || (r.listing._id || r.listing) === room._id) && (!r.listingType || r.listingType === 'all' || r.listingType === room.type) && String(r.startDate).slice(0,10) <= day && String(r.endDate).slice(0,10) >= day).sort((a,b) => b.priority-a.priority || new Date(b.createdAt)-new Date(a.createdAt));
  for (const r of applicable) {
    if (/weekend/i.test(r.name) && ![0,6].includes(new Date(`${day}T12:00:00`).getDay())) continue;
    rate += r.adjustmentType === 'percentage' ? rate*Number(r.adjustmentValue)/100 : Number(r.adjustmentValue);
  }
  return Math.max(0, Math.round(rate));
}
