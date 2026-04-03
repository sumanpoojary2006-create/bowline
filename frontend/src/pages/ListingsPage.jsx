import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import ListingCard from '../components/ListingCard';
import EmptyState from '../components/EmptyState';
import PageLoader from '../components/PageLoader';
import SectionHeader from '../components/SectionHeader';

const pageConfig = {
  room: {
    title: 'Rooms and stays surrounded by coffee hills and cool air',
    eyebrow: 'Stay Bookings',
    description: 'Use the filters to find the right room, open the stay, and send a booking request without paying online.',
  },
  trek: {
    title: 'Treks available around your Bowline stay',
    eyebrow: 'Trek Bookings',
    description: 'Treks now sit as supporting experiences that guests can add after choosing the right stay.',
  },
  camp: {
    title: 'Camp experiences offered as add-on programs',
    eyebrow: 'Camp Bookings',
    description: 'Browse camp programs when you want something beyond the stay, but keep the room booking at the center of the plan.',
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
        description={config.description}
      />

      <div className="mb-8 grid gap-4 rounded-[2rem] border border-lime-100/10 bg-[#0d1710]/70 p-4 md:grid-cols-2 xl:grid-cols-5">
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
