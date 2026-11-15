import HostReservations from '../components/HostReservations';
import UniversalCalendar from '../components/UniversalCalendar';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../lib/api';

function AdminDashboardPage() {
  useEffect(() => {
    document.title = 'Bowline Admin | Overview';
  }, []);

  const [syncing, setSyncing] = useState(false);

  const syncAllAirbnb = async () => {
    setSyncing(true);
    try {
      const { data } = await api.post('/sync/airbnb');
      const results = data.results || [];
      const created = results.reduce((s, r) => s + (r.created || 0), 0);
      const cancelled = results.reduce((s, r) => s + (r.cancelled || 0), 0);
      const errors = results.flatMap((r) => r.errors || []);
      const needsReview = results.flatMap((r) => r.needsReview || []);
      if (errors.length) {
        toast.error(`Sync done with errors: ${errors[0]}`);
      } else {
        toast.success(`Airbnb synced — ${created} new block${created !== 1 ? 's' : ''}, ${cancelled} released`);
      }
      if (needsReview.length) {
        const dates = needsReview.map((d) => `${d.startDate}→${d.endDate}`).join(', ');
        toast(
          `Full House calendar shows unavailable on ${needsReview.length} date${needsReview.length !== 1 ? 's' : ''} with no matching guest name across rooms — not auto-blocked, check manually: ${dates}`,
          { duration: 10000 }
        );
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Airbnb sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const syncButton = (
    <button
      className="host-outline-button host-sync-button flex shrink-0 items-center gap-2"
      onClick={syncAllAirbnb}
      disabled={syncing}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582M20 20v-5h-.581M5.635 15A9 9 0 104.582 9H4" />
      </svg>
      {syncing ? 'Syncing…' : 'Sync Airbnb'}
    </button>
  );

  return (
    <div className="space-y-6">
      <HostReservations syncButton={syncButton} />
      <UniversalCalendar />
    </div>
  );
}

export default AdminDashboardPage;
