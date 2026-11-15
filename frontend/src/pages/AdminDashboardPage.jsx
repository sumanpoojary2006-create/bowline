import { useEffect } from 'react';
import UniversalCalendar from '../components/UniversalCalendar';

function AdminDashboardPage() {
  useEffect(() => {
    document.title = 'Bowline Admin | Overview';
  }, []);

  return (
    <div className="space-y-6">
      <UniversalCalendar />
    </div>
  );
}

export default AdminDashboardPage;
