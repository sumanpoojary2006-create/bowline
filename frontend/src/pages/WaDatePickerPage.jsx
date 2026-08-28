import { useEffect, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import api from '../lib/api';
import { isBookedDay, wouldCheckoutConflict } from '../lib/waDateAvailability';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function sameDay(a, b) {
  return a && b && a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}
function startOfDay(d) {
  const c = new Date(d); c.setHours(0,0,0,0); return c;
}
function fmtFull(d) {
  return d.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
}
function fmtShort(d) {
  return d.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
}

function CalendarGrid({ year, month, start, end, hovered, step, bookedRanges, loading, onDay, onHover }) {
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const today = startOfDay(new Date());
  const cells = [];

  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const rangeEnd = end || hovered;

  return (
    <div>
      <p className="text-center text-white font-semibold mb-3">{MONTHS[month]} {year}</p>
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => <p key={d} className="text-center text-xs text-slate-400">{d}</p>)}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((date, i) => {
          if (!date) return <div key={`e${i}`} />;
          const isPast = date < today;
          const isStart = sameDay(date, start);
          const isEnd   = sameDay(date, end);
          const inRange = start && rangeEnd && date > start && date < rangeEnd;
          const booked = isBookedDay(date, bookedRanges);
          const choosingCheckout = step === 'end' && start && date > start;
          const conflicts = choosingCheckout
            ? wouldCheckoutConflict(date, start, bookedRanges)
            : booked;
          const disabled = isPast || loading || conflicts;
          const showBooked = booked && !choosingCheckout;

          let bg = '';
          if (isStart || isEnd) bg = 'bg-amber-400 text-slate-900 rounded-full';
          else if (inRange)     bg = 'bg-amber-400/20 text-white';
          else if (showBooked)  bg = 'bg-rose-900/50 text-rose-300 line-through rounded-full';

          return (
            <button
              key={date.toISOString()}
              type="button"
              aria-label={`${fmtFull(date)}${conflicts ? ' — unavailable' : ''}`}
              disabled={disabled}
              onClick={() => !disabled && onDay(date)}
              onMouseEnter={() => !disabled && onHover && onHover(date)}
              className={`h-9 w-full text-sm flex items-center justify-center
                ${disabled && !showBooked ? 'text-slate-600 cursor-not-allowed' : ''}
                ${disabled && showBooked ? 'cursor-not-allowed' : ''}
                ${!disabled ? 'hover:bg-amber-400/30 text-slate-200' : ''}
                ${bg}`}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function WaDatePickerPage() {
  const params = new URLSearchParams(window.location.search);
  const room = params.get('room') || 'your room';
  const requestedListingId = params.get('listingId');
  const BOWLINE_WA = '916360718604';

  const today = startOfDay(new Date());
  const [start, setStart]     = useState(null);
  const [end, setEnd]         = useState(null);
  const [hovered, setHovered] = useState(null);
  const [step, setStep]       = useState('start'); // 'start' | 'end' | 'done' | 'copied'
  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [bookedRanges, setBookedRanges] = useState([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(true);
  const [availabilityError, setAvailabilityError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadAvailability = async () => {
      setAvailabilityLoading(true);
      setAvailabilityError('');

      try {
        let listingId = requestedListingId;

        // Older WhatsApp messages contain only the room name. Keep those
        // links working while all newly-sent links carry the stable listing ID.
        if (!listingId) {
          const { data } = await api.get('/listings', { params: { type: 'room' } });
          const normalizedRoom = room.trim().toLowerCase();
          listingId = data.listings?.find(
            (listing) => listing.name?.trim().toLowerCase() === normalizedRoom
          )?._id;
        }

        if (!listingId) throw new Error('Room not found');

        const { data } = await api.get(`/listings/${listingId}/booked-dates`, {
          params: { months: 12 },
        });

        if (!cancelled) setBookedRanges(data.bookedRanges || []);
      } catch {
        if (!cancelled) {
          setBookedRanges([]);
          setAvailabilityError('Live availability could not be loaded. Please retry before selecting dates.');
        }
      } finally {
        if (!cancelled) setAvailabilityLoading(false);
      }
    };

    loadAvailability();
    return () => { cancelled = true; };
  }, [requestedListingId, room, reloadKey]);

  const handleDay = (date) => {
    if (step === 'start' || step === 'done') {
      setStart(date);
      setEnd(null);
      setHovered(null);
      setStep('end');
    } else {
      if (date <= start) {
        // tapped same or earlier date — restart from this date as new check-in
        setStart(date);
        setEnd(null);
        setHovered(null);
        setStep('end');
      } else {
        setEnd(date);
        setStep('done');
      }
    }
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y-1); }
    else setViewMonth(m => m-1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y+1); }
    else setViewMonth(m => m+1);
  };

  const handleConfirm = () => {
    if (!start || !end) return;
    const text = `DATES: ${fmtShort(start)} - ${fmtShort(end)}`;
    window.location.href = `https://wa.me/${BOWLINE_WA}?text=${encodeURIComponent(text)}`;
  };

  const nights = start && end ? Math.round((end - start) / 86400000) : 0;

  return (
    <div className="min-h-screen bg-slate-900 px-4 pt-6 pb-24">
      <p className="text-xs uppercase tracking-widest text-amber-400 mb-1">Bowline Nature Stay</p>
      <h1 className="text-white font-display text-2xl mb-0.5">Select Dates</h1>
      <p className="text-slate-400 text-sm mb-5">{room}</p>

      {/* Step hint */}
      <p className="text-amber-300 text-sm mb-4">
        {step === 'start' ? '📅 Tap your check-in date' : step === 'end' ? '📅 Tap your check-out date' : '✅ Dates selected — tap any date to change'}
      </p>

      {availabilityLoading && (
        <p className="mb-4 rounded-xl bg-slate-800 px-3 py-2 text-sm text-slate-300">
          Checking live availability…
        </p>
      )}
      {availabilityError && (
        <div className="mb-4 rounded-xl border border-rose-500/40 bg-rose-950/40 px-3 py-3 text-sm text-rose-200">
          <p>{availabilityError}</p>
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            className="mt-2 font-semibold text-white underline underline-offset-2"
          >
            Retry availability
          </button>
        </div>
      )}

      {/* Calendar nav */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-2 text-slate-300 hover:text-white">
          <ChevronLeftIcon className="w-5 h-5" />
        </button>
        <div />
        <button onClick={nextMonth} className="p-2 text-slate-300 hover:text-white">
          <ChevronRightIcon className="w-5 h-5" />
        </button>
      </div>

      <CalendarGrid
        year={viewYear}
        month={viewMonth}
        start={start}
        end={end}
        hovered={hovered}
        step={step}
        bookedRanges={bookedRanges}
        loading={availabilityLoading || Boolean(availabilityError)}
        onDay={handleDay}
        onHover={step === 'end' ? setHovered : null}
      />

      <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-900/50 text-rose-300 line-through">12</span>
        <span>Already booked — unavailable</span>
      </div>

      {/* Summary */}
      {start && (
        <div className="mt-6 rounded-2xl bg-slate-800 p-4 text-sm text-slate-300 space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-400">Check-in</span>
            <span className="text-white font-medium">{fmtFull(start)}</span>
          </div>
          {end && (
            <>
              <div className="flex justify-between">
                <span className="text-slate-400">Check-out</span>
                <span className="text-white font-medium">{fmtFull(end)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-700 pt-2">
                <span className="text-slate-400">Nights</span>
                <span className="text-white font-medium">{nights}</span>
              </div>
            </>
          )}
        </div>
      )}

      {step === 'copied' ? (
        <div className="mt-6 rounded-2xl bg-green-900/50 border border-green-500/40 p-5 text-center">
          <p className="text-green-400 text-2xl mb-2">✅</p>
          <p className="text-white font-semibold text-lg mb-1">Dates copied!</p>
          <p className="text-slate-300 text-sm mb-4">
            Tap the <span className="font-bold text-white">← Back</span> button to return to the chat,
            then <span className="font-bold text-white">paste</span> the message and send it.
          </p>
          <div className="bg-slate-800 rounded-xl px-4 py-3 text-amber-300 font-mono text-sm">
            DATES: {fmtShort(start)} - {fmtShort(end)}
          </div>
        </div>
      ) : (
        <button
          onClick={handleConfirm}
          disabled={!start || !end || availabilityLoading || Boolean(availabilityError)}
          className="mt-4 w-full rounded-2xl bg-amber-400 disabled:opacity-30 text-slate-900 font-semibold py-4 text-base"
        >
          Confirm Dates →
        </button>
      )}
    </div>
  );
}
