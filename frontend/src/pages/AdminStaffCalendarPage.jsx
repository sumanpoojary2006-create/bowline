import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import PageLoader from '../components/PageLoader';
import SectionHeader from '../components/SectionHeader';

const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const STATUS_STYLES = {
  full: 'bg-emerald-800/90 text-white',
  partial: 'bg-emerald-300/80 text-slate-950',
  leave: 'bg-rose-500/80 text-white',
  absent: 'bg-rose-500/80 text-white',
};

const ACTIONS = [
  { status: 'full', label: 'Full Day' },
  { status: 'half', label: 'Half Day' },
  { status: 'absent', label: 'Mark Absent' },
  { status: 'leave', label: 'Mark On Leave' },
];

function monthKey(year, month) {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function AdminStaffCalendarPage() {
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [employeeId, setEmployeeId] = useState('');
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [days, setDays] = useState([]);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [selectedDates, setSelectedDates] = useState([]);
  const [saving, setSaving] = useState(false);

  const key = monthKey(cursor.year, cursor.month);

  useEffect(() => {
    document.title = 'Bowline Admin | Staff Calendar';

    const fetchEmployees = async () => {
      setLoadingEmployees(true);
      try {
        const { data } = await api.get('/admin/employees');
        setEmployees(data.employees);
        if (data.employees.length) setEmployeeId(data.employees[0].id);
      } finally {
        setLoadingEmployees(false);
      }
    };

    fetchEmployees();
  }, []);

  useEffect(() => {
    if (!employeeId) return;
    setSelectedDates([]);

    const fetchCalendar = async () => {
      setLoadingCalendar(true);
      try {
        const { data } = await api.get(`/admin/employees/${employeeId}/attendance-calendar`, {
          params: { month: key },
        });
        setDays(data.days);
      } catch {
        toast.error('Unable to load attendance calendar');
      } finally {
        setLoadingCalendar(false);
      }
    };

    fetchCalendar();
  }, [employeeId, key]);

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

  const toggleDate = (date) => {
    setSelectedDates((prev) => (prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date]));
  };

  const applyStatus = async (status) => {
    if (!selectedDates.length) return;
    setSaving(true);
    try {
      let result;
      for (const date of selectedDates) {
        // eslint-disable-next-line no-await-in-loop
        const { data } = await api.post(`/admin/employees/${employeeId}/attendance`, { date, status });
        result = data;
      }
      if (result) setDays(result.days);
      setSelectedDates([]);
      toast.success(`Marked ${selectedDates.length} date(s) as ${ACTIONS.find((a) => a.status === status).label}`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to update attendance');
    } finally {
      setSaving(false);
    }
  };

  const selectedEmployee = employees.find((e) => e.id === employeeId);

  if (loadingEmployees) {
    return <PageLoader label="Loading employees..." />;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Staff Management"
        title="Staff Calendar"
        description="View a staff member's attendance and mark full/half days, absences, or leave."
      />

      <div className="glass max-w-sm rounded-[2rem] p-6">
        <label className="label">Employee</label>
        <select className="input" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name} ({employee.role})
            </option>
          ))}
        </select>
      </div>

      {!employeeId ? (
        <p className="text-sm text-slate-400">No employees yet.</p>
      ) : (
        <div className="glass max-w-xl rounded-[2rem] p-6">
          <div className="flex items-center justify-between">
            <button
              type="button"
              className="rounded-full border border-white/10 px-3 py-1 text-sm text-slate-300"
              onClick={() => changeMonth(-1)}
            >
              ‹
            </button>
            <div className="text-center">
              <p className="text-xs uppercase tracking-[0.25em] text-lime-200/60">{selectedEmployee?.name}</p>
              <p className="text-lg font-semibold text-white">
                {new Date(cursor.year, cursor.month, 1).toLocaleDateString('en-IN', {
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
            <button
              type="button"
              className="rounded-full border border-white/10 px-3 py-1 text-sm text-slate-300"
              onClick={() => changeMonth(1)}
            >
              ›
            </button>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-1.5">
            {DAY_NAMES.map((d) => (
              <div key={d} className="py-1 text-center text-[11px] font-semibold uppercase text-slate-500">
                {d}
              </div>
            ))}
            {cells.map((date, idx) => {
              if (!date) return <div key={`empty-${idx}`} />;
              const status = statusByDate.get(date);
              const selected = selectedDates.includes(date);
              const dayNum = Number(date.slice(-2));

              let classes = 'flex h-11 items-center justify-center rounded-lg text-sm font-semibold transition cursor-pointer';
              if (selected) {
                classes += ' bg-sky-400 text-slate-950 ring-2 ring-sky-200';
              } else if (status && STATUS_STYLES[status]) {
                classes += ` ${STATUS_STYLES[status]}`;
              } else {
                classes += ' bg-white/10 text-slate-300 hover:bg-white/20';
              }

              return (
                <button key={date} type="button" onClick={() => toggleDate(date)} className={classes}>
                  {dayNum}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-center gap-3 text-[11px] text-slate-400">
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-800" /> Full day</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-300" /> Half day</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Leave / absent</span>
          </div>

          {loadingCalendar ? <p className="mt-3 text-center text-xs text-slate-500">Loading…</p> : null}

          <div className="mt-5 border-t border-white/10 pt-4">
            {selectedDates.length === 0 ? (
              <p className="text-center text-xs text-slate-500">Tap one or more dates to mark attendance or leave.</p>
            ) : (
              <>
                <p className="text-center text-xs text-slate-400">
                  {selectedDates.length} date{selectedDates.length > 1 ? 's' : ''} selected
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {ACTIONS.map((action) => (
                    <button
                      key={action.status}
                      type="button"
                      disabled={saving}
                      onClick={() => applyStatus(action.status)}
                      className="rounded-xl bg-white/5 py-2 text-xs font-semibold text-lime-200 disabled:opacity-50"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="mt-2 w-full text-center text-xs text-slate-400 underline"
                  onClick={() => setSelectedDates([])}
                  disabled={saving}
                >
                  Clear selection
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminStaffCalendarPage;
