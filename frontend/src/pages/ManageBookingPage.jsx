import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { payRescheduleFee } from '../lib/razorpay';
import { formatCurrency, formatDate, formatDateRange } from '../lib/formatters';
import { addDays, parseDateParam, formatDateParam } from '../lib/dateUtils';
import SectionHeader from '../components/SectionHeader';
import EmptyState from '../components/EmptyState';
import PageLoader from '../components/PageLoader';

const STATUS_STYLES = {
  pending: 'bg-amber-400/15 text-amber-300',
  confirmed: 'bg-emerald-400/15 text-emerald-300',
  cancelled: 'bg-rose-400/15 text-rose-300',
};

const PAYMENT_STYLES = {
  pending: 'bg-amber-400/15 text-amber-300',
  paid: 'bg-emerald-400/15 text-emerald-300',
  failed: 'bg-rose-400/15 text-rose-300',
  refunded: 'bg-slate-400/15 text-slate-300',
  partially_refunded: 'bg-slate-400/15 text-slate-300',
};

function ManageBookingPage() {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    document.title = 'Bowline | Manage Booking';
  }, []);

  const runLookup = async (value) => {
    const trimmed = value.trim();
    if (!trimmed) {
      toast.error('Enter your email, phone number, or booking ID');
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/bookings/lookup', { query: trimmed });
      setBookings(data.bookings || []);
      setSearched(true);
      if (!data.bookings?.length) {
        toast.error('No bookings found for that search');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to find bookings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (searchParams.get('q')) {
      runLookup(searchParams.get('q'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (event) => {
    event.preventDefault();
    runLookup(query);
  };

  const refreshBooking = (updated) => {
    setBookings((prev) => prev.map((booking) => (booking._id === updated._id ? updated : booking)));
  };

  return (
    <section className="section-shell space-y-8 py-12">
      <SectionHeader
        eyebrow="Manage Booking"
        title="Find your stay"
        description="Enter the email, phone number, or booking ID you used at checkout to view, cancel, or reschedule your booking."
      />

      <form onSubmit={handleSubmit} className="glass flex flex-col gap-3 rounded-[1.5rem] p-4 sm:flex-row">
        <input
          className="input flex-1"
          placeholder="Email, phone, or booking ID"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? 'Searching...' : 'Find booking'}
        </button>
      </form>

      {loading ? (
        <PageLoader label="Looking up your booking..." />
      ) : searched && bookings.length === 0 ? (
        <EmptyState
          title="No bookings found"
          description="Double-check the email, phone number, or booking ID and try again."
        />
      ) : (
        <div className="space-y-6">
          {bookings.map((booking) => (
            <BookingCard key={booking._id} booking={booking} onUpdated={refreshBooking} />
          ))}
        </div>
      )}
    </section>
  );
}

function BookingCard({ booking, onUpdated }) {
  const [cancelling, setCancelling] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [newStart, setNewStart] = useState(parseDateParam(booking.startDate));
  const [newEnd, setNewEnd] = useState(addDays(parseDateParam(booking.startDate), 1));
  const [quote, setQuote] = useState(null);
  const [quoting, setQuoting] = useState(false);

  const contact = booking.contactEmail || booking.contactPhone;

  const handleCancel = async () => {
    const refundNote =
      booking.cancellationRefundPercent === 100
        ? 'You will receive a full refund.'
        : booking.cancellationRefundPercent === 50
          ? 'You will receive a 50% refund.'
          : 'This booking is not eligible for a refund.';

    if (!window.confirm(`Cancel this booking? ${refundNote}`)) {
      return;
    }

    setCancelling(true);
    try {
      const { data } = await api.patch(`/bookings/${booking._id}/cancel`, { contact });
      toast.success('Booking cancelled');
      onUpdated(data.booking);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to cancel booking');
    } finally {
      setCancelling(false);
    }
  };

  const fetchQuote = async (start, end) => {
    setQuoting(true);
    setQuote(null);
    try {
      const { data } = await api.post(`/bookings/${booking._id}/reschedule/quote`, {
        contact,
        startDate: formatDateParam(start),
        endDate: formatDateParam(end),
      });
      setQuote(data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to fetch reschedule quote');
    } finally {
      setQuoting(false);
    }
  };

  const openReschedule = () => {
    setShowReschedule(true);
    fetchQuote(newStart, newEnd);
  };

  const updateStart = (date) => {
    setNewStart(date);
    const adjustedEnd = newEnd <= date ? addDays(date, 1) : newEnd;
    setNewEnd(adjustedEnd);
    fetchQuote(date, adjustedEnd);
  };

  const updateEnd = (date) => {
    setNewEnd(date);
    fetchQuote(newStart, date);
  };

  const confirmReschedule = async () => {
    setRescheduling(true);
    try {
      if (quote?.feeAmount > 0) {
        const { data } = await payRescheduleFee({
          bookingId: booking._id,
          contact,
          startDate: formatDateParam(newStart),
          endDate: formatDateParam(newEnd),
        });
        toast.success('Booking rescheduled');
        onUpdated(data.booking);
      } else {
        const { data } = await api.patch(`/bookings/${booking._id}/reschedule`, {
          contact,
          startDate: formatDateParam(newStart),
          endDate: formatDateParam(newEnd),
        });
        toast.success('Booking rescheduled');
        onUpdated(data.booking);
      }
      setShowReschedule(false);
      setQuote(null);
    } catch (error) {
      if (error.message === 'PAYMENT_CANCELLED') {
        toast.error('Payment cancelled');
      } else {
        toast.error(error.response?.data?.message || 'Unable to reschedule booking');
      }
    } finally {
      setRescheduling(false);
    }
  };

  return (
    <div className="glass rounded-[2rem] p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Booking ID: {booking._id}</p>
          <h3 className="mt-2 text-2xl font-semibold text-white">{booking.listing?.name}</h3>
          <p className="mt-1 text-sm text-slate-300">{formatDateRange(booking.startDate, booking.endDate)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${STATUS_STYLES[booking.status] || 'bg-slate-400/15 text-slate-300'}`}>
            {booking.status}
          </span>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${PAYMENT_STYLES[booking.paymentStatus] || 'bg-slate-400/15 text-slate-300'}`}>
            {booking.paymentStatus?.replace('_', ' ')}
          </span>
          {booking.rescheduled ? (
            <span className="rounded-full bg-sky-400/15 px-3 py-1 text-xs font-semibold text-sky-300">Rescheduled</span>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <div className="rounded-[1.25rem] bg-slate-900/70 p-4">
          <p className="text-sm text-slate-400">Total price</p>
          <p className="mt-1 text-lg font-semibold text-lime-200">{formatCurrency(booking.totalPrice)}</p>
        </div>
        <div className="rounded-[1.25rem] bg-slate-900/70 p-4">
          <p className="text-sm text-slate-400">Guests</p>
          <p className="mt-1 text-lg font-semibold text-white">{booking.guests}</p>
        </div>
        <div className="rounded-[1.25rem] bg-slate-900/70 p-4">
          <p className="text-sm text-slate-400">Contact</p>
          <p className="mt-1 text-sm font-medium text-white">{booking.contactName}</p>
          <p className="text-xs text-slate-400">{booking.contactPhone || booking.contactEmail}</p>
        </div>
      </div>

      {booking.refundAmount > 0 ? (
        <p className="mt-4 text-sm text-slate-300">
          Refund issued: {formatCurrency(booking.refundAmount)} ({booking.refundPercentage}%)
        </p>
      ) : null}

      {booking.status !== 'cancelled' ? (
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            className="btn-secondary"
            onClick={handleCancel}
            disabled={cancelling || !booking.cancellationAllowed}
          >
            {cancelling ? 'Cancelling...' : 'Cancel booking'}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => (showReschedule ? setShowReschedule(false) : openReschedule())}
            disabled={!booking.rescheduleAllowed}
          >
            {showReschedule ? 'Close reschedule' : 'Reschedule'}
          </button>
        </div>
      ) : null}

      {!booking.cancellationAllowed && booking.status !== 'cancelled' ? (
        <p className="mt-3 text-xs text-slate-400">
          {booking.rescheduled
            ? 'This booking has already been rescheduled, so cancellation is no longer available.'
            : 'This booking is no longer eligible for cancellation (less than 7 days before check-in).'}
        </p>
      ) : null}

      {!booking.rescheduleAllowed && booking.status !== 'cancelled' ? (
        <p className="mt-3 text-xs text-slate-400">
          Rescheduling is not permitted within 7 days of the check-in date.
        </p>
      ) : null}

      {showReschedule ? (
        <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-slate-900/60 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">New check-in date</label>
              <DatePicker selected={newStart} onChange={updateStart} className="input" minDate={addDays(new Date(), 1)} />
            </div>
            <div>
              <label className="label">New check-out date</label>
              <DatePicker selected={newEnd} onChange={updateEnd} className="input" minDate={addDays(newStart, 1)} />
            </div>
          </div>

          {quoting ? (
            <p className="mt-4 text-sm text-slate-400">Checking availability and price...</p>
          ) : quote ? (
            <div className="mt-4 space-y-2 text-sm">
              <p className="text-slate-300">
                New total: <span className="font-semibold text-lime-200">{formatCurrency(quote.newTotalPrice)}</span>
              </p>
              {quote.feeAmount > 0 ? (
                <p className="text-amber-300">
                  Reschedule fee ({quote.feePercent}%): {formatCurrency(quote.feeAmount)}
                </p>
              ) : (
                <p className="text-emerald-300">No reschedule fee applies.</p>
              )}
            </div>
          ) : null}

          <button
            type="button"
            className="btn-primary mt-4"
            onClick={confirmReschedule}
            disabled={rescheduling || quoting || !quote}
          >
            {rescheduling
              ? 'Processing...'
              : quote?.feeAmount > 0
                ? 'Pay fee & confirm'
                : 'Confirm reschedule'}
          </button>
        </div>
      ) : null}

      <p className="mt-4 text-xs text-slate-500">Last updated {formatDate(booking.updatedAt || booking.createdAt)}</p>
    </div>
  );
}

export default ManageBookingPage;
