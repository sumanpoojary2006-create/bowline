import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { formatCurrency, formatDateRange } from '../lib/formatters';
import { addDays, formatDateParam } from '../lib/dateUtils';
import PageLoader from '../components/PageLoader';
import SectionHeader from '../components/SectionHeader';
import EmptyState from '../components/EmptyState';

function CancelRefundDialog({ booking, onClose, onDone }) {
  const [refundPercent, setRefundPercent] = useState(100);
  const [loading, setLoading] = useState(false);
  const isPaid = booking.paymentStatus === 'paid';
  const refundAmount = isPaid ? Math.round(booking.totalPrice * refundPercent / 100) : 0;

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await api.post(`/bookings/admin/${booking._id}/cancel-refund`, { refundPercent: isPaid ? refundPercent : 0 });
      toast.success(isPaid && refundPercent > 0 ? `Booking cancelled · ₹${refundAmount} refund initiated` : 'Booking cancelled');
      onDone();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to cancel booking');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-[2rem] border border-lime-100/10 bg-[#0d1710] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl font-semibold text-white">Cancel booking</h3>
        <p className="mt-1 text-sm text-slate-400">{booking.contactName} · {booking.listing?.name}</p>
        <p className="mt-1 text-sm text-slate-400">Total paid: {formatCurrency(booking.totalPrice)} · Status: {booking.paymentStatus}</p>

        {isPaid ? (
          <div className="mt-5 space-y-3">
            <label className="text-sm font-semibold text-white">Refund percentage</label>
            <div className="flex gap-2">
              {[0, 50, 100].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  className={`flex-1 rounded-[1rem] border py-2 text-sm font-semibold transition ${refundPercent === pct ? 'border-lime-400 bg-lime-400/20 text-lime-200' : 'border-white/10 text-slate-400 hover:border-white/30'}`}
                  onClick={() => setRefundPercent(pct)}
                >
                  {pct}%
                </button>
              ))}
            </div>
            <input
              type="number"
              min="0"
              max="100"
              className="input"
              value={refundPercent}
              onChange={(e) => setRefundPercent(Math.min(100, Math.max(0, Number(e.target.value))))}
            />
            <p className="text-sm text-slate-300">
              Refund amount: <span className="font-semibold text-lime-200">{formatCurrency(refundAmount)}</span>
              {refundPercent === 0 && <span className="ml-2 text-slate-400">(no refund)</span>}
            </p>
          </div>
        ) : (
          <p className="mt-4 rounded-[1rem] border border-white/10 bg-slate-900/50 px-4 py-3 text-sm text-slate-400">
            Payment status is <span className="capitalize text-white">{booking.paymentStatus}</span> — no refund will be processed.
          </p>
        )}

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button className="btn-secondary" onClick={onClose} disabled={loading}>Back</button>
          <button className="btn-primary bg-rose-600 hover:bg-rose-500" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Processing…' : isPaid && refundPercent > 0 ? `Cancel & refund ${refundPercent}%` : 'Cancel booking'}
          </button>
        </div>
      </div>
    </div>
  );
}

const SOURCE_LABELS = {
  website: 'Website',
  airbnb: 'Airbnb',
  whatsapp: 'WhatsApp',
  admin: 'Admin',
  sheet: 'Sheets',
};

const statusSections = [
  { key: 'pending', title: 'Unpaid / pending bookings', emptyTitle: 'No unpaid pending bookings' },
  { key: 'confirmed', title: 'Confirmed bookings', emptyTitle: 'No confirmed bookings' },
  { key: 'cancelled', title: 'Cancelled bookings', emptyTitle: 'No cancelled bookings' },
];

function AdminBookingsPage() {
  const defaultCheckIn = formatDateParam(new Date());
  const defaultCheckOut = formatDateParam(addDays(new Date(), 1));
  const [bookings, setBookings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creatingManualBooking, setCreatingManualBooking] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [filters, setFilters] = useState({
    type: '',
    status: '',
    source: '',
  });
  const [manualForm, setManualForm] = useState({
    listingIds: [],
    startDate: defaultCheckIn,
    endDate: defaultCheckOut,
    guests: 1,
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    specialRequests: '',
    source: 'whatsapp',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [creatingGroupBooking, setCreatingGroupBooking] = useState(false);
  const [groupForm, setGroupForm] = useState({
    bundle: 'except-pent-house',
    startDate: defaultCheckIn,
    endDate: defaultCheckOut,
    adultGuests: 10,
    childGuests: 0,
    pets: 0,
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    specialRequests: '',
    source: 'whatsapp',
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

    const fetchRooms = async () => {
      try {
        const { data } = await api.get('/listings/admin/all');
        setRooms(data.listings.filter((listing) => listing.type === 'room' && listing.active));
      } catch (error) {
        toast.error(error.response?.data?.message || 'Unable to load room inventory');
      }
    };

    fetchRooms();
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [filters.type, filters.status, filters.source]);

  const updateBooking = async (id, patch) => {
    try {
      await api.patch(`/bookings/admin/${id}`, patch);
      toast.success('Booking updated');
      fetchBookings();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to update booking');
    }
  };

  const updateGuestName = async (id, currentName) => {
    const nextName = window.prompt('Guest name', currentName || '');
    if (nextName === null) return;
    const trimmed = nextName.trim();
    if (!trimmed || trimmed === currentName) return;

    try {
      await api.patch(`/bookings/admin/${id}/contact`, { contactName: trimmed });
      toast.success('Guest name updated');
      fetchBookings();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to update guest name');
    }
  };

  const selectedRooms = useMemo(
    () => rooms.filter((room) => manualForm.listingIds.includes(room._id)),
    [rooms, manualForm.listingIds]
  );
  const maxGuestsAllowed = selectedRooms.length
    ? Math.min(...selectedRooms.map((room) => room.capacity || 20))
    : 20;

  const toggleManualRoom = (roomId) => {
    setManualForm((prev) => ({
      ...prev,
      listingIds: prev.listingIds.includes(roomId)
        ? prev.listingIds.filter((id) => id !== roomId)
        : [...prev.listingIds, roomId],
    }));
  };

  const createManualBooking = async (event) => {
    event.preventDefault();
    if (!manualForm.listingIds.length) {
      toast.error('Select at least one room');
      return;
    }

    setCreatingManualBooking(true);
    try {
      const { listingIds, ...rest } = manualForm;
      // Submit sequentially, not concurrently: each booking triggers a Google
      // Sheets sync, and Apps Script has no locking — simultaneous requests
      // can silently collide and drop writes to the sheet.
      const results = [];
      for (const listingId of listingIds) {
        try {
          const response = await api.post('/bookings/admin/manual-room', {
            ...rest,
            listingId,
            guests: Number(rest.guests),
          });
          results.push({ status: 'fulfilled', value: response });
        } catch (error) {
          results.push({ status: 'rejected', reason: error });
        }
      }

      const succeeded = results.filter((result) => result.status === 'fulfilled').length;
      const failed = results.filter((result) => result.status === 'rejected');

      if (succeeded) {
        toast.success(`${succeeded} room booking${succeeded > 1 ? 's' : ''} created and confirmed`);
      }
      if (failed.length) {
        toast.error(
          `${failed.length} room${failed.length > 1 ? 's' : ''} could not be booked: ${
            failed[0].reason?.response?.data?.message || 'Unknown error'
          }`
        );
      }

      setManualForm((prev) => ({
        ...prev,
        listingIds: [],
        guests: 1,
        contactName: '',
        contactEmail: '',
        contactPhone: '',
        specialRequests: '',
      }));
      // keep prev.source so the next manual entry reuses the same channel
      fetchBookings();
    } finally {
      setCreatingManualBooking(false);
    }
  };

  const createGroupBooking = async (event) => {
    event.preventDefault();
    setCreatingGroupBooking(true);
    try {
      const payload = {
        ...groupForm,
        adultGuests: Number(groupForm.adultGuests),
        childGuests: Number(groupForm.childGuests),
        pets: Number(groupForm.pets),
      };

      const { data } = await api.post('/bookings/admin/manual-group', payload);
      toast.success(`Group booking created — ${data.bookings.length} room(s) confirmed and blocked`);
      setGroupForm((prev) => ({
        ...prev,
        adultGuests: 10,
        childGuests: 0,
        pets: 0,
        contactName: '',
        contactEmail: '',
        contactPhone: '',
        specialRequests: '',
      }));
      fetchBookings();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to create group booking');
    } finally {
      setCreatingGroupBooking(false);
    }
  };

  const filteredBookings = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return bookings;

    return bookings.filter((booking) => {
      const haystack = [
        booking.contactName,
        booking.contactEmail,
        booking.contactPhone,
        booking.listing?.name,
        booking.user?.name,
        booking.user?.email,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [bookings, searchQuery]);

  const estimatedValue = useMemo(
    () => filteredBookings.reduce((sum, booking) => sum + booking.totalPrice, 0),
    [filteredBookings]
  );
  const groupedBookings = useMemo(
    () =>
      filteredBookings.reduce(
        (acc, booking) => {
          acc[booking.status] = [...(acc[booking.status] || []), booking];
          return acc;
        },
        { pending: [], confirmed: [], cancelled: [] }
      ),
    [filteredBookings]
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
      {cancelTarget && (
        <CancelRefundDialog
          booking={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onDone={() => { setCancelTarget(null); fetchBookings(); }}
        />
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionHeader
          eyebrow="Booking Management"
          title="Track and moderate every reservation"
          description={`Current filtered booking value: ${formatCurrency(estimatedValue)}`}
        />
        <Link to="/admin/calendar" className="btn-secondary whitespace-nowrap">
          Open Room Calendar
        </Link>
      </div>

      <form className="grid gap-4 rounded-[2rem] border border-lime-100/10 bg-[#0d1710]/70 p-5" onSubmit={createManualBooking}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-white">Manual room booking</h3>
            <p className="mt-1 text-sm text-[#c4cec0]">
              Create a confirmed booking directly from admin. Once created, overlapping dates appear fully booked to users.
            </p>
          </div>
          <button className="btn-primary" type="submit" disabled={creatingManualBooking}>
            {creatingManualBooking ? 'Creating...' : 'Create & Confirm'}
          </button>
        </div>

        <div>
          <label className="label mb-2 block">Rooms (select one or more)</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {rooms.map((room) => {
              const checked = manualForm.listingIds.includes(room._id);
              return (
                <label
                  key={room._id}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm cursor-pointer transition ${
                    checked
                      ? 'border-lime-400 bg-lime-400/10 text-lime-100'
                      : 'border-white/10 text-slate-300 hover:border-white/30'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="accent-lime-400"
                    checked={checked}
                    onChange={() => toggleManualRoom(room._id)}
                  />
                  {room.name} (max {room.capacity})
                </label>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <input
            className="input"
            type="date"
            value={manualForm.startDate}
            onChange={(event) => {
              const nextStart = event.target.value;
              setManualForm((prev) => {
                const minimumCheckout = formatDateParam(addDays(new Date(nextStart), 1));
                return {
                  ...prev,
                  startDate: nextStart,
                  endDate: prev.endDate < minimumCheckout ? minimumCheckout : prev.endDate,
                };
              });
            }}
            required
          />

          <input
            className="input"
            type="date"
            value={manualForm.endDate}
            min={formatDateParam(addDays(new Date(manualForm.startDate), 1))}
            onChange={(event) => setManualForm((prev) => ({ ...prev, endDate: event.target.value }))}
            required
          />

          <input
            className="input"
            type="number"
            min="1"
            max={maxGuestsAllowed}
            value={manualForm.guests}
            onChange={(event) => setManualForm((prev) => ({ ...prev, guests: event.target.value }))}
            placeholder="Guests per room"
            required
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <input
            className="input"
            value={manualForm.contactName}
            onChange={(event) => setManualForm((prev) => ({ ...prev, contactName: event.target.value }))}
            placeholder="Guest name"
            required
          />
          <input
            className="input"
            type="email"
            value={manualForm.contactEmail}
            onChange={(event) => setManualForm((prev) => ({ ...prev, contactEmail: event.target.value }))}
            placeholder="Guest email"
            required
          />
          <input
            className="input"
            value={manualForm.contactPhone}
            onChange={(event) => setManualForm((prev) => ({ ...prev, contactPhone: event.target.value }))}
            placeholder="Guest phone"
          />
          <select
            className="input"
            value={manualForm.source}
            onChange={(event) => setManualForm((prev) => ({ ...prev, source: event.target.value }))}
          >
            <option value="whatsapp">WhatsApp</option>
            <option value="website">Website</option>
            <option value="airbnb">Airbnb</option>
            <option value="admin">Admin</option>
            <option value="sheet">Sheets</option>
          </select>
        </div>

        <textarea
          className="input min-h-24"
          value={manualForm.specialRequests}
          onChange={(event) => setManualForm((prev) => ({ ...prev, specialRequests: event.target.value }))}
          placeholder="Internal notes or guest requests"
        />
      </form>

      <form className="grid gap-4 rounded-[2rem] border border-lime-100/10 bg-[#0d1710]/70 p-5" onSubmit={createGroupBooking}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-white">Group booking</h3>
            <p className="mt-1 text-sm text-[#c4cec0]">
              Confirms every room in the bundle at once — none get missed. Use this once payment has actually been
              collected (advance/cash/UPI); every room is created confirmed and blocked immediately.
            </p>
          </div>
          <button className="btn-primary" type="submit" disabled={creatingGroupBooking}>
            {creatingGroupBooking ? 'Creating...' : 'Create & Block All Rooms'}
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <select
            className="input"
            value={groupForm.bundle}
            onChange={(event) => setGroupForm((prev) => ({ ...prev, bundle: event.target.value }))}
          >
            <option value="except-pent-house">Group Booking (all rooms except Pent House)</option>
            <option value="full-house">Full House (all rooms)</option>
          </select>

          <input
            className="input"
            type="date"
            value={groupForm.startDate}
            onChange={(event) => {
              const nextStart = event.target.value;
              setGroupForm((prev) => {
                const minimumCheckout = formatDateParam(addDays(new Date(nextStart), 1));
                return {
                  ...prev,
                  startDate: nextStart,
                  endDate: prev.endDate < minimumCheckout ? minimumCheckout : prev.endDate,
                };
              });
            }}
            required
          />

          <input
            className="input"
            type="date"
            value={groupForm.endDate}
            min={formatDateParam(addDays(new Date(groupForm.startDate), 1))}
            onChange={(event) => setGroupForm((prev) => ({ ...prev, endDate: event.target.value }))}
            required
          />

          <input
            className="input"
            value={groupForm.contactPhone}
            onChange={(event) => setGroupForm((prev) => ({ ...prev, contactPhone: event.target.value }))}
            placeholder="Guest phone"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
          <input
            className="input"
            type="number"
            min="1"
            value={groupForm.adultGuests}
            onChange={(event) => setGroupForm((prev) => ({ ...prev, adultGuests: event.target.value }))}
            placeholder="Adults"
            required
          />
          <input
            className="input"
            type="number"
            min="0"
            value={groupForm.childGuests}
            onChange={(event) => setGroupForm((prev) => ({ ...prev, childGuests: event.target.value }))}
            placeholder="Children"
          />
          <input
            className="input"
            type="number"
            min="0"
            value={groupForm.pets}
            onChange={(event) => setGroupForm((prev) => ({ ...prev, pets: event.target.value }))}
            placeholder="Pets"
          />
          <select
            className="input"
            value={groupForm.source}
            onChange={(event) => setGroupForm((prev) => ({ ...prev, source: event.target.value }))}
          >
            <option value="whatsapp">WhatsApp</option>
            <option value="website">Website</option>
            <option value="admin">Admin</option>
            <option value="sheet">Sheets</option>
          </select>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <input
            className="input"
            value={groupForm.contactName}
            onChange={(event) => setGroupForm((prev) => ({ ...prev, contactName: event.target.value }))}
            placeholder="Guest / group name"
            required
          />
          <input
            className="input"
            type="email"
            value={groupForm.contactEmail}
            onChange={(event) => setGroupForm((prev) => ({ ...prev, contactEmail: event.target.value }))}
            placeholder="Guest email"
            required
          />
        </div>

        <textarea
          className="input min-h-24"
          value={groupForm.specialRequests}
          onChange={(event) => setGroupForm((prev) => ({ ...prev, specialRequests: event.target.value }))}
          placeholder="Internal notes or guest requests"
        />
      </form>

      <div className="grid gap-4 rounded-[2rem] border border-lime-100/10 bg-[#0d1710]/70 p-4 md:grid-cols-4">
        <input
          className="input"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search name, email, phone, room…"
        />
        <select className="input" value={filters.type} onChange={(event) => setFilters((prev) => ({ ...prev, type: event.target.value }))}>
          <option value="">All types</option>
          <option value="room">Rooms</option>
          <option value="trek">Treks</option>
          <option value="camp">Camps</option>
        </select>
        <select className="input" value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>
          <option value="">All statuses</option>
          <option value="pending">Unpaid / pending (incl. abandoned)</option>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select className="input" value={filters.source} onChange={(event) => setFilters((prev) => ({ ...prev, source: event.target.value }))}>
          <option value="">All sources</option>
          <option value="website">Website</option>
          <option value="airbnb">Airbnb</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="admin">Admin</option>
          <option value="sheet">Sheets</option>
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
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{booking.bookingType}</p>
                            <span className="rounded-full bg-lime-200/10 px-3 py-1 text-xs font-semibold text-lime-200">
                              {SOURCE_LABELS[booking.source] || booking.source || 'Website'}
                            </span>
                          </div>
                          <h3 className="mt-2 text-xl font-semibold text-white">{booking.listing?.name}</h3>
                          <p className="mt-2 text-sm text-slate-300">{booking.user?.name} • {booking.user?.email}</p>
                          <p className="mt-2 text-sm text-slate-300">Stay dates: {formatDateRange(booking.startDate, booking.endDate)}</p>
                          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-400">
                            <span>Contact: {booking.contactName} • {booking.contactPhone || 'No phone'}</span>
                            {booking.source === 'airbnb' ? (
                              <button
                                type="button"
                                className="text-xs font-semibold text-lime-300 underline-offset-2 hover:underline"
                                onClick={() => updateGuestName(booking._id, booking.contactName)}
                              >
                                Edit name
                              </button>
                            ) : null}
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
                            <button
                              className="btn-secondary w-full border-rose-500/40 text-rose-300 hover:border-rose-400 hover:text-rose-200"
                              onClick={() => setCancelTarget(booking)}
                            >
                              Cancel &amp; Refund
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
                <EmptyState
                  title={section.emptyTitle}
                  description={
                    section.key === 'pending'
                      ? 'Bookings without a completed payment (abandoned checkouts) are hidden by default. Select "Unpaid / pending" above to review them.'
                      : `Bookings marked as ${section.key} will appear here automatically.`
                  }
                />
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

export default AdminBookingsPage;
