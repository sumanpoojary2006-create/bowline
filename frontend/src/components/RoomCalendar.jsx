import { ArrowRightIcon, CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import api from '../lib/api';
import { addDays, formatDateParam } from '../lib/dateUtils';
import { formatDate } from '../lib/formatters';

const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isInRange(date, start, end) {
  if (!start || !end) return false;
  return date > start && date < end;
}

function toLocalMidnight(dateStr) {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isBookedDay(date, bookedRanges) {
  return bookedRanges.some(
    (r) =>
      (r.status === 'confirmed' || r.status === 'blocked') &&
      toLocalMidnight(r.startDate) <= date &&
      toLocalMidnight(r.endDate) > date
  );
}

// Checking out on the same day another guest checks in is a normal turnover,
// not a conflict — this only blocks a candidate checkout date if it would
// actually put a booked night somewhere between the chosen check-in and it.
function wouldCheckoutConflict(date, startDate, bookedRanges) {
  if (!startDate) return false;
  return bookedRanges.some(
    (r) =>
      (r.status === 'confirmed' || r.status === 'blocked') &&
      toLocalMidnight(r.startDate) < date &&
      toLocalMidnight(r.endDate) > startDate
  );
}

export function CalendarMonth({ year, month, bookedRanges, startDate, endDate, showEnd, selecting, onDayClick }) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cells = [];
  for (let i = 0; i < firstDay.getDay(); i++) cells.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(new Date(year, month, d));

  return (
    <div className="w-full">
      {/* Day name headers */}
      <div className="mb-1 grid grid-cols-7">
        {DAY_NAMES.map((d) => (
          <div key={d} className="py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {d}
          </div>
        ))}
      </div>

      {/* Date cells */}
      <div className="grid grid-cols-7">
        {cells.map((date, idx) => {
          if (!date) return <div key={`empty-${idx}`} />;

          const booked = isBookedDay(date, bookedRanges);
          const isPast = date <= today;
          const isStart = startDate && isSameDay(date, startDate);
          const isEnd = showEnd && endDate && isSameDay(date, endDate);
          const inRange = showEnd && isInRange(date, startDate, endDate);
          // While picking checkout, a date *after* the chosen check-in is only
          // a real conflict if a booked night falls somewhere between the two
          // — landing on another guest's check-in day is a normal turnover,
          // not a conflict. Dates at/before check-in fall back to the normal
          // night-booked rule, since clicking one of those restarts check-in
          // there instead (and that must still respect occupied nights).
          const useCheckoutRule = selecting === 'end' && startDate && date > startDate;
          const disabled = isPast || (useCheckoutRule ? wouldCheckoutConflict(date, startDate, bookedRanges) : booked);
          const dayLabel = date.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          });

          let base = 'flex items-center justify-center text-sm select-none ';
          let size = 'aspect-square w-full ';
          let style = '';

          if (disabled) {
            style = booked
              ? 'bg-rose-900/40 text-rose-400 line-through cursor-not-allowed rounded-full'
              : 'text-slate-600 cursor-not-allowed';
          } else if (isStart || isEnd) {
            style = 'bg-lime-400 text-slate-900 font-bold cursor-pointer rounded-full';
          } else if (inRange) {
            style = 'bg-lime-400/20 text-lime-200 cursor-pointer';
          } else {
            style = 'text-slate-200 hover:bg-white/10 cursor-pointer rounded-full';
          }

          return (
            <button
              key={date.toISOString()}
              type="button"
              aria-label={dayLabel}
              disabled={disabled}
              style={{ touchAction: 'manipulation' }}
              className={base + size + style}
              onClick={() => !disabled && onDayClick(date)}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RoomCalendar({ listingId, listingIds, startDate, endDate, onStartDate, onEndDate, onRangeComplete }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const ids = listingIds?.length ? listingIds : listingId ? [listingId] : [];
  const idsKey = ids.join(',');

  const [viewMonth, setViewMonth] = useState((startDate || today).getMonth());
  const [viewYear, setViewYear] = useState((startDate || today).getFullYear());
  const [bookedRanges, setBookedRanges] = useState([]);
  const [nextAvailable, setNextAvailable] = useState(null);
  const [selecting, setSelecting] = useState('start');
  const [hasEndSelected, setHasEndSelected] = useState(Boolean(startDate && endDate));

  useEffect(() => {
    if (!ids.length) return;
    const request =
      ids.length > 1
        ? api.get('/listings/availability/booked-dates', { params: { ids: idsKey, months: 4 } })
        : api.get(`/listings/${ids[0]}/booked-dates`, { params: { months: 4 } });

    request.then(({ data }) => setBookedRanges(data.bookedRanges || [])).catch(() => {});
  }, [idsKey]);

  useEffect(() => {
    if (!startDate || !endDate || !ids.length) { setNextAvailable(null); return; }
    const nights = Math.max(Math.round((endDate - startDate) / 86400000), 1);
    // Send a plain calendar-day string, not a full ISO timestamp — startDate
    // is local midnight, and toISOString() on that converts to UTC, which in
    // any timezone ahead of UTC (e.g. IST) lands on the *previous* day's
    // evening, throwing off the backend's day-boundary comparisons.
    const from = formatDateParam(startDate);
    const request =
      ids.length > 1
        ? api.get('/listings/availability/next-available', { params: { ids: idsKey, from, nights } })
        : api.get(`/listings/${ids[0]}/next-available`, { params: { from, nights } });

    request
      .then(({ data }) => {
        if (data.startDate && !isSameDay(new Date(data.startDate), startDate)) {
          setNextAvailable(data);
        } else {
          setNextAvailable(null);
        }
      })
      .catch(() => setNextAvailable(null));
  }, [startDate, endDate, idsKey]);

  const handleDayClick = (date) => {
    if (selecting === 'start') {
      onStartDate(date);
      // Default checkout to the next day so the pill has something sensible
      // to show right away, but don't mark it "selected" in the grid yet —
      // the guest still has to tap a checkout date themselves.
      onEndDate(addDays(date, 1));
      setSelecting('end');
      setHasEndSelected(false);
    } else {
      if (date <= startDate) {
        onStartDate(date);
        onEndDate(addDays(date, 1));
        setSelecting('end');
        setHasEndSelected(false);
      } else {
        onEndDate(date);
        setSelecting('start');
        setHasEndSelected(true);
        onRangeComplete?.();
      }
    }
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  const monthLabel = (year, month) =>
    new Date(year, month, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const secondMonth = viewMonth === 11 ? 0 : viewMonth + 1;
  const secondYear = viewMonth === 11 ? viewYear + 1 : viewYear;

  return (
    <div className="space-y-3">
      {/* Check-in / Check-out pill header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] border border-lime-100/15 bg-black/30 px-4 py-3">
        <div className="flex items-center gap-3 text-sm">
          <CalendarDaysIcon className="h-5 w-5 text-lime-200" />
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#aab5a5]">Check-in</p>
            <p className="font-semibold text-white">
              {startDate ? startDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Select date'}
            </p>
          </div>
        </div>
        <ArrowRightIcon className="h-4 w-4 text-[#aab5a5]" />
        <div className="text-sm">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#aab5a5]">Check-out</p>
          <p className="font-semibold text-white">
            {endDate ? endDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Select date'}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={prevMonth}
            style={{ touchAction: 'manipulation' }}
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={nextMonth}
            style={{ touchAction: 'manipulation' }}
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Step prompt */}
      <p className="text-sm font-medium text-lime-300">
        {selecting === 'start' ? '① Tap your check-in date' : '② Tap your check-out date'}
      </p>

      {/* Two months side by side on larger screens, one on mobile */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-center text-sm font-semibold text-slate-200">{monthLabel(viewYear, viewMonth)}</p>
          <CalendarMonth
            year={viewYear}
            month={viewMonth}
            bookedRanges={bookedRanges}
            startDate={startDate}
            endDate={endDate}
            showEnd={hasEndSelected}
            selecting={selecting}
            onDayClick={handleDayClick}
          />
        </div>
        <div className="hidden sm:block">
          <p className="mb-1 text-center text-sm font-semibold text-slate-200">{monthLabel(secondYear, secondMonth)}</p>
          <CalendarMonth
            year={secondYear}
            month={secondMonth}
            bookedRanges={bookedRanges}
            startDate={startDate}
            endDate={endDate}
            showEnd={hasEndSelected}
            selecting={selecting}
            onDayClick={handleDayClick}
          />
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-lime-400" /> Selected
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-rose-900/60" /> Booked
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-white/10" /> Available
        </span>
      </div>

      {/* Next available suggestion */}
      {nextAvailable && (
        <div className="rounded-[1.25rem] border border-amber-400/30 bg-amber-400/10 p-3 text-sm">
          <p className="font-semibold text-amber-300">Those dates are booked</p>
          {ids.length > 1 && nextAvailable.blockingRooms?.length > 0 && (
            <p className="mt-0.5 text-xs text-amber-200/80">
              {nextAvailable.blockingRooms.join(', ')}{' '}
              {nextAvailable.blockingRooms.length > 1 ? 'are' : 'is'} already booked that night.
            </p>
          )}
          <p className="mt-0.5 text-slate-300">
            Next available:{' '}
            <span className="font-semibold text-white">
              {formatDate(new Date(nextAvailable.startDate))} – {formatDate(new Date(nextAvailable.endDate))}
            </span>
          </p>
          <button
            type="button"
            style={{ touchAction: 'manipulation' }}
            className="mt-2 text-xs font-semibold text-amber-300 underline underline-offset-2"
            onClick={() => {
              onStartDate(new Date(nextAvailable.startDate));
              onEndDate(new Date(nextAvailable.endDate));
              setSelecting('start');
              setHasEndSelected(true);
              onRangeComplete?.();
            }}
          >
            Use these dates
          </button>
        </div>
      )}
    </div>
  );
}

export default RoomCalendar;
