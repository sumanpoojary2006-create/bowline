import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { formatCurrency, formatDateRange } from '../lib/formatters';
import PageLoader from '../components/PageLoader';
import SectionHeader from '../components/SectionHeader';
import EmptyState from '../components/EmptyState';

const statusSections = [
  { key: 'pending', title: 'Pending bookings', emptyTitle: 'No pending bookings' },
  { key: 'confirmed', title: 'Confirmed bookings', emptyTitle: 'No confirmed bookings' },
  { key: 'cancelled', title: 'Cancelled bookings', emptyTitle: 'No cancelled bookings' },
];

function AdminBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    type: '',
    status: '',
  });

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/bookings/admin/all', {
        params: Object.fromEntries(Object.entries(filters).filter(([, value]) => value)),
      });
      setBookings(data.bookings);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Bowline Admin | Bookings';
    fetchBookings();
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [filters.type, filters.status]);

  const updateBooking = async (id, patch) => {
    try {
      await api.patch(`/bookings/admin/${id}`, patch);
      toast.success('Booking updated');
      fetchBookings();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to update booking');
    }
  };

  const estimatedValue = useMemo(() => bookings.reduce((sum, booking) => sum + booking.totalPrice, 0), [bookings]);
  const groupedBookings = useMemo(
    () =>
      bookings.reduce(
        (acc, booking) => {
          acc[booking.status] = [...(acc[booking.status] || []), booking];
          return acc;
        },
        { pending: [], confirmed: [], cancelled: [] }
      ),
    [bookings]
  );
  const visibleSections = useMemo(() => {
    if (filters.status) {
      return statusSections.filter((section) => section.key === filters.status);
    }

    return statusSections;
  }, [filters.status]);

  if (loading) {
    return <PageLoader label="Loading bookings..." />;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Booking Management"
        title="Track and moderate every reservation"
        description={`Current filtered booking value: ${formatCurrency(estimatedValue)}`}
      />

      <div className="grid gap-4 rounded-[2rem] border border-lime-100/10 bg-[#0d1710]/70 p-4 md:grid-cols-2">
        <select className="input" value={filters.type} onChange={(event) => setFilters((prev) => ({ ...prev, type: event.target.value }))}>
          <option value="">All types</option>
          <option value="room">Rooms</option>
          <option value="trek">Treks</option>
          <option value="camp">Camps</option>
        </select>
        <select className="input" value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="space-y-8">
        {visibleSections.map((section) => {
          const sectionBookings = groupedBookings[section.key] || [];

          return (
            <section key={section.key} className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-2xl font-semibold text-white">{section.title}</h3>
                <span className="rounded-full border border-lime-100/10 px-4 py-2 text-sm text-[#c4cec0]">
                  {sectionBookings.length}
                </span>
              </div>

              {sectionBookings.length ? (
                <div className="space-y-4">
                  {sectionBookings.map((booking) => (
                    <div key={booking._id} className="glass rounded-[2rem] p-5">
                      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                        <div>
                          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{booking.bookingType}</p>
                          <h3 className="mt-2 text-xl font-semibold text-white">{booking.listing?.name}</h3>
                          <p className="mt-2 text-sm text-slate-300">{booking.user?.name} • {booking.user?.email}</p>
                          <p className="mt-2 text-sm text-slate-300">Stay dates: {formatDateRange(booking.startDate, booking.endDate)}</p>
                          <p className="mt-2 text-sm text-slate-400">
                            Contact: {booking.contactName} • {booking.contactPhone || 'No phone'}
                          </p>
                          <p className="mt-2 text-sm text-slate-300">Special requests: {booking.specialRequests || 'None'}</p>
                        </div>
                        <div className="space-y-3">
                          <div className="rounded-[1.5rem] bg-slate-900/70 p-4">
                            <p className="text-sm text-slate-400">Estimated value</p>
                            <p className="mt-2 text-xl font-semibold text-lime-200">{formatCurrency(booking.totalPrice)}</p>
                            <p className="mt-2 text-sm capitalize text-slate-400">{booking.status}</p>
                          </div>

                          {section.key === 'pending' ? (
                            <div className="grid gap-3 md:grid-cols-2">
                              <button className="btn-primary" onClick={() => updateBooking(booking._id, { status: 'confirmed' })}>
                                Confirm
                              </button>
                              <button className="btn-secondary" onClick={() => updateBooking(booking._id, { status: 'cancelled' })}>
                                Cancel
                              </button>
                            </div>
                          ) : section.key === 'confirmed' ? (
                            <button className="btn-secondary w-full" onClick={() => updateBooking(booking._id, { status: 'cancelled' })}>
                              Move to Cancelled
                            </button>
                          ) : (
                            <div className="rounded-[1.25rem] border border-lime-100/10 bg-[#0d1710]/70 px-4 py-3 text-sm text-[#c4cec0]">
                              This booking is archived under cancelled bookings.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title={section.emptyTitle} description={`Bookings marked as ${section.key} will appear here automatically.`} />
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

export default AdminBookingsPage;
