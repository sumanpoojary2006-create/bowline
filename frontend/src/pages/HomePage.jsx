import { useEffect, useMemo, useState } from 'react';
import DatePicker from 'react-datepicker';
import { CalendarDaysIcon, ChevronDownIcon, UserGroupIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import SearchHero from '../components/SearchHero';
import ListingCard from '../components/ListingCard';
import PageLoader from '../components/PageLoader';
import EmptyState from '../components/EmptyState';
import { addDays, ensureCheckoutDate, formatDateParam } from '../lib/dateUtils';

const forestBackdrop =
  'https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&w=1800&q=80';

const adventureHighlights = [
  {
    title: 'Zip Line',
    description: 'Short, fun line rides above greenery around the property.',
    images: [
      'https://images.unsplash.com/photo-1539635278303-d4002c07eae3?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1517167685281-7d1d1b8df1f5?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1542384557-0824d90731ef?auto=format&fit=crop&w=1200&q=80',
    ],
  },
  {
    title: 'Rappelling',
    description: 'Guided controlled descent sessions with safety supervision.',
    images: [
      'https://images.unsplash.com/photo-1522163182402-834f871fd851?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1520637736862-4d197d17c35a?auto=format&fit=crop&w=1200&q=80',
    ],
  },
  {
    title: 'Trekking',
    description: 'Plantation-side and forest-edge trekking around Mudigere routes.',
    images: [
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1501554728187-ce583db33af7?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?auto=format&fit=crop&w=1200&q=80',
    ],
  },
];

const foodHighlights = [
  {
    title: 'Breakfast',
    note: 'Complimentary with stay',
    image:
      'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=1200&q=80',
  },
  {
    title: 'Lunch',
    note: 'Authentic Malnad meal',
    image:
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80',
  },
  {
    title: 'Dinner',
    note: 'Local style dinner spread',
    image:
      'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=1200&q=80',
  },
  {
    title: 'Snacks',
    note: 'Evening bites and chai',
    image:
      'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1200&q=80',
  },
];

const tomorrow = () => addDays(new Date(), 1);

function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [filters, setFilters] = useState({
    startDate: tomorrow(),
    endDate: addDays(tomorrow(), 1),
    guests: '2',
  });
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeHighlight, setActiveHighlight] = useState('homestay');
  const [activeBooking, setActiveBooking] = useState(null);
  const [bookingDraft, setBookingDraft] = useState({
    startDate: tomorrow(),
    endDate: addDays(tomorrow(), 1),
    guests: '2',
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

  const roomSearchQuery = useMemo(() => {
    const query = new URLSearchParams();
    query.set('capacity', filters.guests);
    query.set('startDate', formatDateParam(filters.startDate));
    query.set('endDate', formatDateParam(filters.endDate));
    return query.toString();
  }, [filters.endDate, filters.guests, filters.startDate]);

  const handleSearch = (event) => {
    event.preventDefault();
    navigate(`/stays?${roomSearchQuery}`);
  };

  const openBookingPrompt = (listing) => {
    setActiveBooking(listing);
    setBookingDraft({
      startDate: filters.startDate,
      endDate: filters.endDate,
      guests: filters.guests,
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
    const query = new URLSearchParams({
      startDate: formatDateParam(bookingDraft.startDate),
      endDate: formatDateParam(bookingDraft.endDate),
      guests: bookingDraft.guests,
    });

    navigate(`/experiences/${activeBooking.slug}?${query.toString()}`, {
      state: {
        bookingPrefill: {
          startDate: formatDateParam(bookingDraft.startDate),
          endDate: formatDateParam(bookingDraft.endDate),
          guests: bookingDraft.guests,
        },
      },
    });
  };

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
              <h1 className="mt-4 font-display text-5xl leading-tight text-[#f5f0dd] sm:text-6xl">
                Find your stay, then book in one clear flow.
              </h1>
              <p className="mt-3 text-base text-[#d5ddd2]">
                Choose dates and guests first. Search takes you to available rooms with pricing.
              </p>
            </div>

            <div className="mt-6">
              <SearchHero filters={filters} setFilters={setFilters} onSubmit={handleSearch} />
            </div>
          </div>

          <div className="mx-auto max-w-6xl rounded-[2rem] border border-lime-100/10 bg-[#0a130d]/70 p-5">
            <div className="flex flex-wrap gap-3">
              {[
                { id: 'homestay', label: 'Homestay' },
                { id: 'adventure', label: 'Adventure' },
                { id: 'food', label: 'Food' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveHighlight(tab.id)}
                  className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                    activeHighlight === tab.id
                      ? 'bg-lime-200 text-slate-950'
                      : 'border border-lime-100/15 bg-white/5 text-[#d2dbcf]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeHighlight === 'homestay' ? (
              <div className="mt-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-semibold text-[#f5f0dd]">Homestay room details</h2>
                    <p className="mt-1 text-sm text-[#cdd6c9]">
                      Explore room types and features first. Pricing appears after date selection or in search results.
                    </p>
                  </div>
                  <Link className="btn-primary" to={`/stays?${roomSearchQuery}`}>
                    Search available rooms with price
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
                        showPrice={false}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState title="No rooms yet" description="Add room listings from the admin panel." />
                )}
              </div>
            ) : null}

            {activeHighlight === 'adventure' ? (
              <div className="mt-6 space-y-4">
                <h2 className="text-2xl font-semibold text-[#f5f0dd]">Adventure highlights</h2>
                <p className="text-sm text-[#cdd6c9]">
                  Open each activity to see photos. These are add-ons after stay selection.
                </p>

                <div className="space-y-3">
                  {adventureHighlights.map((item, index) => (
                    <details
                      key={item.title}
                      className="overflow-hidden rounded-[1.5rem] border border-lime-100/10 bg-[#0d1710]/80"
                      open={index === 0}
                    >
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
                        <div>
                          <p className="text-lg font-semibold text-[#f5f0dd]">{item.title}</p>
                          <p className="mt-1 text-sm text-[#cdd6c9]">{item.description}</p>
                        </div>
                        <ChevronDownIcon className="h-5 w-5 text-lime-200" />
                      </summary>
                      <div className="grid gap-3 border-t border-lime-100/10 p-4 md:grid-cols-3">
                        {item.images.map((image) => (
                          <img
                            key={image}
                            src={image}
                            alt={item.title}
                            className="h-40 w-full rounded-2xl object-cover"
                          />
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            ) : null}

            {activeHighlight === 'food' ? (
              <div className="mt-6 space-y-4">
                <h2 className="text-2xl font-semibold text-[#f5f0dd]">Food highlights</h2>
                <p className="text-sm text-[#cdd6c9]">
                  Homestay-style meals and snacks that match the Bowline stay experience.
                </p>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {foodHighlights.map((item) => (
                    <article key={item.title} className="overflow-hidden rounded-[1.5rem] border border-lime-100/10 bg-[#0d1710]/80">
                      <img src={item.image} alt={item.title} className="h-36 w-full object-cover" />
                      <div className="p-4">
                        <p className="text-lg font-semibold text-[#f5f0dd]">{item.title}</p>
                        <p className="mt-1 text-sm text-[#cdd6c9]">{item.note}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
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
                  onChange={(date) => updateDraftStartDate(date)}
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
                  onChange={(date) =>
                    setBookingDraft((prev) => ({
                      ...prev,
                      endDate: ensureCheckoutDate(prev.startDate, date, 1),
                    }))
                  }
                  className="w-full bg-transparent font-medium text-slate-900 outline-none"
                  minDate={addDays(bookingDraft.startDate, 1)}
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
                  <option value="5">5 guests</option>
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
