import { ArrowRightIcon, FireIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { formatCurrency } from '../lib/formatters';

const typeLabels = {
  room: 'Stay',
  trek: 'Trek',
  camp: 'Camp',
};

function ListingCard({ listing }) {
  return (
    <motion.article
      whileHover={{ y: -6 }}
      className="glass overflow-hidden rounded-[2rem]"
    >
      <div className="relative h-64 overflow-hidden">
        <img
          src={listing.images?.[0] || 'https://placehold.co/1200x800'}
          alt={listing.name}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />
        <div className="absolute left-4 top-4 inline-flex rounded-full bg-amber-300 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-slate-950">
          {typeLabels[listing.type]}
        </div>
        {listing.featured ? (
          <div className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs text-white backdrop-blur">
            <FireIcon className="h-4 w-4 text-amber-300" />
            Featured
          </div>
        ) : null}
      </div>
      <div className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-white">{listing.name}</h3>
            <div className="mt-2 inline-flex items-center gap-2 text-sm text-slate-400">
              <MapPinIcon className="h-4 w-4" />
              {listing.location || 'Bowline Basecamp'}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Starting from</p>
            <p className="text-lg font-bold text-amber-300">{formatCurrency(listing.price)}</p>
          </div>
        </div>
        <p className="line-clamp-3 text-sm text-slate-300">
          {listing.shortDescription || listing.description}
        </p>
        <div className="flex flex-wrap gap-2">
          {(listing.amenities?.length ? listing.amenities : listing.facilities || []).slice(0, 3).map((item) => (
            <span key={item} className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
              {item}
            </span>
          ))}
        </div>
        <Link className="inline-flex items-center gap-2 text-sm font-semibold text-white" to={`/experiences/${listing.slug}`}>
          View details
          <ArrowRightIcon className="h-4 w-4" />
        </Link>
      </div>
    </motion.article>
  );
}

export default ListingCard;
