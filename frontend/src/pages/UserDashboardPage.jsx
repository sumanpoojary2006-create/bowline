import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate } from '../lib/formatters';
import PageLoader from '../components/PageLoader';
import EmptyState from '../components/EmptyState';
import SectionHeader from '../components/SectionHeader';

function UserDashboardPage() {
  const { user, updateProfile } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    avatar: user?.avatar || '',
  });

  useEffect(() => {
    setProfile({
      name: user?.name || '',
      phone: user?.phone || '',
      avatar: user?.avatar || '',
    });
  }, [user]);

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

  const saveProfile = async (event) => {
    event.preventDefault();
    await updateProfile(profile);
  };

  if (loading) {
    return <PageLoader label="Loading your dashboard..." />;
  }

  return (
    <section className="section-shell space-y-8 py-12">
      <SectionHeader
        eyebrow="User Dashboard"
        title={`Hello, ${user?.name?.split(' ')[0] || 'Explorer'}`}
        description="Track bookings, manage your profile, and keep up with booking notifications from one place."
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="glass rounded-[2rem] p-6">
          <h2 className="text-2xl font-semibold text-white">My bookings</h2>
          <div className="mt-6 space-y-4">
            {bookings.length ? (
              bookings.map((booking) => (
                <div key={booking._id} className="rounded-[1.5rem] bg-slate-900/70 p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm uppercase tracking-[0.2em] text-slate-500">{booking.bookingType}</p>
                      <h3 className="mt-2 text-xl font-semibold text-white">{booking.listing?.name}</h3>
                      <p className="mt-2 text-sm text-slate-300">
                        {formatDate(booking.startDate)} to {formatDate(booking.endDate)} • {booking.guests} guests
                      </p>
                    </div>
                    <div className="text-left md:text-right">
                      <p className="text-lg font-bold text-amber-300">{formatCurrency(booking.totalPrice)}</p>
                      <p className="text-sm text-slate-400">
                        {booking.status} / {booking.paymentStatus}
                      </p>
                    </div>
                  </div>
                  {booking.status !== 'cancelled' ? (
                    <button className="btn-secondary mt-4" onClick={() => cancelBooking(booking._id)}>
                      Cancel Booking
                    </button>
                  ) : null}
                </div>
              ))
            ) : (
              <EmptyState title="No bookings yet" description="Once a booking is created, it will appear here with payment and status details." />
            )}
          </div>
        </div>

        <div className="space-y-6">
          <form className="glass rounded-[2rem] p-6" onSubmit={saveProfile}>
            <h2 className="text-2xl font-semibold text-white">Profile</h2>
            <div className="mt-5 space-y-4">
              <div>
                <label className="label">Name</label>
                <input
                  className="input"
                  value={profile.name}
                  onChange={(event) => setProfile((prev) => ({ ...prev, name: event.target.value }))}
                />
              </div>
              <div>
                <label className="label">Phone</label>
                <input
                  className="input"
                  value={profile.phone}
                  onChange={(event) => setProfile((prev) => ({ ...prev, phone: event.target.value }))}
                />
              </div>
              <div>
                <label className="label">Avatar URL</label>
                <input
                  className="input"
                  value={profile.avatar}
                  onChange={(event) => setProfile((prev) => ({ ...prev, avatar: event.target.value }))}
                />
              </div>
              <button className="btn-primary w-full" type="submit">
                Save Profile
              </button>
            </div>
          </form>

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

export default UserDashboardPage;
