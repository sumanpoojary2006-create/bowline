import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../lib/api';
import SearchHero from '../components/SearchHero';
import SectionHeader from '../components/SectionHeader';
import ListingCard from '../components/ListingCard';
import PageLoader from '../components/PageLoader';
import EmptyState from '../components/EmptyState';

function HomePage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ search: '', type: '', location: '' });
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Bowline | Stay, Trek, and Camp';

    const fetchFeatured = async () => {
      try {
        const { data } = await api.get('/listings', { params: { featured: true, limit: 6 } });
        setFeatured(data.listings);
      } finally {
        setLoading(false);
      }
    };

    fetchFeatured();
  }, []);

  const highlightStats = useMemo(
    () => [
      { value: '20+', label: 'Curated experiences' },
      { value: '4.9/5', label: 'Guest satisfaction' },
      { value: '365', label: 'Days of outdoor energy' },
    ],
    []
  );

  const handleSearch = (event) => {
    event.preventDefault();
    const pathname = filters.type ? `/${filters.type === 'room' ? 'stays' : `${filters.type}s`}` : '/stays';
    const search = new URLSearchParams();
    if (filters.search) search.set('search', filters.search);
    if (filters.location) search.set('location', filters.location);
    navigate(`${pathname}?${search.toString()}`);
  };

  return (
    <>
      <section className="section-shell grid gap-10 py-14 lg:grid-cols-[1.1fr_0.9fr] lg:py-20">
        <div className="space-y-8">
          <div className="inline-flex rounded-full border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.32em] text-amber-200">
            Bowline booking platform
          </div>
          <div>
            <h1 className="max-w-3xl font-display text-5xl leading-tight text-white sm:text-6xl lg:text-7xl">
              Outdoor stays and experiences shaped around real adventure.
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-slate-300">
              Explore plantation stays, guided treks, and immersive camps in one seamless booking flow built for modern travelers.
            </p>
          </div>
          <SearchHero filters={filters} setFilters={setFilters} onSubmit={handleSearch} />
          <div className="grid gap-4 sm:grid-cols-3">
            {highlightStats.map((stat) => (
              <div key={stat.label} className="glass rounded-[1.75rem] p-5">
                <p className="text-3xl font-bold text-white">{stat.value}</p>
                <p className="mt-2 text-sm text-slate-400">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-[2.5rem] border border-white/10"
        >
          <img
            src="https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80"
            alt="Bowline Hero"
            className="h-full min-h-[520px] w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <div className="glass rounded-[2rem] p-5">
              <p className="text-xs uppercase tracking-[0.28em] text-amber-300">Built for discovery</p>
              <h2 className="mt-3 text-2xl font-semibold text-white">From quiet stays to high-energy adventure weekends</h2>
              <p className="mt-3 text-sm text-slate-300">
                A single platform where Bowline guests can discover listings, book confidently, and manage every plan from one dashboard.
              </p>
            </div>
          </div>
        </motion.div>
      </section>

      <section className="section-shell py-12">
        <SectionHeader
          eyebrow="Featured"
          title="Signature experiences"
          description="Highlighting the highest-converting inventory across stays, treks, and camp programs."
          action={
            <Link className="btn-secondary" to="/stays">
              View all stays
            </Link>
          }
        />
        {loading ? (
          <PageLoader label="Loading featured experiences..." />
        ) : featured.length ? (
          <div className="card-grid">
            {featured.map((listing) => (
              <ListingCard key={listing._id} listing={listing} />
            ))}
          </div>
        ) : (
          <EmptyState title="No featured listings yet" description="Seed the backend or add new experiences from the admin panel." />
        )}
      </section>

      <section className="section-shell py-12">
        <div className="grid gap-6 lg:grid-cols-3">
          {[
            {
              title: 'Stay bookings',
              description: 'Filter rooms by occupancy, amenities, and pricing with fast availability checks.',
            },
            {
              title: 'Trek plans',
              description: 'Show difficulty levels, trek dates, route details, and quick reservation flows.',
            },
            {
              title: 'Camp experiences',
              description: 'Present full camp schedules, facilities, and package pricing with one booking engine.',
            },
          ].map((item) => (
            <div key={item.title} className="glass rounded-[2rem] p-6">
              <h3 className="text-2xl font-semibold text-white">{item.title}</h3>
              <p className="mt-4 text-sm leading-6 text-slate-300">{item.description}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

export default HomePage;
