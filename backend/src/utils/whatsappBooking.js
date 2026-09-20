export const WHATSAPP_QUERY_REPLY = `Please Note: ⚠️
You can use this link only to book your stay at Bowline Nature Stay.
For any queries, assistance, or other information, please contact us on our official WhatsApp number:
https://wa.me/message/YASL6E2YGMZ6B1`;

export const allocateCouponDiscount = (items, totalDiscount) => {
  const subtotal = items.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);
  const effectiveDiscount = Math.min(
    Math.max(Math.round(Number(totalDiscount || 0)), 0),
    subtotal
  );
  let remaining = effectiveDiscount;

  return items.map((item, index) => {
    if (!remaining || !subtotal) return 0;

    const discount =
      index === items.length - 1
        ? remaining
        : Math.min(
            Math.round((Number(item.totalPrice || 0) / subtotal) * effectiveDiscount),
            Number(item.totalPrice || 0),
            remaining
          );

    remaining -= discount;
    return discount;
  });
};

export const getRazorpayCustomerEmail = (payment) => {
  const email = String(payment?.email || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : '';
};

export const looksLikeCustomerQuery = (text) => {
  const value = String(text || '').trim().toLowerCase();
  if (!value) return false;
  if (value.includes('?')) return true;

  return /\b(what|why|how|where|when|who|can|could|would|help|query|contact|price|cost|food|meal|location|address|facility|facilities|amenity|amenities)\b/.test(
    value
  );
};

export const excludeSelectedRooms = (rooms, cart) => {
  const selectedIds = new Set(
    (cart || [])
      .map((item) => String(item?.listingId || ''))
      .filter(Boolean)
  );

  return (rooms || []).filter((room) => !selectedIds.has(String(room?._id || '')));
};

export const WHATSAPP_GROUP_TIERS = {
  group: {
    key: 'except-pent-house',
    label: 'Group Booking',
    weekday: 1699,
    weekend: 1899,
    excludePentHouse: true,
  },
  fullHouse: {
    key: 'full-house',
    label: 'Full House',
    weekday: 1599,
    weekend: 1699,
    excludePentHouse: false,
  },
};

export const getWhatsAppGroupTier = (guestCount) =>
  Number(guestCount) >= 16 ? WHATSAPP_GROUP_TIERS.fullHouse : WHATSAPP_GROUP_TIERS.group;

// Match the website bundle allocation: give every room its minimum occupancy,
// then spread the remaining guests without exceeding room capacity.
export const distributeGroupGuests = (guestCount, rooms) => {
  const counts = rooms.map((room) => Math.min(room.minOccupancy || 1, room.capacity || 1));
  let remaining = Number(guestCount) - counts.reduce((sum, count) => sum + count, 0);

  while (remaining > 0) {
    let madeProgress = false;

    for (let index = 0; index < rooms.length && remaining > 0; index += 1) {
      if (counts[index] < (rooms[index].capacity || 1)) {
        counts[index] += 1;
        remaining -= 1;
        madeProgress = true;
      }
    }

    if (!madeProgress) break;
  }

  return counts;
};
