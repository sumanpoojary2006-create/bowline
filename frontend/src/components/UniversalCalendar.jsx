import { ChevronLeftIcon, ChevronRightIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useEffect, useRef, useState } from 'react';
import api from '../lib/api';
import { formatCurrency, formatDate } from '../lib/formatters';
import { calendarDateKey } from '../lib/hostCalendar';

const isActive = b => ['confirmed', 'blocked'].includes(b.status) || (b.status === 'pending' && ['paid', 'partially_paid'].includes(b.paymentStatus));

export default function UniversalCalendar() {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const requestRef = useRef(null);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDay, setSelectedDay] = useState(null);
  const [year, monthNumber] = month.split('-').map(Number);
  const first = new Date(year, monthNumber - 1, 1);
  const count = new Date(year, monthNumber, 0).getDate();
  const days = Array.from({ length: count }, (_, i) => calendarDateKey(new Date(year, monthNumber - 1, i + 1)));

  useEffect(() => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true); setError('');
    api.get('/bookings/admin/calendar', { params: { month }, signal: controller.signal })
      .then(({ data }) => setBookings(data.bookings || []))
      .catch(() => { if (!controller.signal.aborted) setError('We couldn’t load the calendar. Please try again.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    setSelectedDay(null);
    return () => controller.abort();
  }, [month]);

  const bookingsOn = day => bookings.filter(b => isActive(b) && String(b.startDate).slice(0, 10) <= day && String(b.endDate).slice(0, 10) > day);
  const moveMonth = delta => { const next = new Date(year, monthNumber - 1 + delta, 1); setMonth(calendarDateKey(next).slice(0, 7)); };
  const dayBookings = selectedDay ? bookingsOn(selectedDay) : [];

  return (
    <section className="host-universal-calendar" aria-label="All bookings calendar">
      <div className="host-section-title">
        <h2>All bookings</h2>
        <p>Every room, one calendar</p>
      </div>
      <div className="host-calendar-toolbar">
        <h2>{first.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</h2>
        <div className="flex items-center gap-2">
          <button className="host-icon-button" aria-label="Previous month" onClick={() => moveMonth(-1)}><ChevronLeftIcon /></button>
          <button className="host-outline-button" onClick={() => setMonth(today.slice(0, 7))}>Today</button>
          <button className="host-icon-button" aria-label="Next month" onClick={() => moveMonth(1)}><ChevronRightIcon /></button>
        </div>
      </div>
      {error ? (
        <div className="host-error">{error}</div>
      ) : loading ? (
        <div className="host-empty" role="status">Loading your calendar…</div>
      ) : (
        <>
          <div className="host-month host-month-compact">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i} className="host-weekday">{d}</div>)}
            {Array.from({ length: first.getDay() }, (_, i) => <div key={`empty-${i}`} />)}
            {days.map(day => {
              const active = bookingsOn(day);
              return (
                <button
                  key={day}
                  aria-label={`${formatDate(day)}, ${active.length} booking${active.length === 1 ? '' : 's'}`}
                  aria-pressed={selectedDay === day}
                  className={`host-day host-day-compact ${active.length ? 'is-booked' : ''} ${day === today ? 'is-today' : ''} ${selectedDay === day ? 'is-selected' : ''}`}
                  onClick={() => setSelectedDay(active.length ? (selectedDay === day ? null : day) : null)}
                >
                  <span className="host-day-number">{Number(day.slice(-2))}</span>
                  {active.length === 1 ? (
                    <span className="host-day-guest">{active[0].status === 'blocked' ? 'Blocked' : active[0].contactName || active[0].user?.name || 'Guest'}</span>
                  ) : active.length > 1 ? (
                    <span className="host-day-guest host-day-count">{active.length} bookings</span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <div className="host-calendar-legend"><span><i />Booking / blocked</span><span><i className="today" />Today</span></div>
          {selectedDay && (
            <section className="host-date-panel host-universal-panel" aria-label="Bookings for selected date">
              <div className="host-date-panel-top">
                <strong>{formatDate(selectedDay)}</strong>
                <button aria-label="Close details" onClick={() => setSelectedDay(null)}><XMarkIcon className="h-5 w-5" /></button>
              </div>
              <div className="host-universal-day-list">
                {dayBookings.map(b => (
                  <div key={b._id} className="host-universal-booking">
                    <p className="host-universal-booking-room">{b.listing?.name || 'Room'}</p>
                    <strong>{b.status === 'blocked' ? 'Blocked by you' : b.contactName || b.user?.name || 'Reservation'}</strong>
                    <p>{formatDate(b.startDate)} – {formatDate(b.endDate)}</p>
                    {b.status === 'blocked' ? (
                      <p className="mt-2 text-sm">{b.blockNote}</p>
                    ) : (
                      <div className="mt-2 space-y-1 text-sm">
                        <p>
                          {b.adultGuests ?? b.guests ?? 1} adult{(b.adultGuests ?? b.guests ?? 1) === 1 ? '' : 's'}
                          {b.childGuests ? ` · ${b.childGuests} child${b.childGuests === 1 ? '' : 'ren'}` : ''}
                          {b.pets ? ` · ${b.pets} pet${b.pets === 1 ? '' : 's'}` : ''}
                        </p>
                        {b.contactPhone && <p>📞 {b.contactPhone}</p>}
                        {(b.contactEmail || b.user?.email) && <p>✉️ {b.contactEmail || b.user?.email}</p>}
                        <p>{formatCurrency(b.totalPrice)} · <span className="capitalize">{b.paymentStatus?.replace('_', ' ')}</span>{b.source ? ` · ${b.source}` : ''}</p>
                        {b.specialRequests && <p className="text-[#717171]">&ldquo;{b.specialRequests}&rdquo;</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </section>
  );
}
