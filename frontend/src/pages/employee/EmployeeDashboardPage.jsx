import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';
import employeeApi from '../../lib/employeeApi';
import { useEmployeeAuth } from '../../context/EmployeeAuthContext';
import PageLoader from '../../components/PageLoader';
import AttendanceCalendar from '../../components/employee/AttendanceCalendar';

const MIN_SHIFT_HOURS = 5;
const ROLE_LABELS = {
  housekeeping: 'Housekeeping',
  kitchen: 'Kitchen Assistant',
};

function useNow(intervalMs) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}

function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function StatusRing({ progress, children, tone = 'lime' }) {
  const radius = 110;
  const stroke = 10;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const clamped = Math.min(1, Math.max(0, progress));
  const offset = circumference - clamped * circumference;

  const colors = {
    lime: '#bef264',
    amber: '#fcd34d',
    slate: '#475569',
  };

  return (
    <div className="relative mx-auto flex h-[220px] w-[220px] items-center justify-center">
      <svg height={radius * 2} width={radius * 2} className="pointer-events-none absolute -rotate-90">
        <circle
          stroke="rgba(255,255,255,0.08)"
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        <circle
          stroke={colors[tone]}
          fill="transparent"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="flex flex-col items-center text-center">{children}</div>
    </div>
  );
}

function LeavePieChart({ score }) {
  const value = score != null ? Math.max(0, Math.min(100, score)) : 100;
  const radius = 38;
  const stroke = 10;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;
  const color = value >= 100 ? '#bef264' : value > 0 ? '#fcd34d' : '#fb7185';

  return (
    <div className="relative mx-auto mt-2 flex h-[92px] w-[92px] items-center justify-center">
      <svg height={radius * 2} width={radius * 2} className="pointer-events-none absolute -rotate-90">
        <circle stroke="rgba(255,255,255,0.08)" fill="transparent" strokeWidth={stroke} r={normalizedRadius} cx={radius} cy={radius} />
        <circle
          stroke={color}
          fill="transparent"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <span className="text-lg font-bold text-white">{Math.round(value)}%</span>
    </div>
  );
}

function TodaysTasks({ employee, todayTasks }) {
  const laundryDone = Boolean(todayTasks?.laundryDone);

  return (
    <div className="mt-6">
      <p className="text-xs uppercase tracking-[0.25em] text-lime-200/60">Today's To-Do List</p>
      <Link
        to="/employee/laundry"
        className="mt-3 flex items-center justify-between rounded-[1.5rem] bg-slate-900/70 p-4"
      >
        <div>
          <p className="text-sm font-semibold text-white">Laundry dashboard</p>
          <p className="mt-1 text-xs text-slate-400">
            {laundryDone ? "Today's laundry list is submitted" : "Upload today's laundry list"}
          </p>
        </div>
        <span className={laundryDone ? 'text-lime-200' : 'text-slate-400'}>{laundryDone ? '✓' : '→'}</span>
      </Link>
      {employee?.role === 'kitchen' ? (
        <div className="mt-3 rounded-[1.5rem] bg-slate-900/40 p-4 text-sm text-slate-500">
          Kitchen checklist — coming soon
        </div>
      ) : null}
    </div>
  );
}

function EmployeeDashboardPage() {
  const { employee, summary, refresh, logout, loading } = useEmployeeAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const now = useNow(30000);

  useEffect(() => {
    document.title = 'Bowline Staff';
  }, []);

  const checkInTime = summary?.today?.checkInAt ? new Date(summary.today.checkInAt) : null;
  const elapsedHours = checkInTime ? (now - checkInTime.getTime()) / (1000 * 60 * 60) : 0;
  const remainingMinutes = checkInTime ? Math.max(0, Math.ceil((MIN_SHIFT_HOURS - elapsedHours) * 60)) : 0;
  const canCheckOut = checkInTime && elapsedHours >= MIN_SHIFT_HOURS;
  const tasksComplete = !summary?.todayTasks || !summary.todayTasks.laundryRequired || summary.todayTasks.laundryDone;

  const handleCheckIn = async () => {
    setBusy(true);
    try {
      await employeeApi.post('/employee/checkin');
      toast.success('Checked in! Have a great shift.');
      await refresh();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to check in');
    } finally {
      setBusy(false);
    }
  };

  const attendanceLabel = useMemo(() => {
    if (!summary?.attendanceSummary) return '—';
    const { daysPresent, daysInPeriod } = summary.attendanceSummary;
    return `${daysPresent}/${daysInPeriod}`;
  }, [summary]);

  if (loading) {
    return <PageLoader label="Loading your dashboard..." />;
  }

  const status = summary?.today?.status;
  const isOnLeaveToday = Boolean(summary?.isOnLeaveToday);
  const checkedIn = Boolean(status) && !isOnLeaveToday;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-sm flex-col px-5 pb-10 pt-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-lime-200/70">
            {ROLE_LABELS[employee?.role] || employee?.role}
          </p>
          <h1 className="mt-1 font-display text-2xl text-white">Hi, {employee?.name?.split(' ')[0] || ''}</h1>
        </div>
        <button
          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-300"
          onClick={logout}
        >
          Log out
        </button>
      </header>

      {checkedIn ? (
        <div className="mt-6">
          <AttendanceCalendar />
        </div>
      ) : null}

      <div className={`flex flex-1 flex-col items-center justify-center ${checkedIn ? 'mt-8' : 'mt-10'}`}>
        {isOnLeaveToday ? (
          <>
            <StatusRing progress={1} tone="slate">
              <span className="text-4xl">🌴</span>
              <span className="mt-2 text-sm font-semibold uppercase tracking-wide text-slate-300">On leave today</span>
            </StatusRing>
            <p className="mt-6 max-w-xs text-center text-sm text-slate-400">
              You applied for leave today, so check-in is disabled. See you on your next shift!
            </p>
          </>
        ) : !status ? (
          <>
            <StatusRing progress={0} tone="lime">
              <button
                className="flex h-[170px] w-[170px] flex-col items-center justify-center rounded-full bg-gradient-to-br from-lime-200 to-lime-400 text-slate-950 shadow-glow transition active:scale-95 disabled:opacity-60"
                disabled={busy}
                onClick={handleCheckIn}
              >
                <span className="text-lg font-bold uppercase tracking-wide">{busy ? '...' : 'Check In'}</span>
                <span className="mt-1 text-xs font-medium opacity-70">Tap to start shift</span>
              </button>
            </StatusRing>
          </>
        ) : status === 'checked-in' ? (
          canCheckOut ? (
            tasksComplete ? (
              <>
                <StatusRing progress={1} tone="lime">
                  <button
                    className="flex h-[170px] w-[170px] flex-col items-center justify-center rounded-full bg-gradient-to-br from-lime-200 to-lime-400 text-slate-950 shadow-glow transition active:scale-95"
                    onClick={() => navigate('/employee/checkout')}
                  >
                    <span className="text-lg font-bold uppercase tracking-wide">Check Out</span>
                    <span className="mt-1 text-xs font-medium opacity-70">Shift complete</span>
                  </button>
                </StatusRing>
                <p className="mt-6 text-center text-sm text-slate-400">
                  Checked in at {checkInTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Fill out
                  the checklist to finish.
                </p>
              </>
            ) : (
              <>
                <StatusRing progress={1} tone="amber">
                  <span className="text-3xl">📝</span>
                  <span className="mt-2 text-sm font-semibold uppercase tracking-wide text-amber-200/80">
                    Finish your tasks
                  </span>
                </StatusRing>
                <p className="mt-6 max-w-xs text-center text-sm text-slate-400">
                  Complete today's laundry dashboard below before you can check out.
                </p>
              </>
            )
          ) : (
            <>
              <StatusRing progress={elapsedHours / MIN_SHIFT_HOURS} tone="amber">
                <span className="text-3xl font-bold text-white">{formatDuration(remainingMinutes)}</span>
                <span className="mt-1 text-xs font-medium uppercase tracking-wide text-amber-200/80">
                  until check out
                </span>
              </StatusRing>
              <p className="mt-6 text-center text-sm text-slate-400">
                On shift since {checkInTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • min{' '}
                {MIN_SHIFT_HOURS}h shift
              </p>
            </>
          )
        ) : (
          <>
            <StatusRing progress={1} tone="slate">
              <span className="text-4xl">✓</span>
              <span className="mt-2 text-sm font-semibold uppercase tracking-wide text-slate-300">Done for today</span>
            </StatusRing>
            <p className="mt-6 text-center text-sm text-slate-400">
              Checked out at{' '}
              {summary?.today?.checkOutAt
                ? new Date(summary.today.checkOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '—'}
              . See you tomorrow!
            </p>
          </>
        )}
      </div>

      {checkedIn ? <TodaysTasks employee={employee} todayTasks={summary?.todayTasks} /> : null}

      <div className="mt-8 grid grid-cols-2 gap-4">
        <div className="glass rounded-[1.5rem] p-4 text-center">
          <p className="text-xs uppercase tracking-[0.25em] text-lime-200/60">Attendance</p>
          <p className="mt-2 text-2xl font-bold text-white">{attendanceLabel}</p>
          <p className="text-xs text-slate-400">days this month</p>
        </div>
        <div className="glass rounded-[1.5rem] p-4 text-center">
          <p className="text-xs uppercase tracking-[0.25em] text-lime-200/60">Leave usage</p>
          <LeavePieChart score={summary?.leaveScore} />
          <p className="mt-2 text-xs text-slate-400">
            {summary?.leaveAllowance != null ? `${summary.leaveAllowance} leaves/month allowed` : 'this month'}
          </p>
        </div>
      </div>
    </div>
  );
}

export default EmployeeDashboardPage;
