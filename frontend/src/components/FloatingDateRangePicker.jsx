import {
  ArrowRightIcon,
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { useEffect, useRef, useState } from 'react';
import { addDays } from '../lib/dateUtils';
import { CalendarMonth } from './RoomCalendar';

function isSameDay(a, b) {
  return (
    a?.getFullYear() === b?.getFullYear() &&
    a?.getMonth() === b?.getMonth() &&
    a?.getDate() === b?.getDate()
  );
}

function monthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
}

function displayDate(date) {
  if (!date) return 'Select';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function FloatingDateRangePicker({
  open,
  startDate,
  endDate,
  initialStep = 'start',
  onChange,
  onComplete,
  onClose,
}) {
  const panelRef = useRef(null);
  const [selecting, setSelecting] = useState(initialStep);
  const [showEnd, setShowEnd] = useState(Boolean(startDate && endDate));
  const [viewMonth, setViewMonth] = useState((startDate || new Date()).getMonth());
  const [viewYear, setViewYear] = useState((startDate || new Date()).getFullYear());

  useEffect(() => {
    if (!open) return;
    const viewDate = startDate || new Date();
    setViewMonth(viewDate.getMonth());
    setViewYear(viewDate.getFullYear());
    setSelecting(initialStep);
    setShowEnd(Boolean(startDate && endDate));
  }, [open, initialStep]);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (!panelRef.current?.contains(event.target)) {
        onClose?.();
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const secondMonth = viewMonth === 11 ? 0 : viewMonth + 1;
  const secondYear = viewMonth === 11 ? viewYear + 1 : viewYear;
  const activeStart = startDate || new Date();
  const activeEnd = endDate || addDays(activeStart, 1);

  const goToPreviousMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((year) => year - 1);
    } else {
      setViewMonth((month) => month - 1);
    }
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((year) => year + 1);
    } else {
      setViewMonth((month) => month + 1);
    }
  };

  const handleDayClick = (date) => {
    if (selecting === 'start' || !startDate) {
      const nextRange = { startDate: date, endDate: addDays(date, 1) };
      onChange(nextRange);
      setSelecting('end');
      setShowEnd(false);
      return;
    }

    if (date <= startDate || isSameDay(date, startDate)) {
      const nextRange = { startDate: date, endDate: addDays(date, 1) };
      onChange(nextRange);
      setSelecting('end');
      setShowEnd(false);
      return;
    }

    const nextRange = { startDate, endDate: date };
    onChange(nextRange);
    setShowEnd(true);
    onComplete?.(nextRange);
    onClose?.();
  };

  return (
    <div
      ref={panelRef}
      className="absolute left-0 right-0 top-[calc(100%+0.75rem)] z-50 mx-auto max-w-4xl"
    >
      <div className="overflow-hidden rounded-2xl border border-lime-100/14 bg-[#090f0b]/95 shadow-[0_24px_80px_rgba(0,0,0,0.5)] backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-lime-100/10 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-lime-100/12 bg-lime-200/10 text-lime-200">
              <CalendarDaysIcon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-lime-200/80">
                {selecting === 'start' ? 'Check-in date' : 'Check-out date'}
              </p>
              <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-[#f5f0dd]">
                <span>{displayDate(activeStart)}</span>
                <ArrowRightIcon className="h-4 w-4 text-[#879581]" />
                <span className={showEnd ? '' : 'text-[#879581]'}>{showEnd ? displayDate(activeEnd) : 'Select'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Previous month"
              onClick={goToPreviousMonth}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-lime-100/10 text-[#cdd6c9] transition hover:bg-white/10 hover:text-white"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Next month"
              onClick={goToNextMonth}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-lime-100/10 text-[#cdd6c9] transition hover:bg-white/10 hover:text-white"
            >
              <ChevronRightIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="grid gap-6 px-4 py-5 sm:px-5 md:grid-cols-2">
          <div>
            <p className="mb-2 text-center text-sm font-semibold text-[#f5f0dd]">
              {monthLabel(viewYear, viewMonth)}
            </p>
            <CalendarMonth
              year={viewYear}
              month={viewMonth}
              bookedRanges={[]}
              startDate={startDate}
              endDate={endDate}
              showEnd={showEnd}
              onDayClick={handleDayClick}
            />
          </div>
          <div className="hidden md:block">
            <p className="mb-2 text-center text-sm font-semibold text-[#f5f0dd]">
              {monthLabel(secondYear, secondMonth)}
            </p>
            <CalendarMonth
              year={secondYear}
              month={secondMonth}
              bookedRanges={[]}
              startDate={startDate}
              endDate={endDate}
              showEnd={showEnd}
              onDayClick={handleDayClick}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default FloatingDateRangePicker;
