import { useEffect, useMemo, useState } from 'react';
import DatePicker from 'react-datepicker';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarDaysIcon, UserGroupIcon, XMarkIcon } from '@heroicons/react/24/outline';
import api from '../lib/api';
import SearchHero from '../components/SearchHero';
import ListingCard from '../components/ListingCard';
import PageLoader from '../components/PageLoader';
import EmptyState from '../components/EmptyState';

const forestBackdrop =
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1800&q=80';
const valleyBackdrop =
  'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1600&q=80';

const tomorrow = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date;
};

const plusDays = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

const toParamDate = (value) => value?.toISOString().slice(0, 10);

function HomePage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    location: 'Chikkamagaluru',
    startDate: tomorrow(),
    endDate: plusDays(2),
    guests: '2',
  });
  const [featuredRooms, setFeaturedRooms] = useState([]);
  const [adventures, setAdventures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeBooking, setActiveBooking] = useState(null);
  const [bookingDraft, setBookingDraft] = useState({
    startDate: tomorrow(),
    endDate: plusDays(2),
    guests: '2',
  });

  useEffect(() => {
    document.title = 'Bowline Nature Stay | Book Your Hillside Stay';

    const fetchHomeData = async () => {
      try {
        const [roomsRes, adventuresRes] = await Promise.all([
          api.get('/listings', { params: { type: 'room', featured: true, limit: 3 } }),
          api.get('/listings', { params: { featured: true, limit: 4 } }),
        ]);

        setFeaturedRooms(roomsRes.data.listings);
        setAdventures(adventuresRes.data.listings.filter((listing) => listing.type !== 'room').slice(0, 3));
      } finally {
        setLoading(false);
      }
    };

    fetchHomeData();
  }, []);

  const quickTags = useMemo(() => ['Mudigere', 'Devaramane', 'Chikkamagaluru', 'Malnad Hills'], []);

  const handleSearch = (event) => {
    event.preventDefault();
    const search = new URLSearchParams();
    if (filters.location) search.set('location', filters.location);
    if (filters.guests) search.set('capacity', filters.guests);
    if (filters.startDate) search.set('startDate', toParamDate(filters.startDate));
    if (filters.endDate) search.set('endDate', toParamDate(filters.endDate));
    navigate(`/stays?${search.toString()}`);
  };

  const openBookingPrompt = (listing) => {
    setActiveBooking(listing);
    setBookingDraft({
      startDate: filters.startDate,
      endDate: filters.endDate,
      guests: filters.guests,
    });
  };

  const confirmBookingPrompt = () => {
    if (!activeBooking) return;
    const search = new URLSearchParams({
      startDate: toParamDate(bookingDraft.startDate),
      endDate: toParamDate(bookingDraft.endDate),
      guests: bookingDraft.guests,
    });
    navigate(`/experiences/${activeBooking.slug}?${search.toString()}`);
  };

  return (
    <>
      <section className="relative overflow-hidden pb-8 pt-6">
        <img src={forestBackdrop} alt="Forest valley" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,16,10,0.68)_0%,rgba(8,16,10,0.84)_36%,rgba(8,16,10,0.94)_100%)]" />

        <div className="relative section-shell space-y-8">
          <div className="mx-auto max-w-5xl rounded-[2.5rem] border border-lime-100/10 bg-black/20 p-6 backdrop-blur-sm sm:p-8">
            <div className="max-w-2xl">
              <h1 className="font-display text-5xl leading-tight text-[#f5f0dd] sm:text-6xl">
                Book Bowline Nature Stay in the hills.
              </h1>
              <p className="mt-3 text-base text-[#d5ddd2]">Four rooms, one dorm, authentic Malnad food, and host-led nature experiences.</p>
            </div>

            <div className="mt-6">
              <SearchHero filters={filters} setFilters={setFilters} onSubmit={handleSearch} />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {quickTags.map((tag) => (
                <button
                  key={tag}
                  className="rounded-full border border-lime-100/12 bg-black/20 px-4 py-2 text-sm text-[#d5ddd2]"
                  onClick={() => setFilters((prev) => ({ ...prev, location: tag }))}
                  type="button"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="mx-auto max-w-5xl">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-3xl font-semibold text-[#f5f0dd]">Book Rooms</h2>
                <p className="mt-1 text-sm text-[#cdd6c9]">Choose your room, confirm dates, then send the booking request.</p>
              </div>
              <Link className="btn-secondary hidden sm:inline-flex" to="/stays">
                View all
              </Link>
            </div>

            {loading ? (
              <PageLoader label="Loading rooms..." />
            ) : featuredRooms.length ? (
              <div className="grid gap-5 lg:grid-cols-3">
                {featuredRooms.map((listing) => (
                  <ListingCard key={listing._id} listing={listing} onBookNow={openBookingPrompt} compact />
                ))}
              </div>
            ) : (
              <EmptyState title="No rooms yet" description="Add room listings from the admin panel." />
            )}
          </div>

          <div
            className="mx-auto max-w-5xl overflow-hidden rounded-[2.25rem] border border-lime-100/10"
            style={{
              backgroundImage: `linear-gradient(90deg, rgba(8,16,10,0.88), rgba(8,16,10,0.58)), url(${valleyBackdrop})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <div className="grid gap-6 px-6 py-7 lg:grid-cols-[0.85fr_1.15fr]">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-lime-200/80">Adventure awaits</p>
                <h2 className="mt-3 text-3xl font-semibold text-[#f5f0dd]">What comes with the homestay.</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {adventures.length ? (
                  adventures.map((listing) => (
                    <div key={listing._id} className="rounded-[1.5rem] border border-lime-100/10 bg-black/25 p-4 backdrop-blur-sm">
                      <p className="text-lg font-semibold text-[#f5f0dd]">{listing.name}</p>
                      <p className="mt-1 text-sm text-[#d5ddd2]">{listing.location}</p>
                      <Link className="mt-4 inline-flex text-sm font-semibold text-lime-200" to={`/experiences/${listing.slug}`}>
                        View details
                      </Link>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="rounded-[1.5rem] border border-lime-100/10 bg-black/25 p-4 backdrop-blur-sm">
                      <p className="text-lg font-semibold text-[#f5f0dd]">Offbeat Trekking</p>
                    </div>
                    <div className="rounded-[1.5rem] border border-lime-100/10 bg-black/25 p-4 backdrop-blur-sm">
                      <p className="text-lg font-semibold text-[#f5f0dd]">Hidden Waterfall</p>
                    </div>
                    <div className="rounded-[1.5rem] border border-lime-100/10 bg-black/25 p-4 backdrop-blur-sm">
                      <p className="text-lg font-semibold text-[#f5f0dd]">Coffee Plantation Stroll</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {activeBooking ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4">
          <div className="glass w-full max-w-xl rounded-[2rem] p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-lime-200/80">Book now</p>
                <h3 className="mt-2 text-3xl font-semibold text-[#f5f0dd]">{activeBooking.name}</h3>
              </div>
              <button className="rounded-full border border-lime-100/12 p-2 text-white" onClick={() => setActiveBooking(null)} type="button">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="rounded-[1.25rem] bg-[#f0edd8] px-4 py-3 text-sm text-slate-900">
                <span className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  <CalendarDaysIcon className="h-4 w-4" />
                  Check in
                </span>
                <DatePicker
                  selected={bookingDraft.startDate}
                  onChange={(date) => setBookingDraft((prev) => ({ ...prev, startDate: date }))}
                  className="w-full bg-transparent font-medium text-slate-900 outline-none"
                  minDate={new Date()}
                  dateFormat="EEE, MMM d"
                />
              </label>

              <label className="rounded-[1.25rem] bg-[#f0edd8] px-4 py-3 text-sm text-slate-900">
                <span className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  <CalendarDaysIcon className="h-4 w-4" />
                  Check out
                </span>
                <DatePicker
                  selected={bookingDraft.endDate}
                  onChange={(date) => setBookingDraft((prev) => ({ ...prev, endDate: date }))}
                  className="w-full bg-transparent font-medium text-slate-900 outline-none"
                  minDate={bookingDraft.startDate || new Date()}
                  dateFormat="EEE, MMM d"
                />
              </label>

              <label className="rounded-[1.25rem] bg-[#f0edd8] px-4 py-3 text-sm text-slate-900 sm:col-span-2">
                <span className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  <UserGroupIcon className="h-4 w-4" />
                  Guests
                </span>
                <select
                  className="w-full bg-transparent font-medium text-slate-900 outline-none"
                  value={bookingDraft.guests}
                  onChange={(event) => setBookingDraft((prev) => ({ ...prev, guests: event.target.value }))}
                >
                  <option value="1">1 guest</option>
                  <option value="2">2 guests</option>
                  <option value="3">3 guests</option>
                  <option value="4">4 guests</option>
                  <option value="6">6+ guests</option>
                </select>
              </label>
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
