import { FireIcon } from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { formatCurrency } from '../lib/formatters';
import { getRoomRate } from '../lib/roomRates';

const typeLabels = {
  room: 'Stay',
  trek: 'Trek',
  camp: 'Camp',
};

function ListingCard({
  listing,
  onBookNow,
  compact = false,
  detailLabel = 'View More',
  showPrice = true,
}) {
  const isRoom = listing.type === 'room';
  const canBook = isRoom && typeof onBookNow === 'function';
  const roomRate = isRoom ? getRoomRate(listing) : null;

  return (
    <motion.article whileHover={{ y: -6 }} className="glass overflow-hidden rounded-[1.75rem] shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
      <div className={`relative overflow-hidden ${compact ? 'h-48' : 'h-60'}`}>
        <img
          src={listing.images?.[0] || 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80'}
          alt={listing.name}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#07110b] via-[#07110b]/20 to-transparent" />
        <div className="absolute left-4 top-4 inline-flex rounded-full bg-lime-200 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-950">
          {typeLabels[listing.type]}
        </div>
        {listing.featured ? (
          <div className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-black/30 px-3 py-1 text-xs text-white backdrop-blur">
            <FireIcon className="h-4 w-4 text-lime-200" />
            Popular
          </div>
        ) : null}
      </div>

      <div className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-2xl font-semibold text-[#f5f0dd]">{listing.name}</h3>
          </div>
          {showPrice ? (
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-[0.2em] text-lime-100/45">
                {isRoom ? 'Weekday' : 'From'}
              </p>
              <p className="text-lg font-bold text-lime-200">
                {formatCurrency(isRoom ? roomRate.weekday : listing.price)}
              </p>
            </div>
          ) : (
            <span className="rounded-full border border-lime-100/15 px-3 py-1 text-xs text-[#c4cec0]">
              {isRoom ? `${formatCurrency(roomRate.weekday)} weekday` : 'Price after date selection'}
            </span>
          )}
        </div>

        <p className="line-clamp-2 text-sm text-[#d7ded3]">{listing.shortDescription || listing.description}</p>
        {isRoom ? (
          <div className="grid grid-cols-2 gap-2 text-xs text-[#c4cec0]">
            <span className="rounded-xl border border-lime-100/10 bg-black/15 px-3 py-2">
              Weekend {formatCurrency(roomRate.weekend)}
            </span>
            <span className="rounded-xl border border-lime-100/10 bg-black/15 px-3 py-2">
              {roomRate.min}-{roomRate.max} guests
            </span>
          </div>
        ) : null}

        <div className="flex gap-2">
          {isRoom ? (
            canBook ? (
              <button className="btn-primary w-full rounded-[1rem] px-4" onClick={() => onBookNow(listing)} type="button">
                Book Now
              </button>
            ) : (
              <Link className="btn-primary w-full rounded-[1rem] px-4" to={`/book/${listing.slug}`}>
                Book Now
              </Link>
            )
          ) : (
            <Link className="btn-secondary w-full rounded-[1rem] px-4" to={`/experiences/${listing.slug}`}>
              {detailLabel}
            </Link>
          )}
        </div>
      </div>
    </motion.article>
  );
}

export default ListingCard;
