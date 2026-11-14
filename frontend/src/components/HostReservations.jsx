import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRightIcon, AdjustmentsHorizontalIcon, XMarkIcon } from '@heroicons/react/24/outline';
import api from '../lib/api';
import { formatCurrency, formatDate } from '../lib/formatters';
import roomImage from '../assets/marketing/room.jpg';
const key = value => String(value || '').slice(0, 10);

function BookingDetailDialog({ booking, onClose }) {
  const name = booking.contactName || booking.user?.name || 'Guest';
  return (
    <div className="host-mobile-dialog fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-[2rem] border border-lime-100/10 bg-[#0d1710] p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-white">{name}</h3>
            <p className="mt-1 text-sm text-slate-400">{booking.listing?.name || 'Bowline Nature Stay'}</p>
          </div>
          <button type="button" className="host-icon-button" aria-label="Close" onClick={onClose}><XMarkIcon /></button>
        </div>

        <div className="mt-5 space-y-2 text-sm text-slate-300">
          <p><span className="text-slate-500">Dates: </span>{formatDate(booking.startDate)} &ndash; {formatDate(booking.endDate)}</p>
          <p><span className="text-slate-500">Guests: </span>{booking.guests || 1}</p>
          <p><span className="text-slate-500">Status: </span><span className="capitalize">{booking.status}</span></p>
          <p><span className="text-slate-500">Payment: </span><span className="capitalize">{booking.paymentStatus?.replace('_', ' ')}</span> &middot; {formatCurrency(booking.totalPrice)}</p>
          <p><span className="text-slate-500">Source: </span><span className="capitalize">{booking.source}</span></p>
          {booking.contactEmail ? <p><span className="text-slate-500">Email: </span>{booking.contactEmail}</p> : null}
          {booking.contactPhone ? <p><span className="text-slate-500">Phone: </span>{booking.contactPhone}</p> : null}
        </div>

        <Link to="/admin/bookings" className="btn-secondary mt-6 w-full text-center">
          Manage in reservations <ArrowUpRightIcon className="inline h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

export default function HostReservations() {
  const [tab, setTab] = useState('today');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [source, setSource] = useState('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const load = async () => {
    setLoading(true); setError(false);
    try { const { data } = await api.get('/bookings/admin/all'); setBookings(data.bookings || []); }
    catch { setError(true); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const confirmed = bookings.filter(b => b.status === 'confirmed' && (source === 'all' || b.source === source));
  const visible = confirmed.filter(b => tab === 'upcoming' ? key(b.startDate) > today : key(b.startDate) <= today && key(b.endDate) >= today).sort((a,b) => new Date(a.startDate) - new Date(b.startDate));
  const arrivals = confirmed.filter(b => key(b.startDate) === today).length;
  const departures = confirmed.filter(b => key(b.endDate) === today).length;
  return <section className="host-welcome">
    <div className="host-welcome-top"><div><p className="host-eyebrow">BOWLINE HOSTING</p><h1>{tab === 'today' ? 'Today at Bowline' : 'Upcoming reservations'}</h1><p>{tab === 'today' ? 'Arrivals, departures and current stays in one calm view.' : 'Everything you need to prepare for the stays ahead.'}</p></div><Link to="/admin/bookings" className="host-outline-button">Manage reservations <ArrowUpRightIcon /></Link></div>
    <div className="host-reservation-toolbar"><div className="host-segmented" aria-label="Reservation period">{['today', 'upcoming'].map(t => <button key={t} className={tab === t ? 'selected' : ''} onClick={() => setTab(t)}>{t === 'today' ? 'Today' : 'Upcoming'}</button>)}</div><button className="host-icon-button" aria-label="Filter reservations" aria-expanded={filterOpen} onClick={() => setFilterOpen(!filterOpen)}><AdjustmentsHorizontalIcon /></button></div>
    {filterOpen && <label className="host-filter">Booking source<select value={source} onChange={e => setSource(e.target.value)}><option value="all">All sources</option>{['website','airbnb','whatsapp','admin','sheet'].map(s => <option key={s} value={s}>{s}</option>)}</select></label>}
    <div className="host-section-title"><h2>{tab === 'today' ? 'Reservations for today' : `You have ${visible.length} upcoming reservation${visible.length === 1 ? '' : 's'}`}<span>{loading ? '…' : visible.length}</span></h2><p>{tab === 'today' ? `${arrivals} arriving · ${departures} checking out` : 'Confirmed and ready to host'}</p></div>
    {loading ? <div className="host-empty">Getting your reservations ready…</div> : error ? <div className="host-empty">We couldn’t load reservations. <button onClick={load}>Try again</button></div> : visible.length ? <div className="host-reservation-grid">{visible.map((b, i) => { const name = b.contactName || b.user?.name || 'Guest'; return <button type="button" key={b._id} className="host-reservation-card" onClick={() => setSelected(b)}><div className="host-card-top"><span>{formatDate(b.startDate)} – {formatDate(b.endDate)}</span><ArrowUpRightIcon /></div><div className={`host-guest-avatar tone-${i % 3}`}><span>{name.charAt(0)}</span><img src={b.listing?.images?.[0] || roomImage} alt={b.listing?.name || 'Stay'} /></div><h3>{name}</h3><p>{b.listing?.name || 'Bowline Nature Stay'}</p><div className="host-card-bottom"><span><i />{key(b.startDate) === today ? 'Arriving today' : key(b.endDate) === today ? 'Checking out' : tab === 'today' ? 'Currently hosting' : 'Confirmed'}</span><span>{b.guests || 1} guests</span></div></button>; })}</div> : <div className="host-empty"><Bookmark /><h3>{tab === 'today' ? 'A little room to breathe.' : 'Your next chapter starts here.'}</h3><p>{tab === 'today' ? 'No confirmed stays for today. Check upcoming reservations or manage your calendar.' : 'New confirmed reservations will appear here.'}</p><Link to="/admin/calendar" className="host-outline-button">Open calendar ↗</Link></div>}
    {selected ? <BookingDetailDialog booking={selected} onClose={() => setSelected(null)} /> : null}
  </section>;
}
function Bookmark() { return <span className="host-empty-symbol">⌂</span>; }
