import { useEffect, useState } from 'react';
import {
  BanknotesIcon,
  BellAlertIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import api from '../lib/api';
import { formatCurrency, formatDate } from '../lib/formatters';
import PageLoader from '../components/PageLoader';
import SectionHeader from '../components/SectionHeader';
import EmptyState from '../components/EmptyState';

const TYPE_LABELS = {
  room: 'Stays',
  trek: 'Treks',
  camp: 'Camps',
};

function timeAgo(value) {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diffMs / (1000 * 60));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function StatCard({ icon: Icon, label, value, hint }) {
  return (
    <div className="glass rounded-[2rem] p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-lime-200/10 text-lime-200">
          <Icon className="h-5 w-5" />
        </div>
        <p className="text-sm text-[#b7c2b2]">{label}</p>
      </div>
      <p className="mt-4 text-3xl font-bold text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-lime-100/45">{hint}</p> : null}
    </div>
  );
}

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
  const breakdownEntries = Object.entries(overview.breakdown || {}).filter(([, count]) => count > 0);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Admin Dashboard"
        title="Command center"
        description="A snapshot of confirmed bookings, revenue, and what needs your attention."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={CalendarDaysIcon} label="Total bookings" value={overview.totalBookings} />
        <StatCard icon={BanknotesIcon} label="Estimated booking value" value={formatCurrency(overview.revenue)} />
        <StatCard icon={BuildingOffice2Icon} label="Active listings" value={overview.activeListings} />
        <StatCard icon={UsersIcon} label="Active users" value={overview.activeUsers} />
      </div>

      {breakdownEntries.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {breakdownEntries.map(([type, count]) => (
            <div key={type} className="glass rounded-full px-4 py-2 text-sm text-[#cdd6c9]">
              <span className="font-semibold text-white">{count}</span> {TYPE_LABELS[type] || type}
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="glass rounded-[2rem] p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-white">Upcoming bookings</h2>
            <span className="rounded-full bg-lime-200/10 px-3 py-1 text-xs font-semibold text-lime-200">
              Confirmed
            </span>
          </div>

          <div className="mt-5 space-y-3">
            {overview.upcomingBookings.length === 0 ? (
              <EmptyState
                title="Nothing on the horizon"
                description="Confirmed bookings with an upcoming check-in date will show up here."
              />
            ) : (
              overview.upcomingBookings.map((booking) => (
                <div
                  key={booking._id}
                  className="flex items-center justify-between gap-4 rounded-[1.5rem] bg-slate-900/70 p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-lime-200/10 text-lime-200">
                      <CalendarDaysIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-white">{booking.listing?.name}</p>
                      <p className="mt-1 text-sm text-slate-400">{booking.user?.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-white">{formatDate(booking.startDate)}</p>
                    <p className="mt-1 text-xs text-slate-400">{formatCurrency(booking.totalPrice)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="glass rounded-[2rem] p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-white">Admin alerts</h2>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-lime-200/10 text-lime-200">
              <BellAlertIcon className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {notifications.length === 0 ? (
              <EmptyState title="All quiet" description="New booking and payment alerts will show up here." />
            ) : (
              notifications.map((notification) => (
                <div key={notification._id} className="rounded-[1.5rem] bg-slate-900/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-white">{notification.title}</p>
                    <p className="shrink-0 text-xs text-slate-500">{timeAgo(notification.createdAt)}</p>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{notification.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboardPage;
