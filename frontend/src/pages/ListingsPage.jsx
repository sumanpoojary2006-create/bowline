import { useEffect, useMemo, useState } from 'react';
import api from '../lib/api';
import ListingCard from '../components/ListingCard';
import EmptyState from '../components/EmptyState';
import PageLoader from '../components/PageLoader';
import SectionHeader from '../components/SectionHeader';
import { buildGroupBookingListings, getRoomDisplayOrder } from '../lib/roomRates';

const pageConfig = {
  room: {
    title: 'Choose the room that feels right',
    eyebrow: 'Room booking',
    description: 'See every room and group option first. Select Book Now to view that option’s calendar and continue your booking.',
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
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
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
        const { data } = await api.get('/listings', {
          params: type === 'room'
            ? { ...query, limit: 8, includeBundleExtras: true }
            : query,
        });

        if (type === 'room') {
          const sortedRooms = [...data.listings].sort(
            (a, b) => getRoomDisplayOrder(a) - getRoomDisplayOrder(b)
          );
          const standaloneRooms = sortedRooms.filter(
            (room) => room.slug !== 'dormitory-open-loft'
          );
          setListings([...standaloneRooms, ...buildGroupBookingListings(sortedRooms)]);
        } else {
          setListings(data.listings);
        }
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

      {type !== 'room' ? (
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
      ) : null}

      {loading ? (
        <PageLoader label="Loading Bowline inventory..." />
      ) : listings.length ? (
        <div className="card-grid">
          {listings.map((listing) => (
            <ListingCard
              key={listing._id}
              listing={listing}
              detailLabel="View More"
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
