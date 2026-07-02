import { useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

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

function CalendarGrid({ year, month, start, end, hovered, onDay, onHover }) {
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

          let bg = '';
          if (isStart || isEnd) bg = 'bg-amber-400 text-slate-900 rounded-full';
          else if (inRange)     bg = 'bg-amber-400/20 text-white';

          return (
            <button
              key={date.toISOString()}
              disabled={isPast}
              onClick={() => !isPast && onDay(date)}
              onMouseEnter={() => onHover && onHover(date)}
              className={`h-9 w-full text-sm flex items-center justify-center
                ${isPast ? 'text-slate-600 cursor-not-allowed' : 'hover:bg-amber-400/30 text-slate-200'}
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

  const today = startOfDay(new Date());
  const [start, setStart]     = useState(null);
  const [end, setEnd]         = useState(null);
  const [hovered, setHovered] = useState(null);
  const [step, setStep]       = useState('start'); // 'start' | 'end'
  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const handleDay = (date) => {
    if (step === 'start') {
      setStart(date);
      setEnd(null);
      setStep('end');
    } else {
      if (date <= start) {
        setStart(date);
        setEnd(null);
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
    window.location.href = `whatsapp://send?text=${encodeURIComponent(text)}`;
  };

  const nights = start && end ? Math.round((end - start) / 86400000) : 0;

  return (
    <div className="min-h-screen bg-slate-900 px-4 pt-6 pb-24">
      <p className="text-xs uppercase tracking-widest text-amber-400 mb-1">Bowline Nature Stay</p>
      <h1 className="text-white font-display text-2xl mb-0.5">Select Dates</h1>
      <p className="text-slate-400 text-sm mb-5">{room}</p>

      {/* Step hint */}
      <p className="text-amber-300 text-sm mb-4">
        {step === 'start' ? '📅 Tap your check-in date' : step === 'end' ? '📅 Tap your check-out date' : '✅ Dates selected'}
      </p>

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
        onDay={handleDay}
        onHover={step === 'end' ? setHovered : null}
      />

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

      <button
        onClick={handleConfirm}
        disabled={!start || !end}
        className="mt-4 w-full rounded-2xl bg-amber-400 disabled:opacity-30 text-slate-900 font-semibold py-4 text-base"
      >
        Confirm Dates →
      </button>
    </div>
  );
}
