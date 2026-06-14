import { useEffect, useMemo, useState } from 'react';
import { MinusIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import ListingCard from '../components/ListingCard';
import PageLoader from '../components/PageLoader';
import EmptyState from '../components/EmptyState';
import RoomCalendar from '../components/RoomCalendar';
import { formatCurrency } from '../lib/formatters';
import { addDays, ensureCheckoutDate, formatDateParam } from '../lib/dateUtils';
import { getGroupBookingLabel, getGroupRoomsForGuests, getNightlyRoomRate, petFee } from '../lib/roomRates';

const forestBackdrop =
  'https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&w=1800&q=80';

const tomorrow = () => addDays(new Date(), 1);
const increment = (value, amount, min = 0, max = 20) => Math.max(min, Math.min(max, Number(value || 0) + amount));

function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [filters] = useState({
    startDate: tomorrow(),
    endDate: addDays(tomorrow(), 1),
    guests: '2',
  });
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeHighlight, setActiveHighlight] = useState('room');
  const [activeBooking, setActiveBooking] = useState(null);
  const [groupGuests, setGroupGuests] = useState(10);
  const [bookingDraft, setBookingDraft] = useState({
    startDate: tomorrow(),
    endDate: addDays(tomorrow(), 1),
    adults: 2,
    children: 0,
    pets: 0,
  });

  useEffect(() => {
    document.title = 'Bowline Nature Stay | Book Your Hillside Stay';

    const fetchHomeData = async () => {
      try {
        const { data } = await api.get('/listings', { params: { type: 'room', limit: 8 } });
        setRooms(data.listings);
      } finally {
        setLoading(false);
      }
    };

    fetchHomeData();
  }, []);

  useEffect(() => {
    if (location.state?.resetBookingModal) {
      setActiveBooking(null);
    }
  }, [location.state]);

  const groupRooms = useMemo(() => getGroupRoomsForGuests(rooms, groupGuests), [groupGuests, rooms]);

  const openBookingPrompt = (listing) => {
    setActiveBooking(listing);
    setBookingDraft({
      startDate: filters.startDate,
      endDate: filters.endDate,
      adults: Number(filters.guests || 2),
      children: 0,
      pets: 0,
    });
  };

  const updateDraftStartDate = (date) => {
    setBookingDraft((prev) => ({
      ...prev,
      startDate: date,
      endDate: ensureCheckoutDate(date, prev.endDate, 1),
    }));
  };

  const confirmBookingPrompt = () => {
    if (!activeBooking) return;
    const guests = Number(bookingDraft.adults) + Number(bookingDraft.children);
    const query = new URLSearchParams({
      startDate: formatDateParam(bookingDraft.startDate),
      endDate: formatDateParam(bookingDraft.endDate),
      guests: String(guests),
      adults: String(bookingDraft.adults),
      children: String(bookingDraft.children),
      pets: String(bookingDraft.pets),
    });

    navigate(`/book/${activeBooking.slug}?${query.toString()}`, {
      state: {
        bookingPrefill: {
          startDate: formatDateParam(bookingDraft.startDate),
          endDate: formatDateParam(bookingDraft.endDate),
          guests: String(guests),
          adults: String(bookingDraft.adults),
          children: String(bookingDraft.children),
          pets: String(bookingDraft.pets),
        },
      },
    });
  };

  const selectedNightlyRate = activeBooking ? getNightlyRoomRate(activeBooking, bookingDraft.startDate) : 0;
  const modalTotalGuests = Number(bookingDraft.adults) + Number(bookingDraft.children);
  const modalEstimate =
    selectedNightlyRate * Number(bookingDraft.adults) +
    selectedNightlyRate * 0.5 * Number(bookingDraft.children) +
    petFee * Number(bookingDraft.pets);

  return (
    <>
      <section className="relative overflow-hidden pb-10 pt-6">
        <img src={forestBackdrop} alt="Forest valley" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,16,10,0.62)_0%,rgba(8,16,10,0.86)_38%,rgba(8,16,10,0.96)_100%)]" />

        <div className="relative section-shell space-y-8">
          <div className="mx-auto max-w-6xl rounded-[2.5rem] border border-lime-100/10 bg-black/25 p-6 backdrop-blur-sm sm:p-8">
            <div className="max-w-2xl">
              <p className="inline-flex rounded-full border border-lime-100/20 bg-black/20 px-4 py-2 text-xs uppercase tracking-[0.22em] text-[#cfd8cb]">
                Mudigere, Chikkamagaluru
              </p>
              <h1 className="mt-4 font-display text-3xl leading-tight text-[#f5f0dd] sm:text-5xl lg:text-6xl">
                Find your stay, then book in one clear flow.
              </h1>
              <p className="mt-3 text-sm text-[#d5ddd2] sm:text-base">
                Browse rooms with weekday and weekend pricing, then choose dates from the booking calendar.
              </p>
            </div>
          </div>

          <div className="mx-auto max-w-6xl rounded-[2rem] border border-lime-100/10 bg-[#0a130d]/70 p-5">
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
              {[
                { id: 'room', label: 'Room Booking' },
                { id: 'group', label: 'Group Booking' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveHighlight(tab.id)}
                  className={`flex-shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                    activeHighlight === tab.id
                      ? 'bg-lime-200 text-slate-950'
                      : 'border border-lime-100/15 bg-white/5 text-[#d2dbcf]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeHighlight === 'room' ? (
              <div className="mt-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-semibold text-[#f5f0dd]">Room booking</h2>
                    <p className="mt-1 text-sm text-[#cdd6c9]">
                      Weekday and weekend tariffs are shown per person. Breakfast is complimentary.
                    </p>
                  </div>
                  <Link className="btn-primary" to="/browse">
                    Check available rooms
                  </Link>
                </div>

                {loading ? (
                  <PageLoader label="Loading rooms..." />
                ) : rooms.length ? (
                  <div className="grid gap-5 lg:grid-cols-3">
                    {rooms.map((listing) => (
                      <ListingCard
                        key={listing._id}
                        listing={listing}
                        onBookNow={openBookingPrompt}
                        compact
                        detailLabel="View More"
                        showPrice
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState title="No rooms yet" description="Add room listings from the admin panel." />
                )}
              </div>
            ) : null}

            {activeHighlight === 'group' ? (
              <div className="mt-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-semibold text-[#f5f0dd]">Group booking</h2>
                    <p className="mt-1 text-sm text-[#cdd6c9]">
                      10-15 guests blocks all rooms except Pent House. 15-20 guests books the full house.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 rounded-full border border-lime-100/10 bg-black/20 p-2">
                    <button
                      className="rounded-full border border-lime-100/15 p-2 text-white disabled:opacity-40"
                      type="button"
                      disabled={groupGuests <= 10}
                      onClick={() => setGroupGuests((value) => increment(value, -1, 10, 20))}
                    >
                      <MinusIcon className="h-4 w-4" />
                    </button>
                    <span className="min-w-24 text-center text-sm font-semibold text-[#f5f0dd]">{groupGuests} guests</span>
                    <button
                      className="rounded-full border border-lime-100/15 p-2 text-white disabled:opacity-40"
                      type="button"
                      disabled={groupGuests >= 20}
                      onClick={() => setGroupGuests((value) => increment(value, 1, 10, 20))}
                    >
                      <PlusIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="rounded-[1.25rem] border border-lime-100/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-lime-200/80">Selected bundle</p>
                  <p className="mt-2 text-xl font-semibold text-[#f5f0dd]">{getGroupBookingLabel(groupGuests)}</p>
                  <p className="mt-2 text-sm text-[#cdd6c9]">
                    Rooms included: {groupRooms.map((room) => room.name).join(', ') || 'Choose 10 to 20 guests'}
                  </p>
                </div>

                <div className="grid gap-5 lg:grid-cols-3">
                  {groupRooms.map((listing) => (
                    <ListingCard
                      key={listing._id}
                      listing={listing}
                      onBookNow={openBookingPrompt}
                      compact
                      detailLabel="View More"
                      showPrice
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {activeBooking ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 px-4 pb-4 sm:items-center">
          <div className="glass w-full max-w-xl overflow-y-auto rounded-[2rem] p-5 sm:p-6" style={{ maxHeight: 'calc(100dvh - 2rem)' }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-lime-200/80">Book now</p>
                <h3 className="mt-2 text-3xl font-semibold text-[#f5f0dd]">{activeBooking.name}</h3>
              </div>
              <button className="rounded-full border border-lime-100/12 p-2 text-white" onClick={() => setActiveBooking(null)} type="button">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-lime-100/10 bg-[#0d1710]/80 p-4">
              <RoomCalendar
                listingId={activeBooking._id}
                listingType="room"
                startDate={bookingDraft.startDate}
                endDate={bookingDraft.endDate}
                onStartDate={updateDraftStartDate}
                onEndDate={(date) =>
                  setBookingDraft((prev) => ({
                    ...prev,
                    endDate: ensureCheckoutDate(prev.startDate, date, 1),
                  }))
                }
              />
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/10 pt-4 text-sm text-slate-300">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Check-in</p>
                  <p className="font-semibold text-white">
                    {bookingDraft.startDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Check-out</p>
                  <p className="font-semibold text-white">
                    {bookingDraft.endDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between rounded-[1.25rem] border border-lime-100/10 bg-black/20 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-[#f5f0dd]">Adults</p>
                  <p className="text-xs text-[#aab5a5]">Age 13+</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    className="rounded-full border border-lime-100/15 p-2 text-white disabled:opacity-40"
                    type="button"
                    disabled={bookingDraft.adults <= 1}
                    onClick={() => setBookingDraft((prev) => ({ ...prev, adults: increment(prev.adults, -1, 1, 20) }))}
                  >
                    <MinusIcon className="h-4 w-4" />
                  </button>
                  <span className="w-6 text-center text-sm font-semibold text-[#f5f0dd]">{bookingDraft.adults}</span>
                  <button
                    className="rounded-full border border-lime-100/15 p-2 text-white disabled:opacity-40"
                    type="button"
                    onClick={() => setBookingDraft((prev) => ({ ...prev, adults: increment(prev.adults, 1, 1, 20) }))}
                  >
                    <PlusIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-[1.25rem] border border-lime-100/10 bg-black/20 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-[#f5f0dd]">Children</p>
                  <p className="text-xs text-[#aab5a5]">Age 6-12 · 50% of adult tariff</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    className="rounded-full border border-lime-100/15 p-2 text-white disabled:opacity-40"
                    type="button"
                    disabled={bookingDraft.children <= 0}
                    onClick={() => setBookingDraft((prev) => ({ ...prev, children: increment(prev.children, -1, 0, 20) }))}
                  >
                    <MinusIcon className="h-4 w-4" />
                  </button>
                  <span className="w-6 text-center text-sm font-semibold text-[#f5f0dd]">{bookingDraft.children}</span>
                  <button
                    className="rounded-full border border-lime-100/15 p-2 text-white disabled:opacity-40"
                    type="button"
                    onClick={() => setBookingDraft((prev) => ({ ...prev, children: increment(prev.children, 1, 0, 20) }))}
                  >
                    <PlusIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-[1.25rem] border border-lime-100/10 bg-black/20 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-[#f5f0dd]">Pets</p>
                  <p className="text-xs text-[#aab5a5]">{formatCurrency(petFee)} flat per pet, per stay</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    className="rounded-full border border-lime-100/15 p-2 text-white disabled:opacity-40"
                    type="button"
                    disabled={bookingDraft.pets <= 0}
                    onClick={() => setBookingDraft((prev) => ({ ...prev, pets: increment(prev.pets, -1, 0, 10) }))}
                  >
                    <MinusIcon className="h-4 w-4" />
                  </button>
                  <span className="w-6 text-center text-sm font-semibold text-[#f5f0dd]">{bookingDraft.pets}</span>
                  <button
                    className="rounded-full border border-lime-100/15 p-2 text-white disabled:opacity-40"
                    type="button"
                    onClick={() => setBookingDraft((prev) => ({ ...prev, pets: increment(prev.pets, 1, 0, 10) }))}
                  >
                    <PlusIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-[1.25rem] border border-lime-100/10 bg-black/20 p-4 text-sm text-[#cdd6c9]">
              <div className="flex items-center justify-between">
                <span>Nightly rate ({modalTotalGuests} guest{modalTotalGuests === 1 ? '' : 's'})</span>
                <span className="font-semibold text-[#f5f0dd]">{formatCurrency(selectedNightlyRate)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-base font-bold text-lime-200">
                <span>Estimated per night</span>
                <span>{formatCurrency(modalEstimate)}</span>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setActiveBooking(null)} type="button">
                Cancel
              </button>
              <button className="btn-primary flex-1" onClick={confirmBookingPrompt} type="button">
                Confirm Dates
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default HomePage;
