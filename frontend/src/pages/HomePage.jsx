import { useEffect, useMemo, useState } from 'react';
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MinusIcon,
  PlusIcon,
  ShoppingBagIcon,
  TagIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
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

const computeItemTotals = (listing, draft) => {
  const nightlyRate = getNightlyRoomRate(listing, draft.startDate);
  const nights = Math.max(Math.round((draft.endDate - draft.startDate) / 86400000), 1);
  const roomTotal =
    (nightlyRate * Number(draft.adults) + nightlyRate * 0.5 * Number(draft.children)) * nights;
  const petTotal = petFee * Number(draft.pets);
  const grandTotal = roomTotal + petTotal;
  return { nightlyRate, nights, roomTotal, petTotal, grandTotal };
};

const toBookingItem = (listing, draft) => ({
  listingId: listing._id,
  startDate: formatDateParam(draft.startDate),
  endDate: formatDateParam(draft.endDate),
  guests: Number(draft.adults) + Number(draft.children),
  adultGuests: draft.adults,
  childGuests: draft.children,
  pets: draft.pets,
  vegCount: draft.vegCount,
  nonVegCount: draft.nonVegCount,
});

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
  const [showGroupBooking, setShowGroupBooking] = useState(false);
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
  const [couponCode, setCouponCode] = useState('');
  const [couponOffer, setCouponOffer] = useState(null);
  const [couponChecking, setCouponChecking] = useState(false);
  const [roomCart, setRoomCart] = useState([]);
  const [policyExpanded, setPolicyExpanded] = useState(false);
  const [houseRulesExpanded, setHouseRulesExpanded] = useState(false);
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [modalImageIndex, setModalImageIndex] = useState(0);

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
    setCouponCode('');
    setCouponOffer(null);
    setPolicyExpanded(false);
    setHouseRulesExpanded(false);
    setPolicyAccepted(false);
    setModalImageIndex(0);
    const adults = Math.max(Number(filters.guests || 2), listing.minOccupancy || 1);
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

  const addCurrentRoomToCart = () => {
    if (!activeBooking) return;

    const totals = computeItemTotals(activeBooking, bookingDraft);
    setRoomCart((prev) => [
      ...prev,
      { id: `${activeBooking._id}-${Date.now()}`, listing: activeBooking, draft: { ...bookingDraft }, ...totals },
    ]);
    setActiveBooking(null);
    setBookingStep('details');
    setCouponCode('');
    setCouponOffer(null);
    toast.success(`${activeBooking.name} added to your booking. Pick another room to continue.`);
  };

  const removeCartItem = (id) => {
    setRoomCart((prev) => prev.filter((item) => item.id !== id));
  };

  const proceedToBook = async () => {
    if (!activeBooking) return;

    if (!policyAccepted) {
      toast.error('Please read and check the cancellation & rescheduling policy and house rules.');
      return;
    }

    setPlacingBooking(true);
    try {
      if (roomCart.length === 0) {
        const { data } = await api.post('/bookings', {
          ...toBookingItem(activeBooking, bookingDraft),
          contactName: bookingDraft.contactName,
          contactEmail: bookingDraft.contactEmail,
          contactPhone: bookingDraft.contactPhone,
          couponCode: couponOffer?.coupon?.code || '',
        });

        const booking = data.booking;

        try {
          const result = await payForBookings({
            bookingIds: [booking._id],
            contact: bookingDraft,
          });

          sessionStorage.setItem('bowline_celebrate_booking', booking._id);
          navigate(`/booking/confirmation/${booking._id}`, {
            state: { booking: result.bookings[0], resetBookingModal: true, showCelebration: true },
          });
        } catch (paymentError) {
          if (paymentError.message === 'PAYMENT_CANCELLED') {
            toast.error('Payment cancelled. Your booking is saved as pending.');
            setActiveBooking(null);
            navigate('/', { replace: true, state: { resetBookingModal: true } });
            return;
          } else {
            toast.error('Payment could not be completed. Your booking is saved as pending.');
          }
          navigate(`/booking/confirmation/${booking._id}`, {
            state: { booking, resetBookingModal: true },
          });
        }
        return;
      }

      const items = [
        ...roomCart.map((item) => toBookingItem(item.listing, item.draft)),
        toBookingItem(activeBooking, bookingDraft),
      ];

      const { data } = await api.post('/bookings/multi', {
        items,
        contactName: bookingDraft.contactName,
        contactEmail: bookingDraft.contactEmail,
        contactPhone: bookingDraft.contactPhone,
        couponCode: couponOffer?.coupon?.code || '',
      });

      const bookings = data.bookings;

      try {
        const result = await payForBookings({
          bookingIds: bookings.map((booking) => booking._id),
          contact: bookingDraft,
        });

        setRoomCart([]);
        sessionStorage.setItem('bowline_celebrate_booking', result.bookings[0]._id);
        navigate(`/booking/confirmation/${result.bookings[0]._id}`, {
          state: { booking: result.bookings[0], resetBookingModal: true, showCelebration: true },
        });
      } catch (paymentError) {
        setRoomCart([]);
        if (paymentError.message === 'PAYMENT_CANCELLED') {
          toast.error('Payment cancelled. Your bookings are saved as pending.');
          setActiveBooking(null);
          navigate('/', { replace: true, state: { resetBookingModal: true } });
          return;
        } else {
          toast.error('Payment could not be completed. Your bookings are saved as pending.');
        }
        navigate(`/booking/confirmation/${bookings[0]._id}`, {
          state: { booking: bookings[0], resetBookingModal: true },
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

  const activeTotals = activeBooking ? computeItemTotals(activeBooking, bookingDraft) : null;
  const selectedNightlyRate = activeTotals?.nightlyRate || 0;
  const modalTotalGuests = Number(bookingDraft.adults) + Number(bookingDraft.children);
  const modalEstimate =
    selectedNightlyRate * Number(bookingDraft.adults) +
    selectedNightlyRate * 0.5 * Number(bookingDraft.children) +
    petFee * Number(bookingDraft.pets);
  const modalNights = activeTotals?.nights || 0;
  const modalRoomTotal = activeTotals?.roomTotal || 0;
  const modalPetTotal = activeTotals?.petTotal || 0;
  const modalGrandTotal = activeTotals?.grandTotal || 0;
  const cartSubtotal = roomCart.reduce((sum, item) => sum + item.grandTotal, 0);
  const combinedSubtotal = cartSubtotal + modalGrandTotal;
  const modalCouponDiscount = couponOffer?.discount || 0;
  const modalFinalTotal = Math.max(combinedSubtotal - modalCouponDiscount, 0);
  const modalMealSelectionComplete = bookingDraft.vegCount + bookingDraft.nonVegCount === modalTotalGuests;

  useEffect(() => {
    setCouponOffer(null);
  }, [combinedSubtotal]);

  const applyCoupon = async () => {
    const code = couponCode.trim();

    if (!code) {
      toast.error('Enter a coupon code');
      return;
    }

    setCouponChecking(true);
    try {
      const { data } = await api.post('/bookings/coupon/validate', {
        couponCode: code,
        subtotal: combinedSubtotal,
      });
      setCouponOffer(data);
      setCouponCode(data.coupon.code);
      toast.success(`${data.coupon.code} applied`);
    } catch (error) {
      setCouponOffer(null);
      toast.error(error.response?.data?.message || 'Unable to apply coupon');
    } finally {
      setCouponChecking(false);
    }
  };

  const removeCoupon = () => {
    setCouponOffer(null);
    setCouponCode('');
  };

  return (
    <>
      <section className="relative overflow-hidden pb-10 pt-6">
        <img src={forestBackdrop} alt="Forest valley" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,16,10,0.62)_0%,rgba(8,16,10,0.86)_38%,rgba(8,16,10,0.96)_100%)]" />

        <div className="relative section-shell space-y-8">
          <div className="mx-auto max-w-6xl rounded-[2rem] border border-lime-100/10 bg-[#0a130d]/70 p-5">
            <div className="space-y-4">
              <div>
                <h2 className="text-2xl font-semibold text-[#f5f0dd]">Room booking</h2>
                <p className="mt-1 text-sm text-[#cdd6c9]">
                  Weekday and weekend tariffs are shown per person. Breakfast is complimentary.
                </p>
              </div>

              {loading ? (
                <PageLoader label="Loading rooms..." />
              ) : rooms.length ? (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
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

                  <article className="glass flex h-full flex-col overflow-hidden rounded-[1.75rem] shadow-[0_18px_50px_rgba(0,0,0,0.28)] transition hover:-translate-y-1.5">
                    <div className="relative h-48 overflow-hidden">
                      <img src={forestBackdrop} alt="Group booking" className="h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#07110b] via-[#07110b]/20 to-transparent" />
                      <div className="absolute left-4 top-4 inline-flex rounded-full bg-lime-200 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-950">
                        Group
                      </div>
                    </div>

                    <div className="flex flex-1 flex-col space-y-4 p-5">
                      <h3 className="text-2xl font-semibold text-[#f5f0dd]">Group Booking</h3>
                      <p className="text-sm text-[#d7ded3]">
                        Book multiple rooms together for 10-20 guests at once.
                      </p>
                      <div className="grid grid-cols-1 gap-2 text-xs text-[#c4cec0]">
                        <span className="rounded-xl border border-lime-100/10 bg-black/15 px-3 py-2">
                          10-14 guests: all rooms except Pent House
                        </span>
                        <span className="rounded-xl border border-lime-100/10 bg-black/15 px-3 py-2">
                          15-20 guests: full house, including Pent House
                        </span>
                      </div>
                      <button
                        type="button"
                        className="btn-primary mt-auto w-full rounded-[1rem] px-4"
                        onClick={() => setShowGroupBooking((value) => !value)}
                      >
                        {showGroupBooking ? 'Hide group booking' : 'Book Now'}
                      </button>
                    </div>
                  </article>
                </div>
              ) : (
                <EmptyState title="No rooms yet" description="Add room listings from the admin panel." />
              )}

              {showGroupBooking ? (
                <div className="space-y-4 rounded-[1.5rem] border border-lime-100/10 bg-black/20 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-semibold text-[#f5f0dd]">Group booking</h3>
                      <p className="mt-1 text-sm text-[#cdd6c9]">
                        10-14 guests blocks all rooms except Pent House. 15-20 guests books the full house.
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

            {activeBooking.images?.length ? (
              <div className="relative mt-4 overflow-hidden rounded-[1.5rem]">
                <img
                  src={activeBooking.images[modalImageIndex]}
                  alt={`${activeBooking.name} photo ${modalImageIndex + 1}`}
                  className="h-48 w-full object-cover sm:h-64"
                />
                {activeBooking.images.length > 1 ? (
                  <>
                    <button
                      type="button"
                      aria-label="Previous photo"
                      onClick={() =>
                        setModalImageIndex((prev) => (prev - 1 + activeBooking.images.length) % activeBooking.images.length)
                      }
                      className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full border border-lime-100/15 bg-black/50 p-2 text-white backdrop-blur transition hover:bg-black/70"
                    >
                      <ChevronLeftIcon className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Next photo"
                      onClick={() => setModalImageIndex((prev) => (prev + 1) % activeBooking.images.length)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-lime-100/15 bg-black/50 p-2 text-white backdrop-blur transition hover:bg-black/70"
                    >
                      <ChevronRightIcon className="h-5 w-5" />
                    </button>
                    <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
                      {activeBooking.images.map((_, index) => (
                        <button
                          key={index}
                          type="button"
                          aria-label={`Go to photo ${index + 1}`}
                          onClick={() => setModalImageIndex(index)}
                          className={`h-1.5 w-4 rounded-full transition ${
                            index === modalImageIndex ? 'bg-lime-200' : 'bg-white/30'
                          }`}
                        />
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}

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
              <div className="rounded-[1.25rem] border border-lime-100/10 bg-black/20 px-4 py-3 text-xs text-[#cdd6c9]">
                <ul className="list-disc space-y-1 pl-4">
                  <li>Breakfast is complimentary.</li>
                  <li>Meal price is not included in the room total.</li>
                  <li>Lunch and dinner are Rs 350 per person per meal.</li>
                </ul>
              </div>

              <div className="flex items-center justify-between rounded-[1.25rem] border border-lime-100/10 bg-black/20 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-[#f5f0dd]">Adults</p>
                  <p className="text-xs text-[#aab5a5]">Age 13+</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    className="rounded-full border border-lime-100/15 p-2 text-white disabled:opacity-40"
                    type="button"
                    disabled={bookingDraft.adults <= (activeBooking?.minOccupancy || 1)}
                    onClick={() => {
                      const minOccupancy = activeBooking?.minOccupancy || 1;
                      if (bookingDraft.adults <= minOccupancy) {
                        toast.error(`Minimum occupants should be ${minOccupancy}`);
                        return;
                      }
                      setBookingDraft((prev) => clampMealCounts({ ...prev, adults: increment(prev.adults, -1, minOccupancy, 20) }));
                    }}
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
                  Meal preference is required for every guest. {bookingDraft.vegCount + bookingDraft.nonVegCount} of {modalTotalGuests} guest
                  {modalTotalGuests === 1 ? '' : 's'} assigned.
                </p>
              ) : null}
            </div>

            <div className="mt-5 rounded-[1.25rem] border border-lime-100/10 bg-black/20 p-4 text-sm text-[#cdd6c9]">
              <div className="flex items-center justify-between text-base font-bold text-lime-200">
                <span>Total</span>
                <span>{formatCurrency(modalEstimate)}</span>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                className="btn-secondary flex-1 border-lime-100/30 bg-lime-200/10 text-lime-100 hover:bg-lime-200/20 disabled:opacity-50"
                onClick={addCurrentRoomToCart}
                disabled={!modalMealSelectionComplete}
                type="button"
              >
                <span className="inline-flex items-center justify-center gap-2">
                  <PlusIcon className="h-4 w-4" />
                  Add Another Room
                </span>
              </button>
              <button
                className="btn-primary flex-1 disabled:opacity-50"
                onClick={() => setBookingStep('summary')}
                disabled={!modalMealSelectionComplete}
                type="button"
              >
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

                  <div className="mt-4 rounded-[1.25rem] border border-lime-100/10 bg-black/20 px-4 py-3 text-xs text-[#cdd6c9]">
                    <ul className="list-disc space-y-1 pl-4">
                      <li>Breakfast is complimentary.</li>
                      <li>Meal price is not included in the room total.</li>
                      <li>Lunch and dinner are Rs 350 per person per meal.</li>
                    </ul>
                  </div>

                  {roomCart.length > 0 ? (
                    <div className="mt-4 space-y-2 border-t border-white/10 pt-4 text-sm text-[#cdd6c9]">
                      <p className="text-xs uppercase tracking-[0.22em] text-lime-200/80">Other rooms in this booking</p>
                      {roomCart.map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-3 rounded-[1rem] border border-white/10 bg-black/20 px-3 py-2">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-white">{item.listing.name}</p>
                            <p className="text-xs text-[#aab5a5]">
                              {item.nights} night{item.nights === 1 ? '' : 's'} · {Number(item.draft.adults) + Number(item.draft.children)} guest
                              {Number(item.draft.adults) + Number(item.draft.children) === 1 ? '' : 's'}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-white">{formatCurrency(item.grandTotal)}</span>
                            <button
                              className="rounded-full p-1 text-[#aab5a5] hover:text-rose-400"
                              type="button"
                              onClick={() => removeCartItem(item.id)}
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-4 space-y-2 border-t border-white/10 pt-4 text-sm text-[#cdd6c9]">
                    <div className="flex items-center justify-between">
                      <span>This room ({modalNights} night{modalNights === 1 ? '' : 's'})</span>
                      <span className="font-semibold text-white">{formatCurrency(modalRoomTotal)}</span>
                    </div>
                    {bookingDraft.pets > 0 ? (
                      <div className="flex items-center justify-between">
                        <span>Pet fee</span>
                        <span className="font-semibold text-white">{formatCurrency(modalPetTotal)}</span>
                      </div>
                    ) : null}
                    {roomCart.length > 0 ? (
                      <div className="flex items-center justify-between">
                        <span>Subtotal (all rooms)</span>
                        <span className="font-semibold text-white">{formatCurrency(combinedSubtotal)}</span>
                      </div>
                    ) : null}
                    <div className="border-t border-white/10 pt-3">
                      <div className="flex items-center gap-2 text-white">
                        <TagIcon className="h-4 w-4 text-lime-200" />
                        <span className="text-sm font-semibold">Apply coupon</span>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <input
                          className="input uppercase"
                          placeholder="Coupon code"
                          value={couponCode}
                          onChange={(e) => {
                            setCouponCode(e.target.value);
                            setCouponOffer(null);
                          }}
                        />
                        <button
                          className="btn-secondary min-h-[48px] shrink-0 px-4"
                          onClick={applyCoupon}
                          disabled={couponChecking}
                          type="button"
                        >
                          {couponChecking ? 'Checking...' : 'Apply'}
                        </button>
                      </div>
                      {couponOffer ? (
                        <div className="mt-3 rounded-[1rem] border border-lime-300/20 bg-lime-300/5 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-lime-200">{couponOffer.coupon.title}</p>
                              <p className="mt-1 text-xs text-[#cdd6c9]">
                                Coupon {couponOffer.coupon.code} saves {formatCurrency(couponOffer.discount)}.
                              </p>
                            </div>
                            <button className="text-xs font-semibold text-rose-300" onClick={removeCoupon} type="button">
                              Remove
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                    {modalCouponDiscount > 0 ? (
                      <div className="flex items-center justify-between font-semibold text-lime-200">
                        <span>Coupon discount</span>
                        <span>-{formatCurrency(modalCouponDiscount)}</span>
                      </div>
                    ) : null}
                    <div className="flex items-center justify-between text-base font-bold text-lime-200">
                      <span>Revised total</span>
                      <span>{formatCurrency(modalFinalTotal)}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-lime-100/10 bg-[#0d1710]/80 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-lime-200/80">Know Before You Go</p>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-[#cdd6c9]">
                    <div className="rounded-[1rem] border border-lime-100/10 bg-black/20 px-3 py-2">
                      <p className="text-xs uppercase tracking-wide text-[#aab5a5]">Check-in</p>
                      <p className="font-semibold text-white">1:00 PM</p>
                    </div>
                    <div className="rounded-[1rem] border border-lime-100/10 bg-black/20 px-3 py-2">
                      <p className="text-xs uppercase tracking-wide text-[#aab5a5]">Check-out</p>
                      <p className="font-semibold text-white">10:00 AM</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="mt-3 flex w-full items-center justify-between rounded-[1rem] border border-lime-100/10 bg-black/20 px-3 py-2 text-left text-sm font-semibold text-white"
                    onClick={() => setPolicyExpanded((prev) => !prev)}
                  >
                    Cancellation &amp; Rescheduling Policy
                    <ChevronDownIcon className={`h-4 w-4 shrink-0 transition-transform ${policyExpanded ? 'rotate-180' : ''}`} />
                  </button>

                  {policyExpanded ? (
                    <div className="mt-2 space-y-3 rounded-[1rem] border border-lime-100/10 bg-black/20 p-3 text-xs text-[#cdd6c9]">
                      <div>
                        <p className="font-semibold text-white">Cancellation &amp; Refund</p>
                        <ul className="mt-1 list-disc space-y-1 pl-4">
                          <li>Full refund for cancellations made up to 14 days before check-in.</li>
                          <li>50% refund for cancellations made between 7 to 14 days before check-in date.</li>
                          <li>No refund for cancellations made less than 7 days before check-in date.</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-semibold text-white">Rescheduling Policy</p>
                        <ul className="mt-1 list-disc space-y-1 pl-4">
                          <li>No charges for rescheduling if done more than 14 days before check-in date.</li>
                          <li>A 10% fee will apply on the total stay cost for rescheduling made between 7 to 14 days before check-in date.</li>
                          <li>Rescheduling is not permitted within 7 days of the check-in date.</li>
                          <li>Post-rescheduling cancellation: once a booking is rescheduled, the option to cancel the booking will no longer be available.</li>
                        </ul>
                      </div>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    className="mt-2 flex w-full items-center justify-between rounded-[1rem] border border-lime-100/10 bg-black/20 px-3 py-2 text-left text-sm font-semibold text-white"
                    onClick={() => setHouseRulesExpanded((prev) => !prev)}
                  >
                    House Rules
                    <ChevronDownIcon className={`h-4 w-4 shrink-0 transition-transform ${houseRulesExpanded ? 'rotate-180' : ''}`} />
                  </button>

                  {houseRulesExpanded ? (
                    <div className="mt-2 space-y-3 rounded-[1rem] border border-lime-100/10 bg-black/20 p-3 text-xs text-[#cdd6c9]">
                      <p>
                        To ensure a harmonious and enjoyable experience for all guests, we kindly request your cooperation with the
                        following policies and house rules. If a group&apos;s conduct is found to disturb the peace, violate house
                        rules, or go against the spirit of the stay, the hosts reserve the right to take necessary action, including
                        on-the-spot cancellation without refund.
                      </p>
                      <div>
                        <p className="font-semibold text-white">Age Restriction</p>
                        <ul className="mt-1 list-disc space-y-1 pl-4">
                          <li>The minimum age for booking is 18 years.</li>
                          <li>
                            Children below 18 years must be accompanied by their parents at all times during the stay to ensure
                            safety and comfort for everyone.
                          </li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-semibold text-white">Identification Requirement</p>
                        <ul className="mt-1 list-disc space-y-1 pl-4">
                          <li>A valid government-issued ID with address is mandatory at the time of check-in for safety and security purposes.</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-semibold text-white">Self-Help Approach</p>
                        <ul className="mt-1 list-disc space-y-1 pl-4">
                          <li>There will be no luggage assistance or room service.</li>
                          <li>Food will be served only in the common dining area.</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-semibold text-white">Zero Tolerance Policy</p>
                        <ul className="mt-1 list-disc space-y-1 pl-4">
                          <li>Drugs, narcotics, and other intoxicants are strictly prohibited in and around the property.</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-semibold text-white">Smoking &amp; Alcohol Policy</p>
                        <ul className="mt-1 list-disc space-y-1 pl-4">
                          <li>We do not provide alcohol or cigarettes on the premises.</li>
                          <li>
                            If you choose to consume alcohol, please do so in your private room and keep noise levels down to avoid
                            disturbing others. If your group has booked the entire stay, you may use the common areas, but we still
                            encourage moderation to ensure everyone&apos;s comfort.
                          </li>
                          <li>Smoking is strictly not allowed inside rooms or inside the house.</li>
                          <li>Guests who wish to smoke may do so only outdoors, while respecting others and the surroundings.</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-semibold text-white">House Etiquette &amp; Quiet Hours</p>
                        <ul className="mt-1 list-disc space-y-1 pl-4">
                          <li>All rooms are inside one house — please be mindful of other guests.</li>
                          <li>Silent hours: 10:00 PM – 8:00 AM.</li>
                          <li>Common-area lights will be switched off by 10:00 PM (lights may be used inside your respective rooms).</li>
                          <li>Kindly avoid loud music or noise — let the sounds of nature heal you.</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-semibold text-white">Living with Nature</p>
                        <ul className="mt-1 list-disc space-y-1 pl-4">
                          <li>We co-exist with creatures of all shapes and sizes.</li>
                          <li>If you notice insects or animals, please do not panic — most are harmless and are part of the natural ecosystem.</li>
                        </ul>
                      </div>
                    </div>
                  ) : null}

                  <label className="mt-3 flex items-start gap-2 text-sm text-[#cdd6c9]">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 shrink-0 accent-lime-300"
                      checked={policyAccepted}
                      onChange={(e) => setPolicyAccepted(e.target.checked)}
                    />
                    <span>I have read and agree to the cancellation &amp; rescheduling policy and house rules.</span>
                  </label>
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
                  <button
                    className="btn-secondary flex-1 disabled:opacity-50"
                    onClick={() => setBookingStep('details')}
                    disabled={placingBooking}
                    type="button"
                  >
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
                    {placingBooking
                      ? 'Processing...'
                      : roomCart.length > 0
                      ? `Pay for ${roomCart.length + 1} Rooms`
                      : 'Proceed to Book'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {!activeBooking && roomCart.length > 0 ? (
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <div className="glass flex w-full max-w-xl items-center justify-between gap-4 rounded-full border border-lime-100/15 px-5 py-3 shadow-xl">
            <div className="flex items-center gap-3">
              <ShoppingBagIcon className="h-5 w-5 text-lime-200" />
              <div>
                <p className="text-sm font-semibold text-white">
                  {roomCart.length} room{roomCart.length === 1 ? '' : 's'} added
                </p>
                <p className="text-xs text-[#aab5a5]">{formatCurrency(cartSubtotal)} so far · pick another room to continue</p>
              </div>
            </div>
            <button
              className="rounded-full p-2 text-[#aab5a5] hover:text-rose-400"
              type="button"
              onClick={() => setRoomCart([])}
              title="Clear cart"
            >
              <TrashIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default HomePage;
