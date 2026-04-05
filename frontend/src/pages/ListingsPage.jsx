import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import ListingCard from '../components/ListingCard';
import EmptyState from '../components/EmptyState';
import PageLoader from '../components/PageLoader';
import SectionHeader from '../components/SectionHeader';
import { addDays, formatDateParam } from '../lib/dateUtils';
import { formatDateRange } from '../lib/formatters';

const pageConfig = {
  room: {
    title: 'Available rooms for your selected stay dates',
    eyebrow: 'Stay Bookings',
    description: 'Compare room options with pricing, then use View More or Book Now to continue.',
  },
  trek: {
    title: 'Adventure options around Bowline',
    eyebrow: 'Trek Bookings',
    description: 'Explore trek options after selecting your stay.',
  },
  camp: {
    title: 'Camp experiences as add-ons',
    eyebrow: 'Camp Bookings',
    description: 'Review camp programs that can complement your stay.',
  },
};

function ListingsPage({ type }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    capacity: searchParams.get('capacity') || '',
    difficulty: '',
  });

  const defaultStartDate = formatDateParam(new Date());
  const defaultEndDate = formatDateParam(addDays(new Date(), 1));
  const selectedStartDate = searchParams.get('startDate') || defaultStartDate;
  const selectedEndDate = searchParams.get('endDate') || defaultEndDate;
  const selectedGuests = filters.capacity || searchParams.get('capacity') || '1';

  const config = pageConfig[type];

  useEffect(() => {
    document.title = `Bowline | ${config.eyebrow}`;
  }, [config.eyebrow]);

  const query = useMemo(
    () => ({
      type,
      ...Object.fromEntries(
        Object.entries(filters).filter(([, value]) => value !== '' && value !== null)
      ),
    }),
    [filters, type]
  );

  useEffect(() => {
    const fetchListings = async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/listings', { params: query });
        setListings(data.listings);
      } finally {
        setLoading(false);
      }
    };

    fetchListings();
  }, [query]);

  const handleBookNow = (listing) => {
    const bookingQuery = new URLSearchParams({
      startDate: selectedStartDate,
      endDate: selectedEndDate,
      guests: selectedGuests,
    });

    navigate(`/experiences/${listing.slug}?${bookingQuery.toString()}`, {
      state: {
        bookingPrefill: {
          startDate: selectedStartDate,
          endDate: selectedEndDate,
          guests: selectedGuests,
        },
      },
    });
  };

  return (
    <section className="section-shell py-12">
      <SectionHeader
        eyebrow={config.eyebrow}
        title={config.title}
        description={config.description}
      />

      {type === 'room' ? (
        <div className="mb-8 space-y-4 rounded-[2rem] border border-lime-100/10 bg-[#0d1710]/75 p-5">
          <div className="rounded-[1.25rem] border border-lime-100/10 bg-black/20 px-4 py-3 text-sm text-[#d2dbcf]">
            Requirement: {formatDateRange(selectedStartDate, selectedEndDate)} • {selectedGuests} guest(s) • Mudigere
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <input
              className="input"
              placeholder="Search room by name or feature"
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
            />
            <input
              className="input"
              placeholder="Guests"
              type="number"
              min="1"
              value={filters.capacity}
              onChange={(event) => setFilters((prev) => ({ ...prev, capacity: event.target.value }))}
            />
          </div>
        </div>
      ) : (
        <div className="mb-8 grid gap-4 rounded-[2rem] border border-lime-100/10 bg-[#0d1710]/70 p-4 md:grid-cols-2 xl:grid-cols-3">
          <input
            className="input"
            placeholder="Search by name or keyword"
            value={filters.search}
            onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
          />
          <input
            className="input"
            placeholder="Capacity"
            type="number"
            value={filters.capacity}
            onChange={(event) => setFilters((prev) => ({ ...prev, capacity: event.target.value }))}
          />
          {type === 'trek' ? (
            <select
              className="input"
              value={filters.difficulty}
              onChange={(event) => setFilters((prev) => ({ ...prev, difficulty: event.target.value }))}
            >
              <option value="">All difficulties</option>
              <option value="Easy">Easy</option>
              <option value="Moderate">Moderate</option>
              <option value="Challenging">Challenging</option>
            </select>
          ) : null}
        </div>
      )}

      {loading ? (
        <PageLoader label="Loading Bowline inventory..." />
      ) : listings.length ? (
        <div className="card-grid">
          {listings.map((listing) => (
            <ListingCard
              key={listing._id}
              listing={listing}
              detailLabel="View More"
              onBookNow={type === 'room' ? handleBookNow : undefined}
              showPrice
            />
          ))}
        </div>
      ) : (
        <EmptyState title="No matching experiences found" description="Try adjusting your requirement details or add more inventory from the admin dashboard." />
      )}
    </section>
  );
}

export default ListingsPage;
