import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { formatCurrency, formatDate } from '../lib/formatters';
import PageLoader from '../components/PageLoader';
import SectionHeader from '../components/SectionHeader';

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

      <div className="space-y-4">
        {bookings.map((booking) => (
          <div key={booking._id} className="glass rounded-[2rem] p-5">
            <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{booking.bookingType}</p>
                <h3 className="mt-2 text-xl font-semibold text-white">{booking.listing?.name}</h3>
                <p className="mt-2 text-sm text-slate-300">
                  {booking.user?.name} • {booking.user?.email} • {formatDate(booking.startDate)}
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  Contact: {booking.contactName} • {booking.contactPhone || 'No phone'}
                </p>
                <p className="mt-2 text-sm text-slate-300">Special requests: {booking.specialRequests || 'None'}</p>
              </div>
              <div className="space-y-3">
                <div className="rounded-[1.5rem] bg-slate-900/70 p-4">
                  <p className="text-sm text-slate-400">Estimated value</p>
                  <p className="mt-2 text-xl font-semibold text-lime-200">{formatCurrency(booking.totalPrice)}</p>
                  <p className="mt-2 text-sm text-slate-400">{booking.status}</p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <button className="btn-primary" onClick={() => updateBooking(booking._id, { status: 'confirmed' })}>
                    Confirm
                  </button>
                  <button className="btn-secondary" onClick={() => updateBooking(booking._id, { status: 'cancelled' })}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AdminBookingsPage;
