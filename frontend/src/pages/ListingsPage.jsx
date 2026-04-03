import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import ListingCard from '../components/ListingCard';
import EmptyState from '../components/EmptyState';
import PageLoader from '../components/PageLoader';
import SectionHeader from '../components/SectionHeader';

const pageConfig = {
  room: {
    title: 'Stays that balance comfort and wild terrain',
    eyebrow: 'Stay Bookings',
  },
  trek: {
    title: 'Treks built for momentum and mountain views',
    eyebrow: 'Trek Bookings',
  },
  camp: {
    title: 'Camping programs with structure, warmth, and adventure',
    eyebrow: 'Camp Bookings',
  },
};

function ListingsPage({ type }) {
  const [searchParams] = useSearchParams();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    location: searchParams.get('location') || '',
    minPrice: '',
    maxPrice: '',
    capacity: '',
    difficulty: '',
  });

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

  return (
    <section className="section-shell py-12">
      <SectionHeader
        eyebrow={config.eyebrow}
        title={config.title}
        description="Use filters to narrow inventory, then open any experience to review pricing, details, and availability."
      />

      <div className="mb-8 grid gap-4 rounded-[2rem] border border-white/10 bg-slate-950/50 p-4 md:grid-cols-2 xl:grid-cols-5">
        <input
          className="input"
          placeholder="Search by name or keyword"
          value={filters.search}
          onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
        />
        <input
          className="input"
          placeholder="Location"
          value={filters.location}
          onChange={(event) => setFilters((prev) => ({ ...prev, location: event.target.value }))}
        />
        <input
          className="input"
          placeholder="Min price"
          type="number"
          value={filters.minPrice}
          onChange={(event) => setFilters((prev) => ({ ...prev, minPrice: event.target.value }))}
        />
        <input
          className="input"
          placeholder={type === 'room' ? 'Guests' : 'Capacity'}
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
        ) : (
          <input
            className="input"
            placeholder="Max price"
            type="number"
            value={filters.maxPrice}
            onChange={(event) => setFilters((prev) => ({ ...prev, maxPrice: event.target.value }))}
          />
        )}
      </div>

      {loading ? (
        <PageLoader label="Loading Bowline inventory..." />
      ) : listings.length ? (
        <div className="card-grid">
          {listings.map((listing) => (
            <ListingCard key={listing._id} listing={listing} />
          ))}
        </div>
      ) : (
        <EmptyState title="No matching experiences found" description="Try adjusting the filters or add more inventory from the admin dashboard." />
      )}
    </section>
  );
}

export default ListingsPage;
