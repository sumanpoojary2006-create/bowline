import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import employeeApi from '../../lib/employeeApi';
import { useEmployeeAuth } from '../../context/EmployeeAuthContext';
import SectionHeader from '../../components/SectionHeader';
import PageLoader from '../../components/PageLoader';

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

function EmployeeDashboardPage() {
  const { employee, summary, refresh, logout, loading } = useEmployeeAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const now = useNow(30000);

  useEffect(() => {
    document.title = 'Bowline Staff | Dashboard';
  }, []);

  const checkInTime = summary?.today?.checkInAt ? new Date(summary.today.checkInAt) : null;
  const elapsedHours = checkInTime ? (now - checkInTime.getTime()) / (1000 * 60 * 60) : 0;
  const remainingMinutes = checkInTime ? Math.max(0, Math.ceil((MIN_SHIFT_HOURS - elapsedHours) * 60)) : 0;
  const canCheckOut = checkInTime && elapsedHours >= MIN_SHIFT_HOURS;

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
    return `${daysPresent} / ${daysInPeriod} days logged in`;
  }, [summary]);

  if (loading) {
    return <PageLoader label="Loading your dashboard..." />;
  }

  const status = summary?.today?.status;

  return (
    <section className="section-shell py-8 sm:py-12">
      <SectionHeader
        eyebrow="Staff Portal"
        title={`Hi, ${employee?.name?.split(' ')[0] || ''}`}
        description={ROLE_LABELS[employee?.role] || employee?.role}
        action={
          <button className="btn-secondary" onClick={logout}>
            Log out
          </button>
        }
      />

      <div className="grid gap-6 md:grid-cols-3">
        <div className="glass rounded-[2rem] p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-lime-200/70">Attendance (last 30 days)</p>
          <p className="mt-3 text-3xl font-semibold text-white">{attendanceLabel}</p>
        </div>
        <div className="glass rounded-[2rem] p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-lime-200/70">Overall score</p>
          <p className="mt-3 text-3xl font-semibold text-white">
            {summary?.score != null ? `${summary.score} / 100` : 'No data yet'}
          </p>
        </div>
        <div className="glass rounded-[2rem] p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-lime-200/70">Today</p>
          <p className="mt-3 text-lg font-semibold text-white">
            {status === 'checked-out'
              ? 'Shift completed'
              : status === 'checked-in'
                ? 'Checked in'
                : 'Not checked in yet'}
          </p>
          {checkInTime ? (
            <p className="mt-1 text-sm text-slate-300">
              Checked in at {checkInTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-6 glass rounded-[2rem] p-6 sm:p-8">
        {!status ? (
          <div>
            <h3 className="text-xl font-semibold text-white">Ready to start your shift?</h3>
            <p className="mt-2 text-sm text-slate-300">
              Make sure you're connected to the homestay WiFi before checking in.
            </p>
            <button className="btn-primary mt-4" disabled={busy} onClick={handleCheckIn}>
              {busy ? 'Checking in...' : 'Check In'}
            </button>
          </div>
        ) : status === 'checked-in' ? (
          <div>
            <h3 className="text-xl font-semibold text-white">Shift in progress</h3>
            {canCheckOut ? (
              <>
                <p className="mt-2 text-sm text-slate-300">
                  You've completed the minimum {MIN_SHIFT_HOURS}-hour shift. Fill out the end-of-shift checklist to
                  check out.
                </p>
                <button className="btn-primary mt-4" onClick={() => navigate('/employee/checkout')}>
                  Check Out
                </button>
              </>
            ) : (
              <p className="mt-2 text-sm text-slate-300">
                You can check out in {remainingMinutes} minute(s) (minimum {MIN_SHIFT_HOURS}-hour shift).
              </p>
            )}
          </div>
        ) : (
          <div>
            <h3 className="text-xl font-semibold text-white">All done for today</h3>
            <p className="mt-2 text-sm text-slate-300">
              You checked out at{' '}
              {summary?.today?.checkOutAt
                ? new Date(summary.today.checkOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '—'}
              . See you tomorrow!
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

export default EmployeeDashboardPage;
