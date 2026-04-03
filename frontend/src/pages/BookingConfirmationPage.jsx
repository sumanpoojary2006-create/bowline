import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import api from '../lib/api';
import { formatCurrency, formatDate } from '../lib/formatters';
import PageLoader from '../components/PageLoader';

function BookingConfirmationPage() {
  const { id } = useParams();
  const location = useLocation();
  const [booking, setBooking] = useState(location.state?.booking || null);
  const [loading, setLoading] = useState(!location.state?.booking);

  useEffect(() => {
    document.title = 'Bowline | Booking Confirmed';

    if (booking) return;

    const fetchBooking = async () => {
      try {
        const { data } = await api.get('/bookings/me');
        const matched = data.bookings.find((item) => item._id === id);
        setBooking(matched || null);
      } finally {
        setLoading(false);
      }
    };

    fetchBooking();
  }, [booking, id]);

  if (loading) {
    return <PageLoader label="Loading booking confirmation..." />;
  }

  if (!booking) {
    return (
      <section className="section-shell py-16">
        <div className="glass rounded-[2rem] p-8 text-center">
          <h1 className="text-3xl font-semibold text-white">Booking not found</h1>
          <Link className="btn-primary mt-6" to="/dashboard">
            Go to dashboard
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="section-shell py-16">
      <div className="mx-auto max-w-3xl glass rounded-[2.5rem] p-8">
        <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Booking received</p>
        <h1 className="mt-4 font-display text-5xl text-white">Your Bowline plan is in motion</h1>
        <p className="mt-4 text-[#c1cbbd]">
          Your reservation request has been received. Bowline will review the dates and follow up manually. No online payment was collected here.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-[1.5rem] bg-slate-900/70 p-5">
            <p className="text-sm text-slate-400">Experience</p>
            <p className="mt-2 text-xl font-semibold text-white">{booking.listing?.name}</p>
          </div>
          <div className="rounded-[1.5rem] bg-slate-900/70 p-5">
            <p className="text-sm text-slate-400">Estimated booking value</p>
            <p className="mt-2 text-xl font-semibold text-lime-200">{formatCurrency(booking.totalPrice)}</p>
          </div>
          <div className="rounded-[1.5rem] bg-slate-900/70 p-5">
            <p className="text-sm text-slate-400">Dates</p>
            <p className="mt-2 text-white">
              {formatDate(booking.startDate)} to {formatDate(booking.endDate)}
            </p>
          </div>
          <div className="rounded-[1.5rem] bg-slate-900/70 p-5">
            <p className="text-sm text-slate-400">Status</p>
            <p className="mt-2 text-white">{booking.status}</p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link className="btn-primary" to="/dashboard">
            View my bookings
          </Link>
          <Link className="btn-secondary" to="/">
            Back to home
          </Link>
        </div>
      </div>
    </section>
  );
}

export default BookingConfirmationPage;
