import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDateRange } from '../lib/formatters';
import PageLoader from '../components/PageLoader';
import EmptyState from '../components/EmptyState';
import SectionHeader from '../components/SectionHeader';

function UserDashboardPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [bookingRes, notificationRes] = await Promise.all([
        api.get('/bookings/me'),
        api.get('/notifications'),
      ]);
      setBookings(bookingRes.data.bookings);
      setNotifications(notificationRes.data.notifications);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Bowline | My Dashboard';
    fetchData();
  }, []);

  const cancelBooking = async (bookingId) => {
    try {
      await api.patch(`/bookings/me/${bookingId}/cancel`);
      toast.success('Booking cancelled');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to cancel booking');
    }
  };

  const bookingStats = useMemo(
    () =>
      bookings.reduce(
        (stats, booking) => {
          stats.total += 1;
          stats.estimatedValue += booking.totalPrice;
          stats[booking.status] = (stats[booking.status] || 0) + 1;
          return stats;
        },
        {
          total: 0,
          estimatedValue: 0,
          pending: 0,
          confirmed: 0,
          cancelled: 0,
        }
      ),
    [bookings]
  );

  const bookingsByStatus = useMemo(
    () =>
      bookings.reduce(
        (groups, booking) => {
          groups[booking.status].push(booking);
          return groups;
        },
        { pending: [], confirmed: [], cancelled: [] }
      ),
    [bookings]
  );

  if (loading) {
    return <PageLoader label="Loading your dashboard..." />;
  }

  return (
    <section className="section-shell space-y-8 py-12">
      <SectionHeader
        eyebrow="User Dashboard"
        title={`Hello, ${user?.name?.split(' ')[0] || 'Explorer'}`}
        description="Track your booking status, stay dates, and full booking details in one place."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="glass rounded-[1.5rem] p-5">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Total bookings</p>
          <p className="mt-2 text-3xl font-bold text-[#f5f0dd]">{bookingStats.total}</p>
        </div>
        <div className="glass rounded-[1.5rem] p-5">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Pending</p>
          <p className="mt-2 text-3xl font-bold text-amber-300">{bookingStats.pending}</p>
        </div>
        <div className="glass rounded-[1.5rem] p-5">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Confirmed</p>
          <p className="mt-2 text-3xl font-bold text-emerald-300">{bookingStats.confirmed}</p>
        </div>
        <div className="glass rounded-[1.5rem] p-5">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Estimated total value</p>
          <p className="mt-2 text-3xl font-bold text-lime-200">{formatCurrency(bookingStats.estimatedValue)}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.55fr]">
        <div className="space-y-6">
          {bookings.length ? (
            <>
              <BookingGroup
                title="Pending requests"
                bookings={bookingsByStatus.pending}
                emptyTitle="No pending bookings"
                emptyDescription="Any new booking request will appear here before admin confirmation."
                onCancel={cancelBooking}
              />
              <BookingGroup
                title="Confirmed bookings"
                bookings={bookingsByStatus.confirmed}
                emptyTitle="No confirmed bookings yet"
                emptyDescription="Once admin confirms a request, it appears here with full stay details."
                onCancel={cancelBooking}
              />
              <BookingGroup
                title="Cancelled bookings"
                bookings={bookingsByStatus.cancelled}
                emptyTitle="No cancelled bookings"
                emptyDescription="Cancelled requests are archived here for reference."
                onCancel={cancelBooking}
              />
            </>
          ) : (
            <div className="glass rounded-[2rem] p-6">
              <EmptyState
                title="No bookings yet"
                description="Once a booking request is created, it will appear here with complete date and contact details."
              />
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="glass rounded-[2rem] p-6">
            <h2 className="text-2xl font-semibold text-white">Account snapshot</h2>
            <div className="mt-5 space-y-3 text-sm">
              <div className="rounded-[1rem] bg-slate-900/70 px-4 py-3">
                <p className="text-slate-400">Name</p>
                <p className="mt-1 font-medium text-white">{user?.name || 'Not available'}</p>
              </div>
              <div className="rounded-[1rem] bg-slate-900/70 px-4 py-3">
                <p className="text-slate-400">Email</p>
                <p className="mt-1 font-medium text-white">{user?.email || 'Not available'}</p>
              </div>
              <div className="rounded-[1rem] bg-slate-900/70 px-4 py-3">
                <p className="text-slate-400">Phone</p>
                <p className="mt-1 font-medium text-white">{user?.phone || 'Not provided'}</p>
              </div>
            </div>
          </div>

          <div className="glass rounded-[2rem] p-6">
            <h2 className="text-2xl font-semibold text-white">Notifications</h2>
            <div className="mt-5 space-y-3">
              {notifications.length ? (
                notifications.slice(0, 6).map((notification) => (
                  <div key={notification._id} className="rounded-[1.25rem] bg-slate-900/70 p-4">
                    <p className="font-medium text-white">{notification.title}</p>
                    <p className="mt-2 text-sm text-slate-300">{notification.message}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400">No notifications yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function BookingGroup({
  title,
  bookings,
  emptyTitle,
  emptyDescription,
  onCancel,
}) {
  return (
    <section className="glass rounded-[2rem] p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-white">{title}</h2>
        <span className="rounded-full border border-lime-100/10 px-3 py-1 text-sm text-[#c4cec0]">
          {bookings.length}
        </span>
      </div>

      <div className="mt-6 space-y-4">
        {bookings.length ? (
          bookings.map((booking) => (
            <article key={booking._id} className="rounded-[1.5rem] bg-slate-900/70 p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-slate-500">{booking.bookingType}</p>
                  <h3 className="mt-2 text-xl font-semibold text-white">{booking.listing?.name}</h3>
                  <p className="mt-2 text-sm text-slate-400">{booking.listing?.location}</p>
                  <p className="mt-2 text-sm text-slate-300">
                    Stay dates: {formatDateRange(booking.startDate, booking.endDate)}
                  </p>
                  <p className="mt-1 text-sm text-slate-300">Guests: {booking.guests}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    Contact: {booking.contactName} • {booking.contactPhone || booking.contactEmail}
                  </p>
                  {booking.specialRequests ? (
                    <p className="mt-1 text-sm text-slate-400">Special request: {booking.specialRequests}</p>
                  ) : null}
                </div>
                <div className="text-left md:text-right">
                  <p className="text-lg font-bold text-lime-200">{formatCurrency(booking.totalPrice)}</p>
                  <p className="mt-1 text-sm capitalize text-slate-400">{booking.status}</p>
                </div>
              </div>

              {booking.status !== 'cancelled' ? (
                <button className="btn-secondary mt-4" onClick={() => onCancel(booking._id)}>
                  Cancel Booking
                </button>
              ) : null}
            </article>
          ))
        ) : (
          <EmptyState title={emptyTitle} description={emptyDescription} />
        )}
      </div>
    </section>
  );
}

export default UserDashboardPage;
