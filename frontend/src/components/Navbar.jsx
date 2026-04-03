import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { useAuth } from '../context/AuthContext';

const links = [
  { label: 'Stays', to: '/stays' },
  { label: 'Treks', to: '/treks' },
  { label: 'Camps', to: '/camps' },
];

function Navbar() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
      <div className="section-shell flex h-20 items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-300 text-lg font-black text-slate-950">
            B
          </div>
          <div>
            <p className="font-display text-2xl text-white">Bowline</p>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Adventure stays</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-2 md:flex">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                clsx(
                  'rounded-full px-4 py-2 text-sm font-medium transition',
                  isActive ? 'bg-white/10 text-white' : 'text-slate-300 hover:text-white'
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <>
              <Link className="btn-secondary" to={user.role === 'admin' ? '/admin/overview' : '/dashboard'}>
                {user.role === 'admin' ? 'Admin Panel' : 'My Dashboard'}
              </Link>
              <button className="btn-primary" onClick={logout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link className="btn-secondary" to="/login">
                Login
              </Link>
              <Link className="btn-primary" to="/signup">
                Start Exploring
              </Link>
            </>
          )}
        </div>

        <button
          className="rounded-full border border-white/10 p-2 text-white md:hidden"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="section-shell pb-5 md:hidden">
          <div className="glass space-y-3 rounded-3xl p-4">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={() => setOpen(false)}
                className="block rounded-2xl px-4 py-3 text-sm text-slate-200 hover:bg-white/5"
              >
                {link.label}
              </NavLink>
            ))}
            {user ? (
              <>
                <Link
                  to={user.role === 'admin' ? '/admin/overview' : '/dashboard'}
                  onClick={() => setOpen(false)}
                  className="block rounded-2xl px-4 py-3 text-sm text-slate-200 hover:bg-white/5"
                >
                  Dashboard
                </Link>
                <button className="btn-primary w-full" onClick={logout}>
                  Logout
                </button>
              </>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <Link className="btn-secondary" onClick={() => setOpen(false)} to="/login">
                  Login
                </Link>
                <Link className="btn-primary" onClick={() => setOpen(false)} to="/signup">
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

export default Navbar;
