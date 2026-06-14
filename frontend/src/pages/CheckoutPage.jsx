import { TrashIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBookingCart } from '../context/BookingCartContext';
import api from '../lib/api';
import { formatCurrency, formatDate } from '../lib/formatters';

function CheckoutPage() {
  const { items, removeItem, clearCart } = useBookingCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [contact, setContact] = useState({
    contactName: '',
    contactEmail: '',
    contactPhone: '',
  });

  const [isGroupBooking, setIsGroupBooking] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

    setSubmitting(true);
    try {
      const { data } = await api.post('/bookings/multi', {
        items: items.map((item) => ({
          listingId: item.listing._id,
          startDate: item.startDate,
          endDate: item.endDate,
          guests: item.guests,
        })),
        ...contact,
        isGroupBooking,
        groupName: isGroupBooking ? groupName : '',
      });

      clearCart();
      toast.success(
        `${data.bookings.length} booking${data.bookings.length > 1 ? 's' : ''} placed successfully!`
      );
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to complete booking');
    } finally {
      setSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <section className="section-shell py-16 text-center">
        <p className="text-slate-400">Your cart is empty.</p>
        <button onClick={() => navigate('/browse')} className="btn-primary mt-6">
          Browse Rooms
        </button>
      </section>
    );
  }

  return (
    <section className="section-shell py-12">
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
              <div className="flex justify-between text-base font-bold text-white">
                <span>Estimated Total</span>
                <span className="text-lime-300">{formatCurrency(totalEstimate)}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Final price confirmed at check-in. Dynamic tariffs may apply.
              </p>
            </div>
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
            <button className="btn-primary w-full" type="submit" disabled={submitting}>
              {submitting ? 'Placing Booking...' : `Confirm ${items.length} Booking${items.length > 1 ? 's' : ''}`}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

export default CheckoutPage;
