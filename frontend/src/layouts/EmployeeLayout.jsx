import { Link, Outlet } from 'react-router-dom';

function EmployeeLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">
        <nav className="p-4 text-right"><Link to="/employee/laundry" className="text-sm font-semibold underline">Laundry dashboard</Link></nav>
        <Outlet />
      </main>
    </div>
  );
}

export default EmployeeLayout;
