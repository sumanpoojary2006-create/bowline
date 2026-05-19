import { MagnifyingGlassIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import DatePicker from 'react-datepicker';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useBookingCart } from '../context/BookingCartContext';
import api from '../lib/api';
import { addDays, ensureCheckoutDate, formatDateParam, parseDateParam } from '../lib/dateUtils';
import { formatCurrency, formatDate } from '../lib/formatters';
import PageLoader from '../components/PageLoader';

function StatusBadge({ available }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
        available
          ? 'bg-emerald-500/20 text-emerald-300'
          : 'bg-rose-500/20 text-rose-300'
      }`}
    >
      {available ? 'Available' : 'Booked'}
    </span>
  );
}

function BrowseRoomsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { addItem } = useBookingCart();

  const [filters, setFilters] = useState({
    startDate: parseDateParam(searchParams.get('startDate')) || addDays(new Date(), 1),
    endDate:
      parseDateParam(searchParams.get('endDate')) ||
      addDays(new Date(), 2),
    guests: Number(searchParams.get('guests')) || 1,
  });

  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (searchParams.get('startDate') && searchParams.get('endDate')) {
      fetchRooms(filters);
    }
  }, []);

  const fetchRooms = async (currentFilters) => {
    setLoading(true);
    setSearched(true);
    try {
      const { data } = await api.get('/listings/availability/rooms', {
        params: {
          startDate: formatDateParam(currentFilters.startDate),
          endDate: formatDateParam(currentFilters.endDate),
        },
      });
      setRooms(data.rooms);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setSearchParams({
      startDate: formatDateParam(filters.startDate),
      endDate: formatDateParam(filters.endDate),
      guests: String(filters.guests),
    });
    fetchRooms(filters);
  };

  const nights = Math.max(
    Math.round((filters.endDate - filters.startDate) / 86400000),
    1
  );

  const handleAddToCart = (room) => {
    addItem(room, filters.startDate, filters.endDate, filters.guests);
  };

  const handleBook = (room) => {
    navigate(
      `/book/${room.slug}?startDate=${formatDateParam(filters.startDate)}&endDate=${formatDateParam(filters.endDate)}&guests=${filters.guests}`
    );
  };

  return (
    <section className="section-shell py-12">
      <h1 className="mb-6 font-display text-4xl text-white">Find Available Rooms</h1>

      <form
        onSubmit={handleSearch}
        className="glass mb-8 grid gap-3 rounded-[1.75rem] p-3 lg:grid-cols-[1fr_1fr_1fr_auto]"
      >
        <label className="rounded-[1.25rem] bg-[#f0edd8] px-4 py-3 text-sm text-slate-900">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            Check in
          </span>
          <DatePicker
            selected={filters.startDate}
            onChange={(date) =>
              setFilters((prev) => ({
                ...prev,
                startDate: date,
                endDate: ensureCheckoutDate(date, prev.endDate, 1),
              }))
            }
            className="w-full bg-transparent font-medium text-slate-900 outline-none"
            minDate={new Date()}
            dateFormat="EEE, MMM d"
          />
        </label>

        <label className="rounded-[1.25rem] bg-[#f0edd8] px-4 py-3 text-sm text-slate-900">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            Check out
          </span>
          <DatePicker
            selected={filters.endDate}
            onChange={(date) =>
              setFilters((prev) => ({
                ...prev,
                endDate: ensureCheckoutDate(prev.startDate, date, 1),
              }))
            }
            className="w-full bg-transparent font-medium text-slate-900 outline-none"
            minDate={addDays(filters.startDate, 1)}
            dateFormat="EEE, MMM d"
          />
        </label>

        <label className="rounded-[1.25rem] bg-[#f0edd8] px-4 py-3 text-sm text-slate-900">
          <span className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            <UserGroupIcon className="h-3.5 w-3.5" />
            Guests
          </span>
          <select
            className="w-full bg-transparent font-medium text-slate-900 outline-none"
            value={filters.guests}
            onChange={(e) => setFilters((prev) => ({ ...prev, guests: Number(e.target.value) }))}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? 'guest' : 'guests'}
              </option>
            ))}
          </select>
        </label>

        <button className="btn-primary gap-2 rounded-[1.25rem] px-6" type="submit">
          <MagnifyingGlassIcon className="h-5 w-5" />
          Search
        </button>
      </form>

      {loading && <PageLoader label="Checking availability..." />}

      {!loading && searched && (
        <>
          <p className="mb-4 text-sm text-slate-400">
            {rooms.filter((r) => r.isAvailable).length} of {rooms.length} rooms available for{' '}
            {formatDate(filters.startDate)} – {formatDate(filters.endDate)} · {nights} night{nights > 1 ? 's' : ''}
          </p>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => (
              <div
                key={room._id}
                className={`glass flex flex-col rounded-[2rem] overflow-hidden transition-opacity ${
                  room.isAvailable ? '' : 'opacity-70'
                }`}
              >
                <div className="relative">
                  <img
                    src={room.images?.[0] || 'https://placehold.co/600x400'}
                    alt={room.name}
                    className="h-48 w-full object-cover"
                  />
                  <div className="absolute right-3 top-3">
                    <StatusBadge available={room.isAvailable} />
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="font-display text-xl text-white">{room.name}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-400">{room.shortDescription}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    Up to {room.capacity} guests
                  </p>

                  {!room.isAvailable && room.unavailableReason && (
                    <p className="mt-2 text-xs text-rose-400">{room.unavailableReason}</p>
                  )}

                  <div className="mt-auto pt-4">
                    <p className="text-lg font-bold text-lime-200">
                      {formatCurrency(room.price)}
                      <span className="text-sm font-normal text-slate-400"> / night</span>
                    </p>
                    <p className="text-sm text-slate-400">
                      ≈ {formatCurrency(room.price * nights)} for {nights} night{nights > 1 ? 's' : ''}
                    </p>
                    {room.isAvailable && (
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => handleAddToCart(room)}
                          className="btn-secondary flex-1 text-sm"
                        >
                          + Add to Cart
                        </button>
                        <button
                          onClick={() => handleBook(room)}
                          className="btn-primary flex-1 text-sm"
                        >
                          Book Now
                        </button>
                      </div>
                    )}
                    {!room.isAvailable && (
                      <button
                        onClick={() => navigate(`/experiences/${room.slug}`)}
                        className="btn-secondary mt-3 w-full text-sm"
                      >
                        View Dates
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!loading && !searched && (
        <div className="py-16 text-center text-slate-400">
          <MagnifyingGlassIcon className="mx-auto mb-4 h-12 w-12 opacity-30" />
          <p>Select your dates and search to see room availability.</p>
        </div>
      )}
    </section>
  );
}

export default BrowseRoomsPage;
