import { CalendarDaysIcon, MapPinIcon, MinusIcon, PlusIcon, ShoppingBagIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { useEffect, useRef, useState, useCallback } from 'react';
import DatePicker from 'react-datepicker';
import toast from 'react-hot-toast';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBookingCart } from '../context/BookingCartContext';
import api from '../lib/api';
import { formatCurrency, formatDateRange } from '../lib/formatters';
import { addDays, ensureCheckoutDate, formatDateParam, parseDateParam } from '../lib/dateUtils';
import ListingCard from '../components/ListingCard';
import PageLoader from '../components/PageLoader';
import RoomCalendar from '../components/RoomCalendar';
import { petFee, getRoomRate } from '../lib/roomRates';

const increment = (value, amount, min = 0, max = 20) => Math.max(min, Math.min(max, Number(value || 0) + amount));

const tomorrow = () => addDays(new Date(), 1);

function ListingDetailPage({ bookingFirst = false }) {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { addItem } = useBookingCart();
  const bookingFormRef = useRef(null);
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
  const initialVegCount = Number(statePrefill.vegCount ?? searchParams.get('vegCount') ?? 0);
  const initialNonVegCount = Number(statePrefill.nonVegCount ?? searchParams.get('nonVegCount') ?? 0);
  const initialContactName = statePrefill.contactName || searchParams.get('contactName') || '';
  const initialContactEmail = statePrefill.contactEmail || searchParams.get('contactEmail') || '';
  const initialContactPhone = statePrefill.contactPhone || searchParams.get('contactPhone') || '';

  const [listing, setListing] = useState(null);
  const [related, setRelated] = useState([]);
  const [recommendedRooms, setRecommendedRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [stickyBarVisible, setStickyBarVisible] = useState(true);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const calendarRef = useRef(null);
  const [booking, setBooking] = useState({
    startDate: initialStartDate,
    endDate: initialEndDate,
    adults: initialAdults,
    children: initialChildren,
    pets: initialPets,
    vegCount: initialVegCount,
    nonVegCount: initialNonVegCount,
    contactName: initialContactName,
    contactEmail: initialContactEmail,
    contactPhone: initialContactPhone,
  });
  const [availability, setAvailability] = useState(null);
  const stayNights = Math.max(
    Math.round((booking.endDate.getTime() - booking.startDate.getTime()) / (1000 * 60 * 60 * 24)),
    1
  );
  const bookingTotalGuests = Number(booking.adults) + Number(booking.children);
  const mealSelectionComplete = listing?.type !== 'room' || booking.vegCount + booking.nonVegCount === bookingTotalGuests;

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
            roomsRes.data.listings.filter((room) => room._id !== listingRes.data.listing._id)
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
    setBooking((prev) => ({
      ...prev,
      startDate: date,
      endDate: ensureCheckoutDate(date, prev.endDate, listing?.type === 'room' ? 1 : 0),
    }));
  };

  const updateEndDate = (date) => {
    setAvailability(null);
    setBooking((prev) => ({
      ...prev,
      endDate: ensureCheckoutDate(prev.startDate, date, listing?.type === 'room' ? 1 : 0),
    }));
  };

  const checkAvailability = async () => {
    if (!listing) return;
    if (listing.type === 'room' && !mealSelectionComplete) {
      toast.error('Please assign a veg or non-veg meal preference for every guest');
      return;
    }
    setChecking(true);
    try {
      const { data } = await api.post(`/listings/${listing._id}/availability`, {
        startDate: booking.startDate,
        endDate: booking.endDate,
        guests: booking.adults + booking.children,
        adultGuests: booking.adults,
        childGuests: booking.children,
        pets: booking.pets,
        vegCount: booking.vegCount,
        nonVegCount: booking.nonVegCount,
      });
      setAvailability(data);
      if (!data.available) {
        toast.error(data.reason);
      }
    } finally {
      setChecking(false);
    }
  };

  const submitBooking = async (event) => {
    event.preventDefault();

    if (!availability?.available) {
      toast.error('Please check availability before booking');
      return;
    }

    if (listing.type === 'room' && !mealSelectionComplete) {
      toast.error('Please assign a veg or non-veg meal preference for every guest');
      return;
    }

    try {
      const { data } = await api.post('/bookings', {
        listingId: listing._id,
        startDate: booking.startDate,
        endDate: booking.endDate,
        guests: booking.adults + booking.children,
        adultGuests: booking.adults,
        childGuests: booking.children,
        pets: booking.pets,
        vegCount: booking.vegCount,
        nonVegCount: booking.nonVegCount,
        contactName: booking.contactName,
        contactEmail: booking.contactEmail,
        contactPhone: booking.contactPhone,
      });
      toast.success('Booking created');
      navigate(`/booking/confirmation/${data.booking._id}`, { state: { booking: data.booking, resetBookingModal: true } });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to create booking');
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
      vegCount: String(booking.vegCount),
      nonVegCount: String(booking.nonVegCount),
    });

    navigate(`/book/${room.slug}?${query.toString()}`, {
      state: {
        bookingPrefill: {
          startDate: formatDateParam(booking.startDate),
          endDate: formatDateParam(booking.endDate),
          guests: String(guests),
          adults: String(booking.adults),
          children: String(booking.children),
          pets: String(booking.pets),
          vegCount: String(booking.vegCount),
          nonVegCount: String(booking.nonVegCount),
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
        <div className={`min-w-0 space-y-6 ${isBookingIntent ? 'order-2' : ''}`}>
          <div className="overflow-hidden rounded-[2.5rem] border border-white/10">
            <img
              src={listing.images?.[0] || 'https://placehold.co/1200x800'}
              alt={listing.name}
              className="h-56 w-full object-cover sm:h-[420px]"
            />
          </div>
          <div className="glass rounded-[2rem] p-6">
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
              <span className="rounded-full bg-lime-200 px-3 py-1 font-semibold uppercase tracking-[0.22em] text-slate-950">
                {listing.type}
              </span>
              <span className="inline-flex items-center gap-2">
                <MapPinIcon className="h-4 w-4" />
                Bowline Nature Stay, Devaramane, Mudigere, Chikkamagaluru
              </span>
              <span className="inline-flex items-center gap-2">
                <CalendarDaysIcon className="h-4 w-4" />
                {listing.duration || 'Stay by selected dates'}
              </span>
              <span className="inline-flex items-center gap-2">
                <UserGroupIcon className="h-4 w-4" />
                Capacity {listing.capacity}
              </span>
            </div>

            <h1 className="mt-5 font-display text-5xl text-white">{listing.name}</h1>
            <p className="mt-5 text-base leading-7 text-slate-300">{listing.description}</p>

            <div className="mt-6 flex flex-wrap gap-2">
              {[...(listing.amenities || []), ...(listing.facilities || [])].map((item) => (
                <span key={item} className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200">
                  {item}
                </span>
              ))}
            </div>
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
              <ul className="list-disc space-y-1 pl-4">
                <li>Breakfast is complimentary.</li>
                <li>Meal price is not included in the room total.</li>
                <li>Lunch and dinner are Rs 350 per person per meal.</li>
              </ul>
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
                    {calendarOpen && (
                      <>
                        {/* Mobile: full-screen overlay */}
                        <div className="fixed inset-0 z-40 bg-black/60 sm:hidden" />
                        <div className="fixed bottom-0 left-0 right-0 z-50 overflow-hidden rounded-t-3xl border-t border-lime-100/14 bg-[#090f0b] sm:absolute sm:bottom-auto sm:top-[calc(100%+0.5rem)] sm:rounded-2xl sm:border sm:shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
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
                              onEndDate={(d) => { updateEndDate(d); setCalendarOpen(false); }}
                            />
                          </div>
                        </div>
                      </>
                    )}
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
                      minDate={new Date()}
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
              {listing.type === 'room' ? (
                <div className="space-y-3">
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
                    <ul className="list-disc space-y-1 pl-4">
                      <li>Breakfast is complimentary.</li>
                      <li>Meal price is not included in the room total.</li>
                      <li>Lunch and dinner are Rs 350 per person per meal.</li>
                    </ul>
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

                  <div className="flex items-center justify-between rounded-[1.25rem] border border-white/10 bg-[#0d1710]/80 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-white">Veg meals</p>
                      <p className="text-xs text-slate-500">Number of guests on veg meals</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        className="rounded-full border border-white/15 p-2 text-white disabled:opacity-40"
                        type="button"
                        disabled={booking.vegCount <= 0}
                        onClick={() => {
                          setAvailability(null);
                          setBooking((prev) => ({ ...prev, vegCount: increment(prev.vegCount, -1, 0, bookingTotalGuests) }));
                        }}
                      >
                        <MinusIcon className="h-4 w-4" />
                      </button>
                      <span className="w-6 text-center text-sm font-semibold text-white">{booking.vegCount}</span>
                      <button
                        className="rounded-full border border-white/15 p-2 text-white disabled:opacity-40"
                        type="button"
                        disabled={booking.vegCount >= bookingTotalGuests}
                        onClick={() => {
                          setAvailability(null);
                          setBooking((prev) => {
                            const vegCount = increment(prev.vegCount, 1, 0, bookingTotalGuests);
                            const nonVegCount = Math.min(prev.nonVegCount, bookingTotalGuests - vegCount);
                            return { ...prev, vegCount, nonVegCount };
                          });
                        }}
                      >
                        <PlusIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-[1.25rem] border border-white/10 bg-[#0d1710]/80 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-white">Non-veg meals</p>
                      <p className="text-xs text-slate-500">Number of guests on non-veg meals</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        className="rounded-full border border-white/15 p-2 text-white disabled:opacity-40"
                        type="button"
                        disabled={booking.nonVegCount <= 0}
                        onClick={() => {
                          setAvailability(null);
                          setBooking((prev) => ({ ...prev, nonVegCount: increment(prev.nonVegCount, -1, 0, bookingTotalGuests) }));
                        }}
                      >
                        <MinusIcon className="h-4 w-4" />
                      </button>
                      <span className="w-6 text-center text-sm font-semibold text-white">{booking.nonVegCount}</span>
                      <button
                        className="rounded-full border border-white/15 p-2 text-white disabled:opacity-40"
                        type="button"
                        disabled={booking.nonVegCount >= bookingTotalGuests}
                        onClick={() => {
                          setAvailability(null);
                          setBooking((prev) => {
                            const nonVegCount = increment(prev.nonVegCount, 1, 0, bookingTotalGuests);
                            const vegCount = Math.min(prev.vegCount, bookingTotalGuests - nonVegCount);
                            return { ...prev, nonVegCount, vegCount };
                          });
                        }}
                      >
                        <PlusIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {booking.vegCount + booking.nonVegCount !== booking.adults + booking.children ? (
                    <p className="px-1 text-xs text-amber-300">
                      Meal preference is required for every guest. {booking.vegCount + booking.nonVegCount} of {booking.adults + booking.children} guest
                      {booking.adults + booking.children === 1 ? '' : 's'} assigned.
                    </p>
                  ) : null}
                </div>
              ) : (
                <div>
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
                    value={booking.contactName}
                    onChange={(event) => setBooking((prev) => ({ ...prev, contactName: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">Contact email</label>
                  <input
                    className="input"
                    type="email"
                    value={booking.contactEmail}
                    onChange={(event) => setBooking((prev) => ({ ...prev, contactEmail: event.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="label">Contact phone</label>
                <input
                  className="input"
                  value={booking.contactPhone}
                  onChange={(event) => setBooking((prev) => ({ ...prev, contactPhone: event.target.value }))}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button className="btn-secondary disabled:opacity-50" type="button" onClick={checkAvailability} disabled={checking || !mealSelectionComplete}>
                  {checking ? 'Checking...' : 'Check Availability'}
                </button>
                <button className="btn-primary disabled:opacity-50" type="submit" disabled={!mealSelectionComplete}>
                  Send Booking Request
                </button>
              </div>
              {listing.type === 'room' && (
                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-2 rounded-[1.25rem] border border-white/20 bg-white/5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
                  onClick={() => {
                    addItem(listing, booking.startDate, booking.endDate, booking.adults + booking.children);
                    toast.success(`${listing.name} added to cart`);
                  }}
                >
                  <ShoppingBagIcon className="h-4 w-4" />
                  Add to Cart
                </button>
              )}
            </form>

            {availability ? (
              <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-slate-900/70 p-4 text-sm">
                <p className={availability.available ? 'text-emerald-300' : 'text-rose-300'}>{availability.reason}</p>
                <p className="mt-2 text-slate-300">Stay dates: {formatDateRange(booking.startDate, booking.endDate)}</p>
                <p className="text-slate-300">Duration: {stayNights} {stayNights === 1 ? 'night' : 'nights'}</p>
                <p className="text-slate-300">
                  Guests: {booking.adults} adult{booking.adults === 1 ? '' : 's'}
                  {booking.children > 0 ? `, ${booking.children} child${booking.children === 1 ? '' : 'ren'}` : ''}
                  {booking.pets > 0 ? `, ${booking.pets} pet${booking.pets === 1 ? '' : 's'}` : ''}
                </p>
                {listing.type === 'room' ? (
                  <p className="text-slate-300">
                    Meals: {booking.vegCount} veg, {booking.nonVegCount} non-veg
                  </p>
                ) : null}
                <p className="text-slate-300">Average nightly tariff: {formatCurrency(availability.pricing.unitPrice)} per person</p>
                <p className="text-slate-300">Estimated booking value: {formatCurrency(availability.pricing.totalPrice)}</p>
                {availability.pricing.adjustments?.length ? (
                  <p className="mt-2 text-slate-400">Applied tariff notes: {availability.pricing.adjustments.join(', ')}</p>
                ) : null}
              </div>
            ) : null}
          </div>

          {(isBookingIntent && listing.type === 'room' ? recommendedRooms.length : related.length) ? (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-semibold text-white">
                  {isBookingIntent && listing.type === 'room'
                    ? 'Other rooms you might be interested in'
                    : listing.type === 'room'
                      ? 'More stays nearby'
                      : 'You might also like'}
                </h3>
                {isBookingIntent && listing.type === 'room' ? null : (
                  <Link className="text-sm text-slate-300" to={`/${listing.type === 'room' ? 'stays' : `${listing.type}s`}`}>
                    See all
                  </Link>
                )}
              </div>
              {isBookingIntent && listing.type === 'room' ? (
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {recommendedRooms.map((item) => (
                    <div key={item._id} className="min-w-[290px] max-w-[290px] flex-shrink-0">
                      <ListingCard
                        listing={item}
                        onBookNow={openRecommendedRoomBooking}
                        compact
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {related.map((item) => (
                    <ListingCard key={item._id} listing={item} />
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

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
