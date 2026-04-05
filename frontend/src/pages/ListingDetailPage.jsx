import { CalendarDaysIcon, MapPinIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { useEffect, useRef, useState } from 'react';
import DatePicker from 'react-datepicker';
import toast from 'react-hot-toast';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { formatCurrency, formatDateRange } from '../lib/formatters';
import { addDays, ensureCheckoutDate, parseDateParam } from '../lib/dateUtils';
import ListingCard from '../components/ListingCard';
import PageLoader from '../components/PageLoader';

const tomorrow = () => addDays(new Date(), 1);

function ListingDetailPage({ bookingFirst = false }) {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
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

  const [listing, setListing] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [booking, setBooking] = useState({
    startDate: initialStartDate,
    endDate: initialEndDate,
    guests: initialGuests,
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    specialRequests: '',
  });
  const [availability, setAvailability] = useState(null);
  const stayNights = Math.max(
    Math.round((booking.endDate.getTime() - booking.startDate.getTime()) / (1000 * 60 * 60 * 24)),
    1
  );

  useEffect(() => {
    const fetchListing = async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/listings/${slug}`);
        setListing(data.listing);
        setRelated(data.related);
        document.title = `Bowline | ${data.listing.name}`;
      } finally {
        setLoading(false);
      }
    };

    fetchListing();
  }, [slug]);

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
    setChecking(true);
    try {
      const { data } = await api.post(`/listings/${listing._id}/availability`, {
        startDate: booking.startDate,
        endDate: booking.endDate,
        guests: booking.guests,
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

    if (!user) {
      navigate('/login', { state: { from: `/experiences/${slug}` } });
      return;
    }

    if (!availability?.available) {
      toast.error('Please check availability before booking');
      return;
    }

    try {
      const { data } = await api.post('/bookings', {
        listingId: listing._id,
        ...booking,
      });
      toast.success('Booking created');
      navigate(`/booking/confirmation/${data.booking._id}`, { state: { booking: data.booking, resetBookingModal: true } });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to create booking');
    }
  };

  if (loading) {
    return <PageLoader label="Loading experience details..." />;
  }

  return (
    <section className="section-shell py-12">
      <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
        <div className={`space-y-6 ${isBookingIntent ? 'order-2' : ''}`}>
          <div className="overflow-hidden rounded-[2.5rem] border border-white/10">
            <img
              src={listing.images?.[0] || 'https://placehold.co/1200x800'}
              alt={listing.name}
              className="h-[420px] w-full object-cover"
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

        <div className={`space-y-6 ${isBookingIntent ? 'order-1' : ''}`}>
          <div ref={bookingFormRef} className="glass rounded-[2rem] p-6">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-sm text-[#b7c2b2]">Tariff</p>
                <h2 className="mt-2 text-4xl font-bold text-lime-200">{formatCurrency(listing.price)}</h2>
              </div>
              <p className="text-sm text-[#b7c2b2]">per {listing.priceUnit === 'person' ? 'person' : listing.priceUnit}</p>
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-lime-100/10 bg-[#0d1710]/80 p-4 text-sm text-[#c1cbbd]">
              Complimentary breakfast is included. Lunch and dinner can be added at 299 each. Choose your stay dates below before checking availability.
            </div>

            <form className="mt-6 space-y-4" onSubmit={submitBooking}>
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
                    minDate={addDays(booking.startDate, listing.type === 'room' ? 1 : 0)}
                  />
                </div>
              </div>
              <div>
                <label className="label">Guests</label>
                <input
                  className="input"
                  type="number"
                  min="1"
                  max={listing.capacity}
                  value={booking.guests}
                  onChange={(event) => {
                    setAvailability(null);
                    setBooking((prev) => ({ ...prev, guests: Number(event.target.value) }));
                  }}
                />
              </div>
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
              <div>
                <label className="label">Special requests</label>
                <textarea
                  className="input min-h-28"
                  value={booking.specialRequests}
                  onChange={(event) => setBooking((prev) => ({ ...prev, specialRequests: event.target.value }))}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button className="btn-secondary" type="button" onClick={checkAvailability} disabled={checking}>
                  {checking ? 'Checking...' : 'Check Availability'}
                </button>
                <button className="btn-primary" type="submit">
                  Send Booking Request
                </button>
              </div>
            </form>

            {availability ? (
              <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-slate-900/70 p-4 text-sm">
                <p className={availability.available ? 'text-emerald-300' : 'text-rose-300'}>{availability.reason}</p>
                <p className="mt-2 text-slate-300">Stay dates: {formatDateRange(booking.startDate, booking.endDate)}</p>
                <p className="text-slate-300">Duration: {stayNights} {stayNights === 1 ? 'night' : 'nights'}</p>
                <p className="text-slate-300">Guests: {booking.guests}</p>
                <p className="text-slate-300">Average nightly tariff: {formatCurrency(availability.pricing.unitPrice)} per person</p>
                <p className="text-slate-300">Estimated booking value: {formatCurrency(availability.pricing.totalPrice)}</p>
                {availability.pricing.adjustments?.length ? (
                  <p className="mt-2 text-slate-400">Applied tariff notes: {availability.pricing.adjustments.join(', ')}</p>
                ) : null}
              </div>
            ) : null}
          </div>

          {related.length ? (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-semibold text-white">{listing.type === 'room' ? 'More stays nearby' : 'You might also like'}</h3>
                <Link className="text-sm text-slate-300" to={`/${listing.type === 'room' ? 'stays' : `${listing.type}s`}`}>
                  See all
                </Link>
              </div>
              <div className="space-y-4">
                {related.map((item) => (
                  <ListingCard key={item._id} listing={item} />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default ListingDetailPage;
