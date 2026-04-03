import { CalendarDaysIcon, MapPinIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import DatePicker from 'react-datepicker';
import toast from 'react-hot-toast';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { formatCurrency, formatDate } from '../lib/formatters';
import ListingCard from '../components/ListingCard';
import PageLoader from '../components/PageLoader';

const tomorrow = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date;
};

function ListingDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const queryStartDate = searchParams.get('startDate');
  const queryEndDate = searchParams.get('endDate');
  const queryGuests = searchParams.get('guests');
  const [listing, setListing] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [booking, setBooking] = useState({
    startDate: queryStartDate ? new Date(queryStartDate) : tomorrow(),
    endDate: queryEndDate ? new Date(queryEndDate) : tomorrow(),
    guests: Number(queryGuests || 1),
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    specialRequests: '',
  });
  const [availability, setAvailability] = useState(null);

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
      navigate(`/booking/confirmation/${data.booking._id}`, { state: { booking: data.booking } });
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
        <div className="space-y-6">
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
                {listing.location}
              </span>
              <span className="inline-flex items-center gap-2">
                <CalendarDaysIcon className="h-4 w-4" />
                {listing.duration || 'Flexible duration'}
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

            {listing.availableDates?.length ? (
              <div className="mt-8 rounded-[1.5rem] bg-slate-900/70 p-4">
                <p className="text-sm font-semibold text-white">Available dates</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {listing.availableDates.map((date) => (
                    <span key={date} className="rounded-full bg-white/5 px-3 py-2 text-xs text-slate-300">
                      {formatDate(date)}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass rounded-[2rem] p-6">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-sm text-[#b7c2b2]">Indicative price</p>
                <h2 className="mt-2 text-4xl font-bold text-lime-200">{formatCurrency(listing.price)}</h2>
              </div>
              <p className="text-sm text-[#b7c2b2]">per {listing.priceUnit}</p>
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-lime-100/10 bg-[#0d1710]/80 p-4 text-sm text-[#c1cbbd]">
              This page only collects a booking request. No online payment is taken here. Bowline confirms the stay manually after reviewing availability.
            </div>

            <form className="mt-6 space-y-4" onSubmit={submitBooking}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Start date</label>
                  <DatePicker
                    selected={booking.startDate}
                    onChange={(date) => setBooking((prev) => ({ ...prev, startDate: date }))}
                    className="input"
                    minDate={new Date()}
                  />
                </div>
                <div>
                  <label className="label">End date</label>
                  <DatePicker
                    selected={booking.endDate}
                    onChange={(date) => setBooking((prev) => ({ ...prev, endDate: date }))}
                    className="input"
                    minDate={booking.startDate}
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
                  onChange={(event) => setBooking((prev) => ({ ...prev, guests: Number(event.target.value) }))}
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
                <p className={availability.available ? 'text-emerald-300' : 'text-rose-300'}>
                  {availability.reason}
                </p>
                <p className="mt-2 text-slate-300">Indicative unit price: {formatCurrency(availability.pricing.unitPrice)}</p>
                <p className="text-slate-300">Estimated booking value: {formatCurrency(availability.pricing.totalPrice)}</p>
                {availability.pricing.adjustments?.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {availability.pricing.adjustments.map((item) => (
                      <span key={item} className="rounded-full border border-white/10 px-2 py-1 text-xs text-slate-400">
                        {item}
                      </span>
                    ))}
                  </div>
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
