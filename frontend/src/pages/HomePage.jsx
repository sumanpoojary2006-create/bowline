import { useEffect, useMemo, useState } from 'react';
import { MinusIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { payForBookings } from '../lib/razorpay';
import ListingCard from '../components/ListingCard';
import PageLoader from '../components/PageLoader';
import EmptyState from '../components/EmptyState';
import RoomCalendar from '../components/RoomCalendar';
import { formatCurrency } from '../lib/formatters';
import { addDays, ensureCheckoutDate, formatDateParam, parseDateParam } from '../lib/dateUtils';
import { useBookingCart } from '../context/BookingCartContext';
import { useAuth } from '../context/AuthContext';
import { getGroupBookingLabel, getGroupRoomsForGuests, getNightlyRoomRate, getRoomDisplayOrder, petFee } from '../lib/roomRates';

const forestBackdrop =
  'https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&w=1800&q=80';

const tomorrow = () => addDays(new Date(), 1);
const increment = (value, amount, min = 0, max = 20) => Math.max(min, Math.min(max, Number(value || 0) + amount));

const clampMealCounts = (draft) => {
  const total = Number(draft.adults) + Number(draft.children);
  const vegCount = Math.min(draft.vegCount, total);
  const nonVegCount = Math.min(draft.nonVegCount, total - vegCount);
  return { ...draft, vegCount, nonVegCount };
};

function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { addItem } = useBookingCart();
  const { user } = useAuth();
  const [filters] = useState({
    startDate: tomorrow(),
    endDate: addDays(tomorrow(), 1),
    guests: '2',
  });
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeHighlight, setActiveHighlight] = useState('room');
  const [activeBooking, setActiveBooking] = useState(null);
  const [bookingStep, setBookingStep] = useState('details');
  const [groupGuests, setGroupGuests] = useState(10);
  const [groupDates, setGroupDates] = useState({
    startDate: tomorrow(),
    endDate: addDays(tomorrow(), 1),
  });
  const [bookingDraft, setBookingDraft] = useState({
    startDate: tomorrow(),
    endDate: addDays(tomorrow(), 1),
    adults: 2,
    children: 0,
    pets: 0,
    vegCount: 0,
    nonVegCount: 0,
    contactName: '',
    contactEmail: '',
    contactPhone: '',
  });

  useEffect(() => {
    document.title = 'Bowline Nature Stay | Book Your Hillside Stay';

    const fetchHomeData = async () => {
      try {
        const { data } = await api.get('/listings', { params: { type: 'room', limit: 8 } });
        setRooms([...data.listings].sort((a, b) => getRoomDisplayOrder(a) - getRoomDisplayOrder(b)));
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
    setBookingStep('details');
    const adults = Number(filters.guests || 2);
    setBookingDraft({
      startDate: filters.startDate,
      endDate: filters.endDate,
      adults,
      children: 0,
      pets: 0,
      vegCount: 0,
      nonVegCount: 0,
      contactName: user?.name || '',
      contactEmail: user?.email || '',
      contactPhone: user?.phone || '',
    });
  };

  const updateDraftStartDate = (date) => {
    setBookingDraft((prev) => ({
      ...prev,
      startDate: date,
      endDate: ensureCheckoutDate(date, prev.endDate, 1),
    }));
  };

  const [placingBooking, setPlacingBooking] = useState(false);

  const proceedToBook = async () => {
    if (!activeBooking) return;

    setPlacingBooking(true);
    try {
      const { data } = await api.post('/bookings', {
        listingId: activeBooking._id,
        startDate: formatDateParam(bookingDraft.startDate),
        endDate: formatDateParam(bookingDraft.endDate),
        guests: modalTotalGuests,
        adultGuests: bookingDraft.adults,
        childGuests: bookingDraft.children,
        pets: bookingDraft.pets,
        vegCount: bookingDraft.vegCount,
        nonVegCount: bookingDraft.nonVegCount,
        contactName: bookingDraft.contactName,
        contactEmail: bookingDraft.contactEmail,
        contactPhone: bookingDraft.contactPhone,
      });

      const booking = data.booking;

      try {
        const result = await payForBookings({
          bookingIds: [booking._id],
          contact: bookingDraft,
        });

        toast.success('Payment successful! Your booking is confirmed.');
        navigate(`/booking/confirmation/${booking._id}`, {
          state: { booking: result.bookings[0], resetBookingModal: true },
        });
      } catch (paymentError) {
        if (paymentError.message === 'PAYMENT_CANCELLED') {
          toast.error('Payment cancelled. Your booking is saved as pending.');
        } else {
          toast.error('Payment could not be completed. Your booking is saved as pending.');
        }
        navigate(`/booking/confirmation/${booking._id}`, {
          state: { booking, resetBookingModal: true },
        });
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to create booking');
    } finally {
      setPlacingBooking(false);
    }
  };

  const confirmGroupBooking = () => {
    if (!groupRooms.length) return;

    const guestsPerRoom = Math.max(1, Math.ceil(groupGuests / groupRooms.length));
    groupRooms.forEach((listing) => {
      addItem(listing, groupDates.startDate, groupDates.endDate, guestsPerRoom);
    });

    navigate('/checkout');
  };

  const selectedNightlyRate = activeBooking ? getNightlyRoomRate(activeBooking, bookingDraft.startDate) : 0;
  const modalTotalGuests = Number(bookingDraft.adults) + Number(bookingDraft.children);
  const modalEstimate =
    selectedNightlyRate * Number(bookingDraft.adults) +
    selectedNightlyRate * 0.5 * Number(bookingDraft.children) +
    petFee * Number(bookingDraft.pets);
  const modalNights = activeBooking
    ? Math.max(Math.round((bookingDraft.endDate - bookingDraft.startDate) / 86400000), 1)
    : 0;
  const modalRoomTotal =
    (selectedNightlyRate * Number(bookingDraft.adults) + selectedNightlyRate * 0.5 * Number(bookingDraft.children)) *
    modalNights;
  const modalPetTotal = petFee * Number(bookingDraft.pets);
  const modalGrandTotal = modalRoomTotal + modalPetTotal;

  return (
    <>
      <section className="relative overflow-hidden pb-10 pt-6">
        <img src={forestBackdrop} alt="Forest valley" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,16,10,0.62)_0%,rgba(8,16,10,0.86)_38%,rgba(8,16,10,0.96)_100%)]" />

        <div className="relative section-shell space-y-8">
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
                </div>

                {loading ? (
                  <PageLoader label="Loading rooms..." />
                ) : rooms.length ? (
                  <div className="flex snap-x snap-mandatory gap-5 overflow-x-auto pb-2">
                    {rooms.map((listing) => (
                      <div
                        key={listing._id}
                        className="w-[85%] flex-shrink-0 snap-start sm:w-[45%] lg:w-[calc((100%-2.5rem)/3)]"
                      >
                        <ListingCard
                          listing={listing}
                          onBookNow={openBookingPrompt}
                          compact
                          detailLabel="View More"
                          showPrice
                        />
                      </div>
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

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs uppercase tracking-[0.22em] text-lime-200/80">Check-in</label>
                    <input
                      type="date"
                      className="input mt-2"
                      value={formatDateParam(groupDates.startDate)}
                      onChange={(e) => {
                        const date = parseDateParam(e.target.value, groupDates.startDate);
                        setGroupDates((prev) => ({
                          startDate: date,
                          endDate: ensureCheckoutDate(date, prev.endDate, 1),
                        }));
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-[0.22em] text-lime-200/80">Check-out</label>
                    <input
                      type="date"
                      className="input mt-2"
                      value={formatDateParam(groupDates.endDate)}
                      onChange={(e) => {
                        const date = parseDateParam(e.target.value, groupDates.endDate);
                        setGroupDates((prev) => ({
                          ...prev,
                          endDate: ensureCheckoutDate(prev.startDate, date, 1),
                        }));
                      }}
                    />
                  </div>
                </div>

                <div className="rounded-[1.25rem] border border-lime-100/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-lime-200/80">Selected bundle</p>
                  <p className="mt-2 text-xl font-semibold text-[#f5f0dd]">{getGroupBookingLabel(groupGuests)}</p>
                  <p className="mt-2 text-sm text-[#cdd6c9]">
                    Rooms included: {groupRooms.map((room) => room.name).join(', ') || 'Choose 10 to 20 guests'}
                  </p>
                </div>

                <button
                  type="button"
                  className="btn-primary w-full"
                  disabled={!groupRooms.length}
                  onClick={confirmGroupBooking}
                >
                  Book this bundle
                </button>
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

            {bookingStep === 'details' ? (
            <>
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
                    onClick={() => setBookingDraft((prev) => clampMealCounts({ ...prev, adults: increment(prev.adults, -1, 1, 20) }))}
                  >
                    <MinusIcon className="h-4 w-4" />
                  </button>
                  <span className="w-6 text-center text-sm font-semibold text-[#f5f0dd]">{bookingDraft.adults}</span>
                  <button
                    className="rounded-full border border-lime-100/15 p-2 text-white disabled:opacity-40"
                    type="button"
                    onClick={() => setBookingDraft((prev) => clampMealCounts({ ...prev, adults: increment(prev.adults, 1, 1, 20) }))}
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
                    onClick={() => setBookingDraft((prev) => clampMealCounts({ ...prev, children: increment(prev.children, -1, 0, 20) }))}
                  >
                    <MinusIcon className="h-4 w-4" />
                  </button>
                  <span className="w-6 text-center text-sm font-semibold text-[#f5f0dd]">{bookingDraft.children}</span>
                  <button
                    className="rounded-full border border-lime-100/15 p-2 text-white disabled:opacity-40"
                    type="button"
                    onClick={() => setBookingDraft((prev) => clampMealCounts({ ...prev, children: increment(prev.children, 1, 0, 20) }))}
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

              <div className="flex items-center justify-between rounded-[1.25rem] border border-lime-100/10 bg-black/20 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-[#f5f0dd]">Veg meals</p>
                  <p className="text-xs text-[#aab5a5]">Number of guests on veg meals</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    className="rounded-full border border-lime-100/15 p-2 text-white disabled:opacity-40"
                    type="button"
                    disabled={bookingDraft.vegCount <= 0}
                    onClick={() => setBookingDraft((prev) => ({ ...prev, vegCount: increment(prev.vegCount, -1, 0, modalTotalGuests) }))}
                  >
                    <MinusIcon className="h-4 w-4" />
                  </button>
                  <span className="w-6 text-center text-sm font-semibold text-[#f5f0dd]">{bookingDraft.vegCount}</span>
                  <button
                    className="rounded-full border border-lime-100/15 p-2 text-white disabled:opacity-40"
                    type="button"
                    disabled={bookingDraft.vegCount >= modalTotalGuests}
                    onClick={() =>
                      setBookingDraft((prev) => {
                        const vegCount = increment(prev.vegCount, 1, 0, modalTotalGuests);
                        const nonVegCount = Math.min(prev.nonVegCount, modalTotalGuests - vegCount);
                        return { ...prev, vegCount, nonVegCount };
                      })
                    }
                  >
                    <PlusIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-[1.25rem] border border-lime-100/10 bg-black/20 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-[#f5f0dd]">Non-veg meals</p>
                  <p className="text-xs text-[#aab5a5]">Number of guests on non-veg meals</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    className="rounded-full border border-lime-100/15 p-2 text-white disabled:opacity-40"
                    type="button"
                    disabled={bookingDraft.nonVegCount <= 0}
                    onClick={() => setBookingDraft((prev) => ({ ...prev, nonVegCount: increment(prev.nonVegCount, -1, 0, modalTotalGuests) }))}
                  >
                    <MinusIcon className="h-4 w-4" />
                  </button>
                  <span className="w-6 text-center text-sm font-semibold text-[#f5f0dd]">{bookingDraft.nonVegCount}</span>
                  <button
                    className="rounded-full border border-lime-100/15 p-2 text-white disabled:opacity-40"
                    type="button"
                    disabled={bookingDraft.nonVegCount >= modalTotalGuests}
                    onClick={() =>
                      setBookingDraft((prev) => {
                        const nonVegCount = increment(prev.nonVegCount, 1, 0, modalTotalGuests);
                        const vegCount = Math.min(prev.vegCount, modalTotalGuests - nonVegCount);
                        return { ...prev, nonVegCount, vegCount };
                      })
                    }
                  >
                    <PlusIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {bookingDraft.vegCount + bookingDraft.nonVegCount !== modalTotalGuests ? (
                <p className="px-1 text-xs text-amber-300">
                  {bookingDraft.vegCount + bookingDraft.nonVegCount} of {modalTotalGuests} guest
                  {modalTotalGuests === 1 ? '' : 's'} assigned a meal preference.
                </p>
              ) : null}
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
              <button className="btn-primary flex-1" onClick={() => setBookingStep('summary')} type="button">
                Book Now
              </button>
            </div>
            </>
            ) : (
              <div className="mt-5 space-y-3">
                <div className="rounded-[1.5rem] border border-lime-100/10 bg-[#0d1710]/80 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-lime-200/80">Booking summary</p>
                  <h4 className="mt-2 text-xl font-semibold text-[#f5f0dd]">{activeBooking.name}</h4>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-300">
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

                  <div className="mt-4 space-y-2 border-t border-white/10 pt-4 text-sm text-[#cdd6c9]">
                    <div className="flex items-center justify-between">
                      <span>Duration</span>
                      <span className="font-semibold text-white">{modalNights} night{modalNights === 1 ? '' : 's'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Adults</span>
                      <span className="font-semibold text-white">{bookingDraft.adults}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Children</span>
                      <span className="font-semibold text-white">{bookingDraft.children}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Pets</span>
                      <span className="font-semibold text-white">{bookingDraft.pets}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Veg meals</span>
                      <span className="font-semibold text-white">{bookingDraft.vegCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Non-veg meals</span>
                      <span className="font-semibold text-white">{bookingDraft.nonVegCount}</span>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 border-t border-white/10 pt-4 text-sm text-[#cdd6c9]">
                    <div className="flex items-center justify-between">
                      <span>Room cost ({modalNights} night{modalNights === 1 ? '' : 's'})</span>
                      <span className="font-semibold text-white">{formatCurrency(modalRoomTotal)}</span>
                    </div>
                    {bookingDraft.pets > 0 ? (
                      <div className="flex items-center justify-between">
                        <span>Pet fee</span>
                        <span className="font-semibold text-white">{formatCurrency(modalPetTotal)}</span>
                      </div>
                    ) : null}
                    <div className="flex items-center justify-between text-base font-bold text-lime-200">
                      <span>Total</span>
                      <span>{formatCurrency(modalGrandTotal)}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-lime-100/10 bg-[#0d1710]/80 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-lime-200/80">Your details</p>
                  <div className="mt-3 space-y-3">
                    <div>
                      <label className="text-xs text-[#aab5a5]">Full name</label>
                      <input
                        type="text"
                        className="input mt-1"
                        placeholder="Your name"
                        value={bookingDraft.contactName}
                        onChange={(e) => setBookingDraft((prev) => ({ ...prev, contactName: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[#aab5a5]">Email</label>
                      <input
                        type="email"
                        className="input mt-1"
                        placeholder="you@example.com"
                        value={bookingDraft.contactEmail}
                        onChange={(e) => setBookingDraft((prev) => ({ ...prev, contactEmail: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[#aab5a5]">Phone number</label>
                      <input
                        type="tel"
                        className="input mt-1"
                        placeholder="Your phone number"
                        value={bookingDraft.contactPhone}
                        onChange={(e) => setBookingDraft((prev) => ({ ...prev, contactPhone: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button className="btn-secondary flex-1" onClick={() => setBookingStep('details')} type="button">
                    Back
                  </button>
                  <button
                    className="btn-primary flex-1 disabled:opacity-50"
                    onClick={proceedToBook}
                    disabled={
                      placingBooking ||
                      !bookingDraft.contactName.trim() ||
                      !bookingDraft.contactEmail.trim() ||
                      !bookingDraft.contactPhone.trim()
                    }
                    type="button"
                  >
                    {placingBooking ? 'Processing...' : 'Proceed to Book'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

export default HomePage;
