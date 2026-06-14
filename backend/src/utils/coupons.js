import Coupon from '../models/Coupon.js';

export const normalizeCouponCode = (code) => String(code || '').trim().toUpperCase();

export const calculateCouponDiscount = (coupon, subtotal) => {
  const total = Math.max(Number(subtotal || 0), 0);

  if (!coupon || total <= 0) {
    return 0;
  }

  let discount =
    coupon.discountType === 'percentage'
      ? total * (Number(coupon.discountValue || 0) / 100)
      : Number(coupon.discountValue || 0);

  if (coupon.maxDiscountAmount !== null && coupon.maxDiscountAmount !== undefined) {
    discount = Math.min(discount, Number(coupon.maxDiscountAmount));
  }

  return Math.min(Math.round(discount), total);
};

export const findValidCoupon = async (code, subtotal) => {
  const normalizedCode = normalizeCouponCode(code);

  if (!normalizedCode) {
    return { coupon: null, discount: 0 };
  }

  const coupon = await Coupon.findOne({ code: normalizedCode });

  if (!coupon || !coupon.active) {
    throw new Error('Coupon code is not valid');
  }

  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) {
    throw new Error('Coupon offer has not started yet');
  }

  if (coupon.endsAt && coupon.endsAt < now) {
    throw new Error('Coupon offer has expired');
  }

  const total = Number(subtotal || 0);
  if (total < Number(coupon.minBookingAmount || 0)) {
    throw new Error(`Coupon requires a minimum bill of ₹${coupon.minBookingAmount}`);
  }

  const discount = calculateCouponDiscount(coupon, total);

  return { coupon, discount };
};
