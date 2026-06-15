import { Bars3Icon, ShoppingBagIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { useAuth } from '../context/AuthContext';
import { useBookingCart } from '../context/BookingCartContext';
import bowlineLogo from '../assets/bowline-logo.jpg';

const links = [
  { label: 'Treks', to: '/treks' },
  { label: 'Camps', to: '/camps' },
];

function Navbar() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { items, setIsOpen: openCart } = useBookingCart();

  const handleLogout = () => {
    logout();
    setOpen(false);
    navigate('/', { replace: true });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-lime-100/10 bg-[#0a130d]/72 backdrop-blur-xl">
      <div className="section-shell flex h-20 items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-3">
          <img src={bowlineLogo} alt="Bowline Nature Stay" className="h-14 w-auto rounded-xl" />
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
          <button
            onClick={() => openCart(true)}
            className="relative rounded-full border border-lime-100/10 p-2 text-[#d5ddd2] transition hover:text-white"
            aria-label="Open booking cart"
          >
            <ShoppingBagIcon className="h-5 w-5" />
            {items.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-lime-400 text-[10px] font-bold text-slate-900">
                {items.length}
              </span>
            )}
          </button>
          {user?.role === 'admin' ? (
            <>
              <Link className="btn-secondary" to="/admin/overview">
                Admin Panel
              </Link>
              <button className="btn-primary" onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link className="btn-secondary" to="/manage-booking">
                Manage Booking
              </Link>
              <Link className="btn-primary" to="/stays">
                Book Now
              </Link>
            </>
          )}
        </div>

        {/* Mobile: cart + hamburger grouped together on the right */}
        <div className="flex items-center gap-2 md:hidden">
          <button
            onClick={() => openCart(true)}
            className="relative flex h-11 w-11 items-center justify-center rounded-full border border-lime-100/10 text-[#d5ddd2]"
            aria-label="Open booking cart"
          >
            <ShoppingBagIcon className="h-5 w-5" />
            {items.length > 0 && (
              <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-lime-400 text-[10px] font-bold text-slate-900">
                {items.length}
              </span>
            )}
          </button>
          <button
            className="flex h-11 w-11 items-center justify-center rounded-full border border-lime-100/10 text-white"
            onClick={() => setOpen((value) => !value)}
            aria-label="Toggle menu"
          >
            {open ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="section-shell pb-4 md:hidden">
          <div className="glass rounded-3xl p-3">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `block rounded-2xl px-4 py-3.5 text-sm font-medium transition ${
                    isActive ? 'bg-white/10 text-white' : 'text-[#e0e7db] hover:bg-white/5'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
            <div className="mt-3 border-t border-white/10 pt-3">
              {user?.role === 'admin' ? (
                <div className="grid gap-2">
                  <Link
                    to="/admin/overview"
                    onClick={() => setOpen(false)}
                    className="btn-secondary w-full"
                  >
                    Admin Panel
                  </Link>
                  <button className="btn-primary w-full" onClick={handleLogout}>
                    Logout
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link className="btn-secondary" onClick={() => setOpen(false)} to="/manage-booking">
                    Manage Booking
                  </Link>
                  <Link className="btn-primary" onClick={() => setOpen(false)} to="/stays">
                    Book Now
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

export default Navbar;
