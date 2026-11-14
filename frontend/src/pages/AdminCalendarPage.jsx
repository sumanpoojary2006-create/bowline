import { ChevronLeftIcon, ChevronRightIcon, XMarkIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { formatCurrency, formatDate } from '../lib/formatters';
import roomImage from '../assets/marketing/room.jpg';
import { calendarDateKey, calendarNightRate } from '../lib/hostCalendar';

export default function AdminCalendarPage() {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Kolkata' }).format(new Date());
  const requestRef = useRef(null);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [rules, setRules] = useState([]);
  const [roomId, setRoomId] = useState(null);
  const [search, setSearch] = useState('');
  const [selection, setSelection] = useState([]);
  const [price, setPrice] = useState('');
  const [note, setNote] = useState('');
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [year, monthNumber] = month.split('-').map(Number);
  const first = new Date(year, monthNumber - 1, 1);
  const count = new Date(year, monthNumber, 0).getDate();
  const days = Array.from({ length: count }, (_, i) => calendarDateKey(new Date(year, monthNumber - 1, i + 1)));
  const room = rooms.find(r => r._id === roomId);
  const load = async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true); setError('');
    try {
      const [inventory, calendar, pricing] = await Promise.all([api.get('/listings/admin/all', {signal:controller.signal}), api.get('/bookings/admin/calendar', { params: { month }, signal:controller.signal }), api.get('/admin/pricing-rules', {signal:controller.signal})]);
      setRooms(inventory.data.listings.filter(l => l.type === 'room'));
      setBookings(calendar.data.bookings || []); setRules(pricing.data.rules || []);
    } catch { if (!controller.signal.aborted) setError('We couldn’t load the calendar. Please try again.'); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  };
  useEffect(() => { document.title = 'Bowline Admin | Calendar'; load(); setSelection([]); setDetail(null); return () => requestRef.current?.abort(); }, [month]);
  const bookingOn = (id, day) => bookings.find(b => (b.listing?._id || b.listing) === id && (['confirmed','blocked'].includes(b.status) || b.status === 'pending' && ['paid','partially_paid'].includes(b.paymentStatus)) && String(b.startDate).slice(0,10) <= day && String(b.endDate).slice(0,10) > day);
  const moveMonth = delta => { const next = new Date(year, monthNumber - 1 + delta, 1); setMonth(calendarDateKey(next).slice(0,7)); };
  const inSelection = day => selection.length && day >= selection[0] && day <= (selection[1] || selection[0]);
  const selectDay = day => {
    const booking = bookingOn(roomId, day);
    if (booking) { setDetail(booking); setSelection([]); return; }
    setDetail(null);
    if (selection.length !== 1) { setSelection([day]); setPrice(''); setNote(''); }
    else { const range = [selection[0], day].sort(); if (days.some(d => d >= range[0] && d <= range[1] && bookingOn(roomId,d))) { toast.error('This range includes a reservation or blocked date. Choose free dates.'); return; } setSelection(range); }
  };
  const save = async mode => {
    if (!selection.length || saving) return;
    const startDate = selection[0];
    const last = selection[1] || startDate;
    const end = new Date(`${last}T12:00:00`); end.setDate(end.getDate() + 1);
    setSaving(true);
    try {
      if (mode === 'block') {
        if (!note.trim()) { toast.error('Add a reason for blocking these dates.'); return; }
        await api.post('/bookings/admin/block', { listingIds:[roomId], startDate, endDate:calendarDateKey(end), blockNote:note.trim() });
      } else {
        if (price === '' || !Number.isFinite(Number(price)) || Number(price) <= 0) { toast.error('Enter a price greater than zero.'); return; }
        // A percentage rule replaces the effective base while preserving the pricing engine.
        // Reject overlapping rules: silently stacking them would produce an incorrect tariff.
        if (rules.some(r => r.active && (!r.listing || (r.listing?._id || r.listing) === roomId) && (!r.listingType || ['all','room'].includes(r.listingType)) && String(r.startDate).slice(0,10) <= last && String(r.endDate).slice(0,10) >= startDate)) { toast.error('These dates already have pricing rules. Update them in Pricing to avoid overlapping tariffs.'); return; }
        const base = Number(room.manualPriceOverride ?? room.price);
        await api.post('/admin/pricing-rules', { name:`Calendar tariff · ${room.name} · ${startDate}`, listing:roomId, listingType:'room', startDate, endDate:last, adjustmentType:'flat', adjustmentValue:Number(price)-base, priority:1, active:true });
      }
      toast.success(mode === 'block' ? 'Dates blocked' : 'Price updated'); setSelection([]); await load();
    } catch (e) { toast.error(e.response?.data?.message || 'Could not save changes'); }
    finally { setSaving(false); }
  };
  const unblock = async () => {
    setSaving(true);
    try { await api.delete(`/bookings/admin/block/${detail._id}`); setDetail(null); toast.success('Dates are available again'); await load(); }
    catch (e) { toast.error(e.response?.data?.message || 'Unable to remove block'); } finally { setSaving(false); }
  };
  return <div>
    <div className="host-welcome-top"><div><p className="host-eyebrow">AVAILABILITY & NIGHTLY TARIFFS</p><h1 style={{fontSize:36,fontWeight:650,letterSpacing:'-1.5px',marginTop:10}}>{room ? room.name : 'Calendars'}</h1><p style={{marginTop:8}}>{room ? 'A clear view of every stay and every open night.' : 'Your spaces, at a glance. Choose a listing to manage dates.'}</p></div><div className="host-calendar-heading-actions">{room && <button className="host-icon-button" aria-label="Back to calendars" onClick={() => {setRoomId(null);setSelection([]);setDetail(null);}}><ArrowLeftIcon /></button>}<Link className="host-outline-button host-multi-room-link" to="/admin/block-rooms">Block multiple rooms ↗</Link></div></div>
    <div className="host-calendar-toolbar"><h2>{first.toLocaleDateString('en-IN', {month:'long',year:'numeric'})}</h2><div className="flex items-center gap-2"><button className="host-icon-button" aria-label="Previous month" onClick={() => moveMonth(-1)}><ChevronLeftIcon /></button><button className="host-outline-button" onClick={() => setMonth(today.slice(0,7))}>Today</button><button className="host-icon-button" aria-label="Next month" onClick={() => moveMonth(1)}><ChevronRightIcon /></button></div></div>
    {error ? <div className="host-error">{error} <button onClick={load}>Retry</button></div> : loading ? <div className="host-empty" role="status">Loading your calendar…</div> : !room ? <><input className="input mb-6" aria-label="Search calendars" placeholder="Search your spaces" value={search} onChange={e => setSearch(e.target.value)} /><div className="host-calendar-list">{rooms.filter(r => r.name.toLowerCase().includes(search.toLowerCase())).map(r => <button key={r._id} className="host-calendar-room" onClick={() => setRoomId(r._id)}><img src={r.images?.[0] || roomImage} alt="" /><div><h3>{r.name}</h3><p>{r.active ? 'Listed' : 'Unlisted'} · {r.maxOccupancy || r.capacity} guests</p><p>{days.filter(d => bookingOn(r._id,d)).length} nights unavailable</p></div><div className="host-mini-calendar" aria-hidden="true">{days.map(d => <i key={d} className={d === today ? 'current' : bookingOn(r._id,d) ? 'occupied' : ''} />)}</div></button>)}</div>{!rooms.length && <div className="host-empty">Create a room listing to start managing availability.</div>}</> : <>
      <div className={`host-calendar-detail ${selection.length || detail ? 'has-editor' : ''}`}><div className="host-calendar-board">
      <p className="host-selection-hint">Select a date, then another to choose a range. Tap a reservation for details. Rates are per guest, per night, before tax.</p>
      <div className="host-month">{['S','M','T','W','T','F','S'].map((d,i) => <div key={i} className="host-weekday">{d}</div>)}{Array.from({length:first.getDay()}, (_,i) => <div key={`empty-${i}`} />)}{days.map(day => { const b = bookingOn(roomId,day); return <button key={day} aria-label={`${formatDate(day)}, ${b?.status === 'blocked' ? 'blocked' : b ? 'reserved' : 'available'}, ${formatCurrency(calendarNightRate(room,day,rules))}`} aria-pressed={Boolean(inSelection(day))} className={`host-day ${b ? 'is-booked' : ''} ${b?.status === 'blocked' ? 'is-blocked' : ''} ${inSelection(day) ? 'is-selected' : ''} ${day === today ? 'is-today' : ''}`} onClick={() => selectDay(day)}><span className="host-day-number">{Number(day.slice(-2))}</span>{b && <span className="host-day-guest">{b.status === 'blocked' ? 'Blocked' : b.contactName || b.user?.name || 'Reserved'}</span>}<span className="host-day-price">{formatCurrency(calendarNightRate(room,day,rules))}</span></button>; })}</div>
      <div className="host-calendar-legend"><span><i />Reserved / blocked</span><span><i className="today" />Today</span><span><i className="selected" />Selected dates</span></div>
      </div>
      {selection.length > 0 && <section className="host-date-panel" aria-label="Edit selected dates"><div className="host-date-panel-top"><strong>{formatDate(selection[0])}{selection[1] && ` – ${formatDate(selection[1])}`}</strong><button aria-label="Clear selection" onClick={() => setSelection([])}><XMarkIcon className="h-5 w-5" /></button></div><div className="host-date-panel-grid"><label>Price per guest / night (₹)<input type="number" min="1" placeholder={String(calendarNightRate(room,selection[0],rules))} value={price} onChange={e => setPrice(e.target.value)} /></label><label>Reason for blocking<input placeholder="e.g. Maintenance" value={note} onChange={e => setNote(e.target.value)} /></label></div><div className="host-date-panel-actions"><button className="host-save" disabled={saving} onClick={() => save('price')}>Save price</button><button className="host-save" disabled={saving} onClick={() => save('block')}>Block dates</button><Link to="/admin/pricing">Custom pricing rules ↗</Link></div></section>}
      {detail && <section className="host-date-panel" aria-label="Reservation details"><div className="host-date-panel-top"><strong>{detail.status === 'blocked' ? 'Blocked by you' : detail.contactName || detail.user?.name || 'Reservation'}</strong><button aria-label="Close details" onClick={() => setDetail(null)}><XMarkIcon className="h-5 w-5" /></button></div><p>{formatDate(detail.startDate)} – {formatDate(detail.endDate)} · {room.name}</p><p className="mt-3 text-sm">{detail.blockNote || detail.specialRequests || `${detail.guests || 1} guests · ${formatCurrency(detail.totalPrice)}`}</p><div className="host-date-panel-actions">{detail.status === 'blocked' ? <button className="host-save" disabled={saving} onClick={unblock}>Make available · remove entire block</button> : <Link to="/admin/bookings">Manage reservation ↗</Link>}</div></section>}
      </div>
    </>}
  </div>;
}
