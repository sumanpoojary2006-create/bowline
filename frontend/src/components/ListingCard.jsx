import { FireIcon } from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { formatCurrency } from '../lib/formatters';
import { getRoomRate } from '../lib/roomRates';

const typeLabels = {
  room: 'Stay',
  trek: 'Trek',
  camp: 'Camp',
};

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function getDescriptionPoints(text) {
  if (!text) return [];
  const cleaned = text.trim().replace(/\.$/, '');
  const [main, rest] = cleaned.split(/ with /i);
  if (!rest) return [{ emoji: '✨', text: capitalize(cleaned) }];

  const mainLabel = main.replace(/-floor pent house$/i, ' floor');
  const points = [{ emoji: '🏠', text: capitalize(mainLabel) }];
  rest
    .split(/,| and /i)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .forEach((segment) => {
      let emoji = '✨';
      if (/bed/i.test(segment)) emoji = '🛏️';
      else if (/bathroom/i.test(segment)) emoji = '🚿';
      else if (/breakfast/i.test(segment)) emoji = '🍳';
      points.push({ emoji, text: capitalize(segment) });
    });

  return points;
}

function ImageCarousel({ images, name, compact }) {
  const [idx, setIdx] = useState(0);
  const imgs = images?.length ? images : ['https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80'];

  useEffect(() => {
    if (imgs.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % imgs.length), 3000);
    return () => clearInterval(t);
  }, [imgs.length]);

  return (
    <>
      {imgs.map((src, i) => (
        <img
          key={i}
          src={src}
          alt={`${name} ${i + 1}`}
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700"
          style={{ opacity: i === idx ? 1 : 0 }}
        />
      ))}
      {imgs.length > 1 && (
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
          {imgs.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIdx(i)}
              className={`h-1.5 rounded-full transition-all ${i === idx ? 'w-4 bg-lime-300' : 'w-1.5 bg-white/40'}`}
            />
          ))}
        </div>
      )}
    </>
  );
}

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
    <motion.article whileHover={{ y: -6 }} className="glass flex h-full flex-col overflow-hidden rounded-[1.75rem] shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
      <div className={`relative overflow-hidden ${compact ? 'h-48' : 'h-60'}`}>
        <ImageCarousel images={listing.images} name={listing.name} compact={compact} />
        <div className="absolute inset-0 bg-gradient-to-t from-[#07110b] via-[#07110b]/20 to-transparent" />
        <div className="absolute left-4 top-4 inline-flex rounded-full bg-lime-200 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-950">
          {typeLabels[listing.type]}
        </div>
        {listing.featured && (listing.name === 'Pent House' || listing.name === 'Cozy 1') ? (
          <div className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-black/30 px-3 py-1 text-xs text-white backdrop-blur">
            <FireIcon className="h-4 w-4 text-lime-200" />
            Popular
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col space-y-4 p-5">
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
                {isRoom ? <span className="text-xs font-semibold text-lime-100/70">/person</span> : null}
              </p>
            </div>
          ) : (
            <span className="rounded-full border border-lime-100/15 px-3 py-1 text-xs text-[#c4cec0]">
              {isRoom ? `${formatCurrency(roomRate.weekday)}/person weekday` : 'Price after date selection'}
            </span>
          )}
        </div>

        {isRoom ? (
          <ul className="space-y-1 text-sm text-[#d7ded3]">
            {[...getDescriptionPoints(listing.shortDescription || listing.description), ...(listing.extraPoints || [])].map((point, index) => (
              <li key={index} className="flex items-start gap-2">
                <span>{point.emoji}</span>
                <span>{point.text}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="line-clamp-2 text-sm text-[#d7ded3]">{listing.shortDescription || listing.description}</p>
        )}
        {isRoom ? (
          <div className="grid grid-cols-2 gap-2 text-xs text-[#c4cec0]">
            <span className="rounded-xl border border-lime-100/10 bg-black/15 px-3 py-2">
              Weekend {formatCurrency(roomRate.weekend)}/person
            </span>
            <span className="rounded-xl border border-lime-100/10 bg-black/15 px-3 py-2">
              {roomRate.min}-{roomRate.max} guests
            </span>
          </div>
        ) : null}

        <div className="mt-auto flex gap-2">
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
