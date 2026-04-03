import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { useAuth } from '../context/AuthContext';
import bowlineLogo from '../assets/bowline-logo.png';

const links = [
  { label: 'Homestays', to: '/stays' },
  { label: 'Treks', to: '/treks' },
  { label: 'Camps', to: '/camps' },
];

function Navbar() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-lime-100/10 bg-[#0a130d]/72 backdrop-blur-xl">
      <div className="section-shell flex h-20 items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-3">
          <img src={bowlineLogo} alt="Bowline" className="h-11 w-auto rounded-xl bg-white/90 p-1.5" />
          <div className="hidden sm:block">
            <p className="font-display text-2xl text-[#f5f0dd]">Bowline</p>
            <p className="text-[11px] uppercase tracking-[0.28em] text-lime-100/55">Adventure stays</p>
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
                  isActive ? 'bg-white/10 text-white' : 'text-[#d5ddd2] hover:text-white'
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
              <Link className="btn-primary" to="/stays">
                Book Now
              </Link>
            </>
          )}
        </div>

        <button
          className="rounded-full border border-lime-100/10 p-2 text-white md:hidden"
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
                className="block rounded-2xl px-4 py-3 text-sm text-[#e0e7db] hover:bg-white/5"
              >
                {link.label}
              </NavLink>
            ))}
            {user ? (
              <>
                <Link
                  to={user.role === 'admin' ? '/admin/overview' : '/dashboard'}
                  onClick={() => setOpen(false)}
                  className="block rounded-2xl px-4 py-3 text-sm text-[#e0e7db] hover:bg-white/5"
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
                <Link className="btn-primary" onClick={() => setOpen(false)} to="/stays">
                  Book Now
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
