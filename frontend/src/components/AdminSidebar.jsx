import { NavLink } from 'react-router-dom';
import clsx from 'clsx';

const groups = [
  {
    label: 'General',
    items: [{ label: 'Overview', to: '/admin/overview' }],
  },
  {
    label: 'Bookings',
    items: [
      { label: 'Listings', to: '/admin/listings' },
      { label: 'Bookings', to: '/admin/bookings' },
      { label: 'Room Calendar', to: '/admin/calendar' },
      { label: 'Pricing', to: '/admin/pricing' },
      { label: 'Coupons', to: '/admin/coupons' },
    ],
  },
  {
    label: 'Data',
    items: [
      { label: 'Reports', to: '/admin/reports' },
      { label: 'Sheets Sync', to: '/admin/sync' },
      { label: 'Users', to: '/admin/users' },
    ],
  },
  {
    label: 'Staff',
    items: [
      { label: 'Employees', to: '/admin/employees' },
      { label: 'Attendance', to: '/admin/attendance' },
      { label: 'Checklists', to: '/admin/checklists' },
      { label: 'Employee Settings', to: '/admin/employee-settings' },
    ],
  },
];

function AdminSidebar() {
  return (
    <aside className="glass h-fit rounded-[2rem] p-4">
      <p className="px-3 pb-4 text-xs font-semibold uppercase tracking-[0.3em] text-lime-100/60">Bowline Admin</p>
      <nav className="space-y-5">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-2 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-[#7c8a76]">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    clsx(
                      'block rounded-2xl px-4 py-3 text-sm font-medium transition',
                      isActive ? 'bg-lime-200 text-slate-950' : 'text-[#c3cebf] hover:bg-white/5 hover:text-white'
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}

export default AdminSidebar;
