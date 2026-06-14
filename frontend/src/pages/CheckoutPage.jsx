import { MinusIcon, PlusIcon, TagIcon, TrashIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import BookingSuccessOverlay from '../components/BookingSuccessOverlay';
import { useAuth } from '../context/AuthContext';
import { useBookingCart } from '../context/BookingCartContext';
import api from '../lib/api';
import { formatCurrency, formatDate } from '../lib/formatters';

function CheckoutPage() {
  const { items, removeItem, updateItem, clearCart } = useBookingCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [contact, setContact] = useState({
    contactName: '',
    contactEmail: '',
    contactPhone: '',
  });

  const [isGroupBooking, setIsGroupBooking] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [couponOffer, setCouponOffer] = useState(null);
  const [couponChecking, setCouponChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (user) {
      setContact((prev) => ({
        ...prev,
        contactName: prev.contactName || user.name || '',
        contactEmail: prev.contactEmail || user.email || '',
        contactPhone: prev.contactPhone || user.phone || '',
      }));
    }
  }, [user]);

  const nightsBetween = (start, end) =>
    Math.max(Math.round((new Date(end) - new Date(start)) / 86400000), 1);

  const totalEstimate = items.reduce((sum, item) => {
    const nights = nightsBetween(item.startDate, item.endDate);
    return sum + item.listing.price * nights;
  }, 0);

  const totalGuests = items.reduce((sum, item) => sum + item.guests, 0);
  const couponDiscount = couponOffer?.discount || 0;
  const finalEstimate = Math.max(totalEstimate - couponDiscount, 0);
  const mealSelectionComplete = items.every(
    (item) => item.listing.type !== 'room' || Number(item.vegCount || 0) + Number(item.nonVegCount || 0) === Number(item.guests || 0)
  );

  const increment = (value, amount, min = 0, max = 20) => Math.max(min, Math.min(max, Number(value || 0) + amount));

  const updateMealCount = (item, mealType, amount) => {
    const maxGuests = Number(item.guests || 0);
    const currentVeg = Number(item.vegCount || 0);
    const currentNonVeg = Number(item.nonVegCount || 0);

    if (mealType === 'veg') {
      const vegCount = increment(currentVeg, amount, 0, maxGuests);
      updateItem(item.id, {
        vegCount,
        nonVegCount: Math.min(currentNonVeg, maxGuests - vegCount),
      });
      return;
    }

    const nonVegCount = increment(currentNonVeg, amount, 0, maxGuests);
    updateItem(item.id, {
      vegCount: Math.min(currentVeg, maxGuests - nonVegCount),
      nonVegCount,
    });
  };

  useEffect(() => {
    setCouponOffer(null);
  }, [totalEstimate]);

  const applyCoupon = async () => {
    const code = couponCode.trim();

    if (!code) {
      toast.error('Enter a coupon code');
      return;
    }

    setCouponChecking(true);
    try {
      const { data } = await api.post('/bookings/coupon/validate', {
        couponCode: code,
        subtotal: totalEstimate,
      });
      setCouponOffer(data);
      setCouponCode(data.coupon.code);
      toast.success(`${data.coupon.code} applied`);
    } catch (error) {
      setCouponOffer(null);
      toast.error(error.response?.data?.message || 'Unable to apply coupon');
    } finally {
      setCouponChecking(false);
    }
  };

  const removeCoupon = () => {
    setCouponOffer(null);
    setCouponCode('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user) {
      navigate('/login', { state: { from: { pathname: '/checkout' } } });
      return;
    }

    if (items.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    if (!mealSelectionComplete) {
      toast.error('Meal preference is required for every guest');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post('/bookings/multi', {
        items: items.map((item) => ({
          listingId: item.listing._id,
          startDate: item.startDate,
          endDate: item.endDate,
          guests: item.guests,
          adultGuests: item.guests,
          childGuests: 0,
          vegCount: Number(item.vegCount || 0),
          nonVegCount: Number(item.nonVegCount || 0),
        })),
        ...contact,
        isGroupBooking,
        groupName: isGroupBooking ? groupName : '',
        couponCode: couponOffer?.coupon?.code || '',
      });

      clearCart();
      setShowSuccess(true);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to complete booking');
    } finally {
      setSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <section className="section-shell py-16 text-center">
        {showSuccess && <BookingSuccessOverlay onClose={() => navigate('/dashboard')} />}
        <p className="text-slate-400">Your cart is empty.</p>
        <button onClick={() => navigate('/browse')} className="btn-primary mt-6">
          Browse Rooms
        </button>
      </section>
    );
  }

  return (
    <section className="section-shell py-12">
      {showSuccess && <BookingSuccessOverlay onClose={() => navigate('/dashboard')} />}
      <h1 className="mb-6 font-display text-2xl text-white sm:text-4xl">Checkout</h1>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <div className="order-2 space-y-6 lg:order-1">
          <div className="glass rounded-[2rem] p-6">
            <h2 className="mb-4 text-lg font-semibold text-white">Your Rooms</h2>
            <ul className="space-y-4">
              {items.map((item) => {
                const nights = nightsBetween(item.startDate, item.endDate);
                return (
                  <li
                    key={item.id}
                    className="flex gap-4 rounded-[1.5rem] border border-white/10 bg-white/5 p-4"
                  >
                    <img
                      src={item.listing.images?.[0] || 'https://placehold.co/80x80'}
                      alt={item.listing.name}
                      className="h-20 w-20 flex-shrink-0 rounded-xl object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-white">{item.listing.name}</p>
                      <p className="mt-0.5 text-sm text-slate-400">
                        {formatDate(item.startDate)} → {formatDate(item.endDate)}
                      </p>
                      <p className="text-sm text-slate-400">
                        {nights} night{nights > 1 ? 's' : ''} · {item.guests} guest{item.guests > 1 ? 's' : ''}
                      </p>
                      <div className="mt-3 rounded-[1.25rem] border border-lime-100/10 bg-black/20 p-3">
                        <ul className="mb-3 list-disc space-y-1 pl-4 text-xs text-slate-300">
                          <li>Breakfast is complimentary.</li>
                          <li>Meal price is not included in the room total.</li>
                          <li>Lunch and dinner are Rs 350 per person per meal.</li>
                        </ul>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="flex items-center justify-between gap-3 rounded-full border border-white/10 px-3 py-2">
                            <span className="text-xs font-semibold text-slate-300">Veg</span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                className="rounded-full border border-lime-100/15 p-1 text-white disabled:opacity-40"
                                disabled={Number(item.vegCount || 0) <= 0}
                                onClick={() => updateMealCount(item, 'veg', -1)}
                              >
                                <MinusIcon className="h-3.5 w-3.5" />
                              </button>
                              <span className="w-5 text-center text-sm font-semibold text-white">{Number(item.vegCount || 0)}</span>
                              <button
                                type="button"
                                className="rounded-full border border-lime-100/15 p-1 text-white disabled:opacity-40"
                                disabled={Number(item.vegCount || 0) >= Number(item.guests || 0)}
                                onClick={() => updateMealCount(item, 'veg', 1)}
                              >
                                <PlusIcon className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-3 rounded-full border border-white/10 px-3 py-2">
                            <span className="text-xs font-semibold text-slate-300">Non-veg</span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                className="rounded-full border border-lime-100/15 p-1 text-white disabled:opacity-40"
                                disabled={Number(item.nonVegCount || 0) <= 0}
                                onClick={() => updateMealCount(item, 'nonVeg', -1)}
                              >
                                <MinusIcon className="h-3.5 w-3.5" />
                              </button>
                              <span className="w-5 text-center text-sm font-semibold text-white">{Number(item.nonVegCount || 0)}</span>
                              <button
                                type="button"
                                className="rounded-full border border-lime-100/15 p-1 text-white disabled:opacity-40"
                                disabled={Number(item.nonVegCount || 0) >= Number(item.guests || 0)}
                                onClick={() => updateMealCount(item, 'nonVeg', 1)}
                              >
                                <PlusIcon className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                        {Number(item.vegCount || 0) + Number(item.nonVegCount || 0) !== Number(item.guests || 0) ? (
                          <p className="mt-2 text-xs text-amber-300">
                            Meal preference is required for every guest. {Number(item.vegCount || 0) + Number(item.nonVegCount || 0)} of{' '}
                            {item.guests} assigned.
                          </p>
                        ) : null}
                      </div>
                      <p className="mt-1 font-semibold text-lime-300">
                        {formatCurrency(item.listing.price * nights)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="self-start rounded-full p-1 text-slate-500 hover:text-rose-400"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="glass rounded-[2rem] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Group Booking</h2>
              <button
                type="button"
                onClick={() => setIsGroupBooking((v) => !v)}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  isGroupBooking ? 'bg-lime-400' : 'bg-white/20'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    isGroupBooking ? 'left-5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>

            {isGroupBooking && (
              <div className="space-y-4">
                <div className="rounded-[1.25rem] border border-lime-400/20 bg-lime-400/5 p-4 text-sm text-slate-300">
                  <div className="flex items-center gap-2 text-lime-300">
                    <UserGroupIcon className="h-4 w-4" />
                    <span className="font-semibold">Group booking enabled</span>
                  </div>
                  <p className="mt-1">
                    Total guests across {items.length} room{items.length > 1 ? 's' : ''}: {totalGuests}
                  </p>
                </div>
                <div>
                  <label className="label">Group / Organisation Name</label>
                  <input
                    className="input"
                    placeholder="e.g. Smith Family Reunion, Corporate Retreat"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="order-1 space-y-6 lg:order-2">
          <div className="glass rounded-[2rem] p-6">
            <h2 className="mb-4 text-lg font-semibold text-white">Order Summary</h2>
            <div className="space-y-2 text-sm text-slate-300">
              {items.map((item) => {
                const nights = nightsBetween(item.startDate, item.endDate);
                return (
                  <div key={item.id} className="flex justify-between">
                    <span className="truncate pr-2">{item.listing.name} × {nights}n</span>
                    <span className="whitespace-nowrap font-semibold text-white">
                      {formatCurrency(item.listing.price * nights)}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 border-t border-white/10 pt-4">
              {couponDiscount > 0 && (
                <div className="mb-3 flex justify-between text-sm font-semibold text-lime-200">
                  <span>Coupon {couponOffer.coupon.code}</span>
                  <span>-{formatCurrency(couponDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-white">
                <span>Estimated Total</span>
                <span className="text-lime-300">{formatCurrency(finalEstimate)}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Final price confirmed at check-in. Dynamic tariffs may apply.
              </p>
            </div>
          </div>

          <div className="glass rounded-[2rem] p-6">
            <div className="mb-4 flex items-center gap-2 text-white">
              <TagIcon className="h-5 w-5 text-lime-300" />
              <h2 className="text-lg font-semibold">Coupon Offer</h2>
            </div>
            <div className="flex gap-2">
              <input
                className="input uppercase"
                placeholder="Enter coupon code"
                value={couponCode}
                onChange={(event) => {
                  setCouponCode(event.target.value);
                  setCouponOffer(null);
                }}
              />
              <button className="btn-secondary shrink-0" type="button" onClick={applyCoupon} disabled={couponChecking}>
                {couponChecking ? 'Checking...' : 'Apply'}
              </button>
            </div>
            {couponOffer && (
              <div className="mt-4 rounded-[1.25rem] border border-lime-400/20 bg-lime-400/5 p-4 text-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-lime-200">{couponOffer.coupon.title}</p>
                    <p className="mt-1 text-slate-300">
                      You save {formatCurrency(couponOffer.discount)}. Final bill estimate is {formatCurrency(couponOffer.finalTotal)}.
                    </p>
                  </div>
                  <button type="button" className="text-xs font-semibold text-rose-300" onClick={removeCoupon}>
                    Remove
                  </button>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="glass rounded-[2rem] p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">Contact Details</h2>
            <div>
              <label className="label">Full name</label>
              <input
                className="input"
                required
                value={contact.contactName}
                onChange={(e) => setContact((p) => ({ ...p, contactName: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                required
                value={contact.contactEmail}
                onChange={(e) => setContact((p) => ({ ...p, contactEmail: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Phone</label>
              <input
                className="input"
                value={contact.contactPhone}
                onChange={(e) => setContact((p) => ({ ...p, contactPhone: e.target.value }))}
              />
            </div>
            {!mealSelectionComplete ? (
              <p className="rounded-[1rem] border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-200">
                Select veg or non-veg meal preference for every guest before confirming.
              </p>
            ) : null}
            <button className="btn-primary w-full disabled:opacity-50" type="submit" disabled={submitting || !mealSelectionComplete}>
              {submitting ? 'Placing Booking...' : `Confirm ${items.length} Booking${items.length > 1 ? 's' : ''}`}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

export default CheckoutPage;
