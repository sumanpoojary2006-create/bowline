import { useEffect, useState } from 'react';
import api from '../lib/api';
import PageLoader from '../components/PageLoader';
import SectionHeader from '../components/SectionHeader';

function formatTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function AdminAttendancePage() {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Bowline Admin | Attendance';

    const fetchAttendance = async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/admin/attendance');
        setAttendance(data.attendance);
      } finally {
        setLoading(false);
      }
    };

    fetchAttendance();
  }, []);

  if (loading) {
    return <PageLoader label="Loading attendance..." />;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Staff Management"
        title="Attendance"
        description="Daily check-in and check-out records for all employees."
      />

      <div className="glass overflow-x-auto rounded-[2rem] p-6">
        <table className="w-full min-w-[640px] text-left text-sm text-slate-200">
          <thead className="text-xs uppercase tracking-[0.25em] text-lime-200/70">
            <tr>
              <th className="pb-3">Date</th>
              <th className="pb-3">Employee</th>
              <th className="pb-3">Role</th>
              <th className="pb-3">Check-in</th>
              <th className="pb-3">Check-out</th>
              <th className="pb-3">Status</th>
              <th className="pb-3">Score</th>
            </tr>
          </thead>
          <tbody>
            {attendance.length === 0 ? (
              <tr>
                <td className="py-4 text-slate-400" colSpan={7}>
                  No attendance records yet.
                </td>
              </tr>
            ) : (
              attendance.map((record) => (
                <tr key={record._id} className="border-t border-white/5">
                  <td className="py-3">{record.date}</td>
                  <td className="py-3">{record.employee?.name}</td>
                  <td className="py-3 capitalize">{record.employee?.role}</td>
                  <td className="py-3">{formatTime(record.checkInAt)}</td>
                  <td className="py-3">{formatTime(record.checkOutAt)}</td>
                  <td className="py-3 capitalize">{record.status.replace('-', ' ')}</td>
                  <td className="py-3">{record.score != null ? `${record.score} / 100` : '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AdminAttendancePage;
