import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import employeeApi from '../../lib/employeeApi';

const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const STATUS_STYLES = {
  full: 'bg-emerald-800/90 text-white',
  partial: 'bg-emerald-300/80 text-slate-950',
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

function AttendanceCalendar() {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);

  const today = todayKey();
  const key = monthKey(cursor.year, cursor.month);

  useEffect(() => {
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

    fetchCalendar();
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
          const dayNum = Number(date.slice(-2));

          let classes = 'flex h-9 items-center justify-center rounded-lg text-xs font-semibold';
          if (status && STATUS_STYLES[status]) {
            classes += ` ${STATUS_STYLES[status]}`;
          } else {
            classes += ' bg-white/5 text-slate-500';
          }
          if (date === today) classes += ' outline outline-1 outline-lime-200/70';

          return (
            <div key={date} className={classes}>
              {dayNum}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-3 text-[11px] text-slate-400">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-800" /> Full day</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-300" /> Half day</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Leave / absent</span>
      </div>

      {loading ? (
        <p className="mt-3 text-center text-xs text-slate-500">Loading…</p>
      ) : null}
    </div>
  );
}

export default AttendanceCalendar;
