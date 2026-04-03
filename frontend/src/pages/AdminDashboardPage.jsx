import { useEffect, useState } from 'react';
import api from '../lib/api';
import { formatCurrency, formatDate } from '../lib/formatters';
import PageLoader from '../components/PageLoader';
import SectionHeader from '../components/SectionHeader';
import StatsCard from '../components/StatsCard';

function AdminDashboardPage() {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Bowline Admin | Overview';
    const fetchOverview = async () => {
      try {
        const { data } = await api.get('/admin/overview');
        setPayload(data);
      } finally {
        setLoading(false);
      }
    };

    fetchOverview();
  }, []);

  if (loading) {
    return <PageLoader label="Loading admin overview..." />;
  }

  const { overview, notifications } = payload;

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Admin Dashboard"
        title="Command center for inventory and bookings"
        description="A high-level view of booking requests, estimated booking value, notifications, and active Bowline inventory."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatsCard label="Total bookings" value={overview.totalBookings} />
        <StatsCard label="Estimated booking value" value={formatCurrency(overview.revenue)} />
        <StatsCard label="Active listings" value={overview.activeListings} />
        <StatsCard label="Active users" value={overview.activeUsers} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="glass rounded-[2rem] p-6">
          <h2 className="text-2xl font-semibold text-white">Upcoming bookings</h2>
          <div className="mt-5 space-y-4">
            {overview.upcomingBookings.map((booking) => (
              <div key={booking._id} className="rounded-[1.5rem] bg-slate-900/70 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-white">{booking.listing?.name}</p>
                    <p className="mt-2 text-sm text-slate-300">
                      {booking.user?.name} • {formatDate(booking.startDate)}
                    </p>
                  </div>
                  <div className="text-right text-sm text-slate-400">
                    <p>{booking.status}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass rounded-[2rem] p-6">
          <h2 className="text-2xl font-semibold text-white">Admin alerts</h2>
          <div className="mt-5 space-y-3">
            {notifications.map((notification) => (
              <div key={notification._id} className="rounded-[1.5rem] bg-slate-900/70 p-4">
                <p className="font-semibold text-white">{notification.title}</p>
                <p className="mt-2 text-sm text-slate-300">{notification.message}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboardPage;
