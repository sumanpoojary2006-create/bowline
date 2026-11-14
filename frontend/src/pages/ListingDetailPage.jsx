import { CalendarDaysIcon, ChevronDownIcon, MapPinIcon, MinusIcon, PlusIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState, useCallback } from 'react';
import DatePicker from 'react-datepicker';
import toast from 'react-hot-toast';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBookingCart } from '../context/BookingCartContext';
import api from '../lib/api';
import { formatCurrency, formatDateRange } from '../lib/formatters';
import { addDays, ensureCheckoutDate, formatDateParam, parseDateParam } from '../lib/dateUtils';
import MealPolicyList from '../components/MealPolicyList';
import ListingCard, { getDescriptionPoints } from '../components/ListingCard';
import PageLoader from '../components/PageLoader';
import RoomCalendar from '../components/RoomCalendar';
import { petFee, getRoomRate, getRoomDisplayOrder } from '../lib/roomRates';

const increment = (value, amount, min = 0, max = 20) => Math.max(min, Math.min(max, Number(value || 0) + amount));

const tomorrow = () => addDays(new Date(), 1);

function ListingDetailPage({ bookingFirst = false }) {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { addItem, setIsOpen } = useBookingCart();
  const reduceMotion = useReducedMotion();
  const bookingFormRef = useRef(null);
  const bookingDetailsRef = useRef(null);
  const isBookingIntent = Boolean(bookingFirst || searchParams.get('intent') === 'book');

  const statePrefill = location.state?.bookingPrefill || {};
  const startFromState = parseDateParam(statePrefill.startDate);
  const endFromState = parseDateParam(statePrefill.endDate);
  const startFromQuery = parseDateParam(searchParams.get('startDate'));
  const endFromQuery = parseDateParam(searchParams.get('endDate'));

  const initialStartDate = startFromState || startFromQuery || tomorrow();
  const initialEndDate = ensureCheckoutDate(initialStartDate, endFromState || endFromQuery || addDays(initialStartDate, 1), 1);
  const initialGuests = Number(statePrefill.guests || searchParams.get('guests') || 1);
  const initialAdults = Number(statePrefill.adults || searchParams.get('adults') || initialGuests || 1);
  const initialChildren = Number(statePrefill.children || searchParams.get('children') || 0);
  const initialPets = Number(statePrefill.pets || searchParams.get('pets') || 0);
  const initialContactName = statePrefill.contactName || searchParams.get('contactName') || '';
  const initialContactEmail = statePrefill.contactEmail || searchParams.get('contactEmail') || '';
  const initialContactPhone = statePrefill.contactPhone || searchParams.get('contactPhone') || '';

  const [listing, setListing] = useState(null);
  const [related, setRelated] = useState([]);
  const [recommendedRooms, setRecommendedRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [datesConfirmed, setDatesConfirmed] = useState(false);
  const [roomDetailsOpen, setRoomDetailsOpen] = useState(false);
  const [stickyBarVisible, setStickyBarVisible] = useState(true);
  const [calendarOpen, setCalendarOpen] = useState(isBookingIntent);
  const calendarRef = useRef(null);
  const [booking, setBooking] = useState({
    startDate: initialStartDate,
    endDate: initialEndDate,
    adults: initialAdults,
    children: initialChildren,
    pets: initialPets,
    contactName: initialContactName,
    contactEmail: initialContactEmail,
    contactPhone: initialContactPhone,
  });
  const [availability, setAvailability] = useState(null);
  useEffect(() => {
    const fetchListing = async () => {
      setLoading(true);
      try {
        if (isBookingIntent) {
          const [listingRes, roomsRes] = await Promise.all([
            api.get(`/listings/${slug}`),
            api.get('/listings', { params: { type: 'room', limit: 100 } }),
          ]);

          setListing(listingRes.data.listing);
          setRelated(listingRes.data.related);
          setRecommendedRooms(
            roomsRes.data.listings
              .filter((room) => room._id !== listingRes.data.listing._id)
              .sort((a, b) => getRoomDisplayOrder(a) - getRoomDisplayOrder(b))
          );
          document.title = `Bowline | ${listingRes.data.listing.name}`;
          return;
        }

        const { data } = await api.get(`/listings/${slug}`);
        setListing(data.listing);
        setRelated(data.related);
        setRecommendedRooms([]);
        document.title = `Bowline | ${data.listing.name}`;
      } finally {
        setLoading(false);
      }
    };

    fetchListing();
  }, [slug, isBookingIntent]);

  useEffect(() => {
    if (!listing) return;
    const minGuests = getRoomRate(listing).min || 1;
    if (booking.adults < minGuests) {
      setBooking((prev) => ({ ...prev, adults: minGuests }));
    }
  }, [listing]);

  useEffect(() => {
    if (user) {
      setBooking((prev) => ({
        ...prev,
        contactName: prev.contactName || user.name,
        contactEmail: prev.contactEmail || user.email,
        contactPhone: prev.contactPhone || user.phone || '',
      }));
    }
  }, [user]);

  useEffect(() => {
    if (!isBookingIntent || loading || !bookingFormRef.current) return;
    bookingFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [isBookingIntent, loading]);

  // Hide sticky bar when booking form is in viewport
  useEffect(() => {
    if (!bookingFormRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => setStickyBarVisible(!entry.isIntersecting),
      { threshold: 0.1 }
    );
    observer.observe(bookingFormRef.current);
    return () => observer.disconnect();
  }, [loading]);

  useEffect(() => {
    if (!calendarOpen) return;
    const handler = (e) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target)) {
        setCalendarOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [calendarOpen]);

  const updateStartDate = (date) => {
    setAvailability(null);
    setDatesConfirmed(false);
    setBooking((prev) => ({
      ...prev,
      startDate: date,
      endDate: ensureCheckoutDate(date, prev.endDate, listing?.type === 'room' ? 1 : 0),
    }));
  };

  const updateEndDate = (date) => {
    setAvailability(null);
    setDatesConfirmed(false);
    setBooking((prev) => ({
      ...prev,
      endDate: ensureCheckoutDate(prev.startDate, date, listing?.type === 'room' ? 1 : 0),
    }));
  };

  const checkAvailability = async (selection = booking) => {
    if (!listing) return;
    setChecking(true);
    try {
      const { data } = await api.post(`/listings/${listing._id}/availability`, {
        startDate: formatDateParam(selection.startDate),
        endDate: formatDateParam(selection.endDate),
        guests: selection.adults + selection.children,
        adultGuests: selection.adults,
        childGuests: selection.children,
        pets: selection.pets,
      });
      setAvailability(data);
      if (!data.available) {
        toast.error(data.reason);
      }
      return data;
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to check availability right now');
      return null;
    } finally {
      setChecking(false);
    }
  };

  const handleRangeComplete = async ({ startDate, endDate }) => {
    const selection = { ...booking, startDate, endDate };
    setDatesConfirmed(false);
    const result = await checkAvailability(selection);

    if (!result?.available) return;

    setCalendarOpen(false);
  };

  const confirmAvailableDates = () => {
    setDatesConfirmed(true);
    window.requestAnimationFrame(() => {
      bookingDetailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const addAnotherRoom = () => {
    addItem(listing, booking.startDate, booking.endDate, booking.adults + booking.children);
    setIsOpen(false);
    toast.success(`${listing.name} added. Choose another room.`);

    const query = new URLSearchParams({
      startDate: formatDateParam(booking.startDate),
      endDate: formatDateParam(booking.endDate),
      guests: String(booking.adults + booking.children),
    });
    navigate(`/book-stay?${query.toString()}`);
  };

  const submitBooking = async (event) => {
    event.preventDefault();

    let currentAvailability = availability;
    if (!currentAvailability?.available) currentAvailability = await checkAvailability(booking);
    if (!currentAvailability?.available) return;

    setSubmitting(true);
    try {
      const { data } = await api.post('/bookings', {
        listingId: listing._id,
        startDate: formatDateParam(booking.startDate),
        endDate: formatDateParam(booking.endDate),
        guests: booking.adults + booking.children,
        adultGuests: booking.adults,
        childGuests: booking.children,
        pets: booking.pets,
        contactName: booking.contactName,
        contactEmail: booking.contactEmail,
        contactPhone: booking.contactPhone,
      });
      toast.success('Booking created');
      navigate(`/booking/confirmation/${data.booking._id}`, { state: { booking: data.booking, resetBookingModal: true } });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to create booking');
    } finally {
      setSubmitting(false);
    }
  };

  const openRecommendedRoomBooking = (room) => {
    const guests = booking.adults + booking.children;
    const query = new URLSearchParams({
      startDate: formatDateParam(booking.startDate),
      endDate: formatDateParam(booking.endDate),
      guests: String(guests),
      adults: String(booking.adults),
      children: String(booking.children),
      pets: String(booking.pets),
    });

    navigate(`/book-stay?${query.toString()}`, {
      state: {
        bookingPrefill: {
          startDate: formatDateParam(booking.startDate),
          endDate: formatDateParam(booking.endDate),
          guests: String(guests),
          adults: String(booking.adults),
          children: String(booking.children),
          pets: String(booking.pets),
        },
      },
    });
  };

  if (loading) {
    return <PageLoader label="Loading experience details..." />;
  }

  return (
    <section className="section-shell pb-28 pt-8 sm:py-12">
      <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
        <div className={`min-w-0 space-y-4 ${isBookingIntent ? 'order-2' : ''}`}>
          <div className="overflow-hidden rounded-[2.5rem] border border-white/10">
            <img
              src={listing.images?.[0] || 'https://placehold.co/1200x800'}
              alt={listing.name}
              className={`w-full object-cover ${isBookingIntent && listing.type === 'room' ? 'h-52 sm:h-[300px]' : 'h-56 sm:h-[420px]'}`}
            />
          </div>
          <div className="glass rounded-[2rem] p-5 sm:p-6">
            {isBookingIntent && listing.type === 'room' ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="rounded-full bg-lime-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-950">
                    {listing.type}
                  </span>
                  <span className="inline-flex items-center gap-2 text-sm text-slate-300">
                    <UserGroupIcon className="h-4 w-4" />
                    Up to {listing.capacity} guests
                  </span>
                </div>

                <h1 className="mt-4 font-display text-4xl text-white sm:text-5xl">{listing.name}</h1>
                <button
                  type="button"
                  className="mt-5 flex w-full items-center justify-between gap-4 rounded-[1.25rem] border border-lime-100/20 bg-lime-100/[0.06] px-4 py-3 text-left text-sm font-semibold text-lime-100 transition hover:bg-lime-100/10"
                  onClick={() => setRoomDetailsOpen((open) => !open)}
                  aria-expanded={roomDetailsOpen}
                >
                  Click here to know more about the room
                  <ChevronDownIcon className={`h-5 w-5 shrink-0 transition-transform ${roomDetailsOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence initial={false}>
                {roomDetailsOpen ? (
                  <motion.div
                    className="overflow-hidden"
                    initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
                    transition={{ duration: reduceMotion ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
                  >
                  <div className="mt-5 border-t border-white/10 pt-5">
                    <ul className="space-y-3 text-base text-slate-200">
                      {getDescriptionPoints(listing.shortDescription || listing.description).map((point, index) => (
                        <li key={`${point.text}-${index}`} className="flex items-start gap-3">
                          <span aria-hidden="true">{point.emoji}</span>
                          <span>{point.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  </motion.div>
                ) : null}
                </AnimatePresence>
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
                  <span className="rounded-full bg-lime-200 px-3 py-1 font-semibold uppercase tracking-[0.22em] text-slate-950">
                    {listing.type}
                  </span>
                  {listing.type !== 'room' ? (
                    <>
                      <span className="inline-flex items-center gap-2">
                        <MapPinIcon className="h-4 w-4" />
                        Bowline Nature Stay, Devaramane, Mudigere, Chikkamagaluru
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <CalendarDaysIcon className="h-4 w-4" />
                        {listing.duration || 'Stay by selected dates'}
                      </span>
                    </>
                  ) : null}
                  <span className="inline-flex items-center gap-2">
                    <UserGroupIcon className="h-4 w-4" />
                    Capacity {listing.capacity}
                  </span>
                </div>
                <h1 className="mt-5 font-display text-5xl text-white">{listing.name}</h1>
                {listing.type === 'room' ? (
                  <ul className="mt-6 space-y-3 text-base text-slate-200">
                    {getDescriptionPoints(listing.shortDescription || listing.description).map((point, index) => (
                      <li key={`${point.text}-${index}`} className="flex items-start gap-3">
                        <span aria-hidden="true">{point.emoji}</span>
                        <span>{point.text}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <>
                    <p className="mt-5 text-base leading-7 text-slate-300">{listing.description}</p>
                    <div className="mt-6 flex flex-wrap gap-2">
                      {[...(listing.amenities || []), ...(listing.facilities || [])].map((item) => (
                        <span key={item} className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200">
                          {item}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        <div className={`min-w-0 space-y-6 ${isBookingIntent ? 'order-1' : ''}`}>
          <div ref={bookingFormRef} className="glass rounded-[2rem] p-6">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-sm text-[#b7c2b2]">Tariff</p>
                <h2 className="mt-2 text-4xl font-bold text-lime-200">{formatCurrency(listing.price)}</h2>
              </div>
              <p className="text-sm text-[#b7c2b2]">per {listing.priceUnit === 'person' ? 'person' : listing.priceUnit}</p>
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-lime-100/10 bg-[#0d1710]/80 p-4 text-sm text-[#c1cbbd]">
              <MealPolicyList />
            </div>

            <form className="mt-6 space-y-4" onSubmit={submitBooking}>
              {listing.type === 'room' ? (
                <div>
                  <label className="label">Select dates</label>
                  <div ref={calendarRef} className="relative mt-2">
                    {/* Pill trigger */}
                    <button
                      type="button"
                      onClick={() => setCalendarOpen((o) => !o)}
                      className="flex w-full items-center justify-between gap-3 rounded-2xl border border-lime-100/18 bg-[#142018]/78 px-4 py-3 text-left transition hover:bg-[#142018]"
                    >
                      <div className="flex items-center gap-3">
                        <CalendarDaysIcon className="h-5 w-5 shrink-0 text-lime-200" />
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#98a791]">Check-in</p>
                          <p className="text-sm font-semibold text-[#f5f0dd]">
                            {booking.startDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                          </p>
                        </div>
                      </div>
                      <div className="h-px flex-1 bg-lime-100/10" />
                      <div className="text-right">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#98a791]">Check-out</p>
                        <p className="text-sm font-semibold text-[#f5f0dd]">
                          {booking.endDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </p>
                      </div>
                    </button>

                    {/* Floating calendar — dropdown on desktop, bottom sheet on mobile */}
                    <AnimatePresence initial={false}>
                    {calendarOpen && (
                      <>
                        {/* Mobile: full-screen overlay */}
                        <motion.div
                          key="calendar-overlay"
                          className="fixed inset-0 z-40 bg-black/60 sm:hidden"
                          initial={reduceMotion ? false : { opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={reduceMotion ? undefined : { opacity: 0 }}
                          transition={{ duration: reduceMotion ? 0 : 0.18 }}
                        />
                        <motion.div
                          key="calendar-panel"
                          className="fixed bottom-0 left-0 right-0 z-50 origin-top overflow-hidden rounded-t-3xl border-t border-lime-100/14 bg-[#090f0b] sm:absolute sm:bottom-auto sm:top-[calc(100%+0.5rem)] sm:rounded-2xl sm:border sm:shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
                          initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.985 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={reduceMotion ? undefined : { opacity: 0, y: 8, scale: 0.99 }}
                          transition={{ duration: reduceMotion ? 0 : 0.26, ease: [0.22, 1, 0.36, 1] }}
                        >
                          <div className="flex items-center justify-between border-b border-lime-100/10 px-4 py-3 sm:hidden">
                            <p className="text-sm font-semibold text-[#f5f0dd]">Select dates</p>
                            <button
                              type="button"
                              onClick={() => setCalendarOpen(false)}
                              className="text-xs font-semibold text-lime-300"
                            >
                              Done
                            </button>
                          </div>
                          <div className="max-h-[80vh] overflow-y-auto p-4 sm:max-h-none">
                            <RoomCalendar
                              listingId={listing._id}
                              startDate={booking.startDate}
                              endDate={booking.endDate}
                              onStartDate={updateStartDate}
                              onEndDate={updateEndDate}
                              onRangeComplete={handleRangeComplete}
                            />
                          </div>
                        </motion.div>
                      </>
                    )}
                    </AnimatePresence>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label">Check-in date</label>
                    <DatePicker
                      selected={booking.startDate}
                      onChange={(date) => updateStartDate(date)}
                      className="input"
                      minDate={tomorrow()}
                    />
                  </div>
                  <div>
                    <label className="label">Check-out date</label>
                    <DatePicker
                      selected={booking.endDate}
                      onChange={(date) => updateEndDate(date)}
                      className="input"
                      minDate={addDays(booking.startDate, 0)}
                    />
                  </div>
                </div>
              )}
              <AnimatePresence mode="wait" initial={false}>
              {listing.type === 'room' && availability ? (
                <motion.div
                  key={`${availability.available}-${formatDateParam(booking.startDate)}-${formatDateParam(booking.endDate)}`}
                  className={`rounded-[1.5rem] border p-4 ${
                    availability.available
                      ? 'border-emerald-300/30 bg-emerald-300/10'
                      : 'border-rose-300/30 bg-rose-300/10'
                  }`}
                  aria-live="polite"
                  initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -6, scale: 0.99 }}
                  transition={{ duration: reduceMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
                >
                  <p className={`font-semibold ${availability.available ? 'text-emerald-200' : 'text-rose-200'}`}>
                    {availability.available ? 'Your selected dates are available' : availability.reason}
                  </p>
                  <p className="mt-1 text-sm text-slate-200">{formatDateRange(booking.startDate, booking.endDate)}</p>
                  {availability.available ? (
                    <>
                      <p className="mt-1 text-sm text-slate-300">
                        Estimated booking value: {formatCurrency(availability.pricing.totalPrice)} including GST
                      </p>
                      {!datesConfirmed ? (
                        <button className="btn-primary mt-4 w-full" type="button" onClick={confirmAvailableDates}>
                          Continue with these dates
                        </button>
                      ) : null}
                    </>
                  ) : (
                    <button className="btn-secondary mt-4 w-full" type="button" onClick={() => setCalendarOpen(true)}>
                      Choose different dates
                    </button>
                  )}
                </motion.div>
              ) : null}
              </AnimatePresence>
              {listing.type !== 'room' || datesConfirmed ? (
                <motion.div
                  className="space-y-4"
                  initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
                >
              {listing.type === 'room' ? (
                <div ref={bookingDetailsRef} className="scroll-mt-24 space-y-3">
                  <div className="flex items-center justify-between rounded-[1.25rem] border border-white/10 bg-[#0d1710]/80 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-white">Adults</p>
                      <p className="text-xs text-slate-500">Age 13+</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        className="rounded-full border border-white/15 p-2 text-white disabled:opacity-40"
                        type="button"
                        disabled={booking.adults <= (getRoomRate(listing).min || 1)}
                        onClick={() => {
                          setAvailability(null);
                          setBooking((prev) => ({
                            ...prev,
                            adults: increment(prev.adults, -1, getRoomRate(listing).min || 1, 20),
                          }));
                        }}
                      >
                        <MinusIcon className="h-4 w-4" />
                      </button>
                      <span className="w-6 text-center text-sm font-semibold text-white">{booking.adults}</span>
                      <button
                        className="rounded-full border border-white/15 p-2 text-white disabled:opacity-40"
                        type="button"
                        onClick={() => {
                          setAvailability(null);
                          setBooking((prev) => ({
                            ...prev,
                            adults: increment(prev.adults, 1, getRoomRate(listing).min || 1, 20),
                          }));
                        }}
                      >
                        <PlusIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="rounded-[1.25rem] border border-white/10 bg-[#0d1710]/80 px-4 py-3 text-xs text-slate-400">
                    <MealPolicyList />
                  </div>

                  <div className="flex items-center justify-between rounded-[1.25rem] border border-white/10 bg-[#0d1710]/80 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-white">Children</p>
                      <p className="text-xs text-slate-500">Age 6-12 · 50% of adult tariff</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        className="rounded-full border border-white/15 p-2 text-white disabled:opacity-40"
                        type="button"
                        disabled={booking.children <= 0}
                        onClick={() => {
                          setAvailability(null);
                          setBooking((prev) => ({ ...prev, children: increment(prev.children, -1, 0, 20) }));
                        }}
                      >
                        <MinusIcon className="h-4 w-4" />
                      </button>
                      <span className="w-6 text-center text-sm font-semibold text-white">{booking.children}</span>
                      <button
                        className="rounded-full border border-white/15 p-2 text-white disabled:opacity-40"
                        type="button"
                        onClick={() => {
                          setAvailability(null);
                          setBooking((prev) => ({ ...prev, children: increment(prev.children, 1, 0, 20) }));
                        }}
                      >
                        <PlusIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-[1.25rem] border border-white/10 bg-[#0d1710]/80 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-white">Pets</p>
                      <p className="text-xs text-slate-500">{formatCurrency(petFee)} flat per pet, per stay</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        className="rounded-full border border-white/15 p-2 text-white disabled:opacity-40"
                        type="button"
                        disabled={booking.pets <= 0}
                        onClick={() => {
                          setAvailability(null);
                          setBooking((prev) => ({ ...prev, pets: increment(prev.pets, -1, 0, 10) }));
                        }}
                      >
                        <MinusIcon className="h-4 w-4" />
                      </button>
                      <span className="w-6 text-center text-sm font-semibold text-white">{booking.pets}</span>
                      <button
                        className="rounded-full border border-white/15 p-2 text-white disabled:opacity-40"
                        type="button"
                        onClick={() => {
                          setAvailability(null);
                          setBooking((prev) => ({ ...prev, pets: increment(prev.pets, 1, 0, 10) }));
                        }}
                      >
                        <PlusIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                </div>
              ) : (
                <div ref={bookingDetailsRef} className="scroll-mt-24">
                  <label className="label">Guests</label>
                  <input
                    className="input"
                    type="number"
                    min={getRoomRate(listing).min || 1}
                    max={listing.capacity}
                    value={booking.adults}
                    onChange={(event) => {
                      setAvailability(null);
                      const minGuests = getRoomRate(listing).min || 1;
                      setBooking((prev) => ({
                        ...prev,
                        adults: Math.max(minGuests, Number(event.target.value)),
                      }));
                    }}
                  />
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Contact name</label>
                  <input
                    className="input"
                    required
                    value={booking.contactName}
                    onChange={(event) => setBooking((prev) => ({ ...prev, contactName: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">Contact email</label>
                  <input
                    className="input"
                    type="email"
                    required
                    value={booking.contactEmail}
                    onChange={(event) => setBooking((prev) => ({ ...prev, contactEmail: event.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="label">Contact phone</label>
                <input
                  className="input"
                  required
                  value={booking.contactPhone}
                  onChange={(event) => setBooking((prev) => ({ ...prev, contactPhone: event.target.value }))}
                />
              </div>

              <button className="btn-primary w-full disabled:opacity-50" type="submit" disabled={checking || submitting}>
                {checking ? 'Checking your dates...' : submitting ? 'Starting your booking...' : 'Continue to booking'}
              </button>
              {listing.type === 'room' && (
                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-2 rounded-[1.25rem] border border-white/20 bg-white/5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
                  onClick={addAnotherRoom}
                >
                  <PlusIcon className="h-4 w-4" />
                  Add Another Room
                </button>
              )}
                </motion.div>
              ) : null}
            </form>
          </div>

        </div>
      </div>

      {(isBookingIntent && listing.type === 'room' ? recommendedRooms.length : related.length) ? (
        <div className="mt-10 min-w-0">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h3 className="text-xl font-semibold text-white sm:text-2xl">
              {isBookingIntent && listing.type === 'room'
                ? 'Other rooms you might be interested in'
                : listing.type === 'room'
                  ? 'More stays nearby'
                  : 'You might also like'}
            </h3>
            {isBookingIntent && listing.type === 'room' ? null : (
              <Link className="shrink-0 text-sm text-slate-300" to={`/${listing.type === 'room' ? 'stays' : `${listing.type}s`}`}>
                See all
              </Link>
            )}
          </div>
          {isBookingIntent && listing.type === 'room' ? (
            <div className="grid items-stretch gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {recommendedRooms.map((item) => (
                <div key={item._id} className="min-w-0">
                  <ListingCard
                    listing={item}
                    onBookNow={openRecommendedRoomBooking}
                    compact
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {related.map((item) => (
                <ListingCard key={item._id} listing={item} />
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* Sticky mobile booking bar — hidden once booking form is in view */}
      {listing && stickyBarVisible && (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/10 bg-[#0d1710]/95 px-4 py-3 backdrop-blur-xl sm:hidden">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-slate-400">From</p>
              <p className="text-lg font-bold text-lime-200">{formatCurrency(listing.price)}</p>
              <p className="text-xs text-slate-400">per {listing.priceUnit === 'person' ? 'person' : listing.priceUnit}</p>
            </div>
            <button
              type="button"
              className="btn-primary flex-1 rounded-[1.25rem] text-base"
              onClick={() => bookingFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            >
              Book Now
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export default ListingDetailPage;
