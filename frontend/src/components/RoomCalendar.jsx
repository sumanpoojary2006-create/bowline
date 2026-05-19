import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import api from '../lib/api';
import { addDays } from '../lib/dateUtils';
import { formatDate } from '../lib/formatters';

const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function isInRange(date, start, end) {
  if (!start || !end) return false;
  return date > start && date < end;
}

function isBookedDay(date, bookedRanges) {
  return bookedRanges.some(
    (r) =>
      r.status === 'confirmed' &&
      new Date(r.startDate) <= date &&
      new Date(r.endDate) > date
  );
}

function CalendarMonth({ year, month, bookedRanges, startDate, endDate, onDayClick }) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days = [];
  for (let i = 0; i < firstDay.getDay(); i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));

  return (
    <div>
      <div className="mb-1 grid grid-cols-7 text-center">
        {DAY_NAMES.map((d) => (
          <span key={d} className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 py-1">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((date, idx) => {
          if (!date) return <span key={`empty-${idx}`} />;

          const booked = isBookedDay(date, bookedRanges);
          const isPast = date < today;
          const isStart = startDate && isSameDay(date, startDate);
          const isEnd = endDate && isSameDay(date, endDate);
          const inRange = isInRange(date, startDate, endDate);
          const disabled = booked || isPast;

          let cls =
            'flex h-10 w-full items-center justify-center text-sm transition-colors select-none touch-manipulation ';

          if (disabled) {
            cls += booked
              ? 'bg-rose-900/40 text-rose-400 line-through cursor-not-allowed'
              : 'text-slate-600 cursor-not-allowed';
          } else if (isStart || isEnd) {
            cls += 'bg-lime-400 text-slate-900 font-bold cursor-pointer rounded-full';
          } else if (inRange) {
            cls += 'bg-lime-400/20 text-lime-200 cursor-pointer';
          } else {
            cls += 'text-slate-200 hover:bg-white/10 cursor-pointer rounded-full';
          }

          return (
            <button
              key={date.toISOString()}
              type="button"
              disabled={disabled}
              className={cls}
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

function RoomCalendar({ listingId, listingType, startDate, endDate, onStartDate, onEndDate }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [bookedRanges, setBookedRanges] = useState([]);
  const [nextAvailable, setNextAvailable] = useState(null);
  const [selecting, setSelecting] = useState('start');

  useEffect(() => {
    if (!listingId) return;
    api
      .get(`/listings/${listingId}/booked-dates`, { params: { months: 4 } })
      .then(({ data }) => setBookedRanges(data.bookedRanges || []))
      .catch(() => {});
  }, [listingId]);

  useEffect(() => {
    if (!startDate || !endDate || !listingId) {
      setNextAvailable(null);
      return;
    }
    const nights = Math.max(Math.round((endDate - startDate) / 86400000), 1);
    api
      .get(`/listings/${listingId}/next-available`, {
        params: {
          from: startDate.toISOString(),
          nights,
        },
      })
      .then(({ data }) => {
        if (
          data.startDate &&
          !isSameDay(new Date(data.startDate), startDate)
        ) {
          setNextAvailable(data);
        } else {
          setNextAvailable(null);
        }
      })
      .catch(() => setNextAvailable(null));
  }, [startDate, endDate, listingId]);

  const handleDayClick = (date) => {
    if (selecting === 'start') {
      onStartDate(date);
      onEndDate(addDays(date, 1));
      setSelecting('end');
    } else {
      if (date <= startDate) {
        onStartDate(date);
        onEndDate(addDays(date, 1));
        setSelecting('end');
      } else {
        onEndDate(date);
        setSelecting('start');
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

  const nextViewMonth = viewMonth === 11 ? 0 : viewMonth + 1;
  const nextViewYear = viewMonth === 11 ? viewYear + 1 : viewYear;

  const monthName = (m, y) =>
    new Date(y, m, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-3">
      {/* Instruction */}
      <p className="text-sm font-medium text-lime-300">
        {selecting === 'start' ? '① Select check-in date' : '② Now select check-out date'}
      </p>

      {/* Mobile: one month + prev/next arrows */}
      <div className="sm:hidden">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={prevMonth}
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <p className="text-sm font-semibold text-slate-200">{monthName(viewMonth, viewYear)}</p>
          <button
            type="button"
            onClick={nextMonth}
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>
        </div>
        <CalendarMonth
          year={viewYear}
          month={viewMonth}
          bookedRanges={bookedRanges}
          startDate={startDate}
          endDate={endDate}
          onDayClick={handleDayClick}
        />
      </div>

      {/* Desktop: two months side by side */}
      <div className="hidden sm:grid sm:grid-cols-2 sm:gap-8">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={prevMonth} className="rounded-full p-1 text-slate-400 hover:text-white">
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <p className="text-sm font-semibold text-slate-300">{monthName(viewMonth, viewYear)}</p>
            <span className="w-6" />
          </div>
          <CalendarMonth
            year={viewYear}
            month={viewMonth}
            bookedRanges={bookedRanges}
            startDate={startDate}
            endDate={endDate}
            onDayClick={handleDayClick}
          />
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="w-6" />
            <p className="text-sm font-semibold text-slate-300">{monthName(nextViewMonth, nextViewYear)}</p>
            <button type="button" onClick={nextMonth} className="rounded-full p-1 text-slate-400 hover:text-white">
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
          <CalendarMonth
            year={nextViewYear}
            month={nextViewMonth}
            bookedRanges={bookedRanges}
            startDate={startDate}
            endDate={endDate}
            onDayClick={handleDayClick}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-lime-400" />
          Selected
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-rose-900/60" />
          Booked
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-white/10" />
          Available
        </span>
      </div>

      {nextAvailable && (
        <div className="rounded-[1.25rem] border border-amber-400/30 bg-amber-400/10 p-3 text-sm">
          <p className="font-semibold text-amber-300">Those dates are booked</p>
          <p className="mt-0.5 text-slate-300">
            Next available window:{' '}
            <span className="font-semibold text-white">
              {formatDate(new Date(nextAvailable.startDate))} – {formatDate(new Date(nextAvailable.endDate))}
            </span>
          </p>
          <button
            type="button"
            className="mt-2 text-xs font-semibold text-amber-300 underline underline-offset-2"
            onClick={() => {
              onStartDate(new Date(nextAvailable.startDate));
              onEndDate(new Date(nextAvailable.endDate));
              setSelecting('start');
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
