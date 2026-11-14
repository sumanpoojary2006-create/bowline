import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRightIcon, AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline';
import api from '../lib/api';
import { formatDate } from '../lib/formatters';
import roomImage from '../assets/marketing/room.jpg';
const key = value => String(value || '').slice(0, 10);
export default function HostReservations() {
  const [tab, setTab] = useState('today');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [source, setSource] = useState('all');
  const [filterOpen, setFilterOpen] = useState(false);
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
    {loading ? <div className="host-empty">Getting your reservations ready…</div> : error ? <div className="host-empty">We couldn’t load reservations. <button onClick={load}>Try again</button></div> : visible.length ? <div className="host-reservation-grid">{visible.map((b, i) => { const name = b.contactName || b.user?.name || 'Guest'; return <Link to="/admin/bookings" key={b._id} className="host-reservation-card"><div className="host-card-top"><span>{formatDate(b.startDate)} – {formatDate(b.endDate)}</span><ArrowUpRightIcon /></div><div className={`host-guest-avatar tone-${i % 3}`}><span>{name.charAt(0)}</span><img src={b.listing?.images?.[0] || roomImage} alt={b.listing?.name || 'Stay'} /></div><h3>{name}</h3><p>{b.listing?.name || 'Bowline Nature Stay'}</p><div className="host-card-bottom"><span><i />{key(b.startDate) === today ? 'Arriving today' : key(b.endDate) === today ? 'Checking out' : tab === 'today' ? 'Currently hosting' : 'Confirmed'}</span><span>{b.guests || 1} guests</span></div></Link>; })}</div> : <div className="host-empty"><Bookmark /><h3>{tab === 'today' ? 'A little room to breathe.' : 'Your next chapter starts here.'}</h3><p>{tab === 'today' ? 'No confirmed stays for today. Check upcoming reservations or manage your calendar.' : 'New confirmed reservations will appear here.'}</p><Link to="/admin/calendar" className="host-outline-button">Open calendar ↗</Link></div>}
  </section>;
}
function Bookmark() { return <span className="host-empty-symbol">⌂</span>; }
