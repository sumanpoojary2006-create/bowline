import { NavLink } from 'react-router-dom';
import clsx from 'clsx';

const items = [
  { label: 'Overview', to: '/admin/overview' },
  { label: 'Listings', to: '/admin/listings' },
  { label: 'Bookings', to: '/admin/bookings' },
  { label: 'Users', to: '/admin/users' },
  { label: 'Pricing', to: '/admin/pricing' },
];

function AdminSidebar() {
  return (
    <aside className="glass h-fit rounded-[2rem] p-4">
      <p className="px-3 pb-4 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Bowline Admin</p>
      <nav className="space-y-2">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              clsx(
                'block rounded-2xl px-4 py-3 text-sm font-medium transition',
                isActive ? 'bg-amber-300 text-slate-950' : 'text-slate-300 hover:bg-white/5 hover:text-white'
              )
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

export default AdminSidebar;
