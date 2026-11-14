import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import employeeApi from '../../lib/employeeApi';

const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const STATUS_STYLES = {
  full: 'bg-emerald-500/80 text-slate-950',
  partial: 'bg-amber-400/80 text-slate-950',
  leave: 'bg-rose-500/80 text-white',
  absent: 'bg-rose-500/80 text-white',
};

function monthKey(year, month) {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function AttendanceCalendar({ onLeaveApplied }) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [leaveMode, setLeaveMode] = useState(false);
  const [selectedDates, setSelectedDates] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const today = todayKey();
  const key = monthKey(cursor.year, cursor.month);

  const fetchCalendar = async () => {
    setLoading(true);
    try {
      const { data } = await employeeApi.get('/employee/attendance-calendar', { params: { month: key } });
      setDays(data.days);
    } catch {
      toast.error('Unable to load attendance calendar');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const statusByDate = useMemo(() => new Map(days.map((d) => [d.date, d.status])), [days]);

  const firstDay = new Date(cursor.year, cursor.month, 1);
  const lastDay = new Date(cursor.year, cursor.month + 1, 0);
  const cells = [];
  for (let i = 0; i < firstDay.getDay(); i += 1) cells.push(null);
  for (let d = 1; d <= lastDay.getDate(); d += 1) {
    cells.push(`${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }

  const changeMonth = (delta) => {
    setCursor((prev) => {
      const next = new Date(prev.year, prev.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  const isSelectable = (date) => date >= today && !statusByDate.get(date);

  const toggleDate = (date) => {
    if (!leaveMode || !isSelectable(date)) return;
    setSelectedDates((prev) =>
      prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date]
    );
  };

  const cancelLeaveMode = () => {
    setLeaveMode(false);
    setSelectedDates([]);
  };

  const submitLeave = async () => {
    if (!selectedDates.length) return;
    setSubmitting(true);
    try {
      await employeeApi.post('/employee/leave', { dates: selectedDates });
      toast.success('Leave application submitted');
      setLeaveMode(false);
      setSelectedDates([]);
      await fetchCalendar();
      onLeaveApplied?.();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to submit leave application');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="glass rounded-[1.5rem] p-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="rounded-full border border-white/10 px-2 py-1 text-xs text-slate-300"
          onClick={() => changeMonth(-1)}
        >
          ‹
        </button>
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.25em] text-lime-200/60">Attendance</p>
          <p className="text-sm font-semibold text-white">
            {new Date(cursor.year, cursor.month, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button
          type="button"
          className="rounded-full border border-white/10 px-2 py-1 text-xs text-slate-300"
          onClick={() => changeMonth(1)}
        >
          ›
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1">
        {DAY_NAMES.map((d) => (
          <div key={d} className="py-1 text-center text-[10px] font-semibold uppercase text-slate-500">
            {d}
          </div>
        ))}
        {cells.map((date, idx) => {
          if (!date) return <div key={`empty-${idx}`} />;
          const status = statusByDate.get(date);
          const selected = selectedDates.includes(date);
          const selectable = leaveMode && isSelectable(date);
          const dayNum = Number(date.slice(-2));

          let classes = 'flex h-9 items-center justify-center rounded-lg text-xs font-semibold transition';
          if (selected) {
            classes += ' bg-sky-400 text-slate-950 ring-2 ring-sky-200';
          } else if (status && STATUS_STYLES[status]) {
            classes += ` ${STATUS_STYLES[status]}`;
          } else {
            classes += selectable ? ' bg-white/10 text-slate-300 hover:bg-white/20 cursor-pointer' : ' bg-white/5 text-slate-500';
          }
          if (date === today) classes += ' outline outline-1 outline-lime-200/70';

          return (
            <button
              key={date}
              type="button"
              disabled={!selectable}
              onClick={() => toggleDate(date)}
              className={classes}
            >
              {dayNum}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-3 text-[11px] text-slate-400">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Full day</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Half day</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Leave / absent</span>
      </div>

      {loading ? (
        <p className="mt-3 text-center text-xs text-slate-500">Loading…</p>
      ) : null}

      <div className="mt-4 border-t border-white/10 pt-4">
        {!leaveMode ? (
          <button
            type="button"
            className="w-full rounded-full border border-white/10 bg-white/5 py-2 text-xs font-semibold text-lime-200"
            onClick={() => setLeaveMode(true)}
          >
            Apply Leave
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-center text-[11px] text-slate-400">
              Tap the dates you want to take leave for, then submit.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-full border border-white/10 py-2 text-xs font-semibold text-slate-300"
                onClick={cancelLeaveMode}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="flex-1 rounded-full bg-lime-200 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50"
                onClick={submitLeave}
                disabled={!selectedDates.length || submitting}
              >
                {submitting ? 'Submitting…' : `Submit Your Leave Application${selectedDates.length ? ` (${selectedDates.length})` : ''}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AttendanceCalendar;
