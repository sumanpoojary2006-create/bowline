import { Outlet } from 'react-router-dom';
import AdminSidebar from '../components/AdminSidebar';
import Navbar from '../components/Navbar';

function AdminLayout() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="section-shell grid gap-6 py-10 lg:grid-cols-[280px_minmax(0,1fr)]">
        <AdminSidebar />
        <div className="space-y-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default AdminLayout;
