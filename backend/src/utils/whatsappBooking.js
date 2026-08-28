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
