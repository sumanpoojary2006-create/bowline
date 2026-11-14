import { Bars3Icon, ShoppingBagIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBookingCart } from '../context/BookingCartContext';
import bowlineLogo from '../assets/bowline-logo.jpg';

const homeLinks = [
  { label: 'Stay', to: '/#stay' },
  { label: 'About', to: '/#about' },
  { label: 'Experiences', to: '/#experiences' },
  { label: 'FAQs', to: '/#faqs' },
];

const bookingLinks = [
  { label: 'Home', to: '/' },
  { label: 'Treks', to: '/treks' },
  { label: 'Camps', to: '/camps' },
];

function Navbar() {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { items, setIsOpen: openCart } = useBookingCart();
  const isHome = location.pathname === '/';
  const links = isHome ? homeLinks : bookingLinks;

  const handleLogout = () => {
    logout();
    setOpen(false);
    navigate('/', { replace: true });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-lime-100/10 bg-[#07100a]/95 backdrop-blur-xl">
      <div className="section-shell flex h-[4.5rem] items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-3">
          <img src={bowlineLogo} alt="Bowline Nature Stay" className="h-11 w-auto rounded-lg" />
        </Link>

        <nav className="hidden items-center gap-2 md:flex">
          {links.map((link) =>
            isHome ? (
              <a
                key={link.to}
                href={link.to.slice(1)}
                className="rounded-full px-4 py-2 text-sm font-medium text-[#d5ddd2] transition hover:bg-white/5 hover:text-white"
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.to}
                to={link.to}
                className="rounded-full px-4 py-2 text-sm font-medium text-[#d5ddd2] transition hover:bg-white/5 hover:text-white"
              >
                {link.label}
              </Link>
            )
          )}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {!isHome && <button
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
          </button>}
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
              <Link className="btn-primary" to={isHome ? '/stays' : '/manage-booking'}>
                {isHome ? 'View rooms' : 'Manage Booking'}
              </Link>
            </>
          )}
        </div>

        {/* Mobile: cart + hamburger grouped together on the right */}
        <div className="flex items-center gap-2 md:hidden">
          {!isHome && <button
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
          </button>}
          <button
            className="flex h-11 w-11 items-center justify-center rounded-full border border-lime-100/10 text-white"
            onClick={() => setOpen((value) => !value)}
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={open ? 'close' : 'menu'}
                initial={reduceMotion ? false : { opacity: 0, rotate: -18, scale: 0.82 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={reduceMotion ? undefined : { opacity: 0, rotate: 18, scale: 0.82 }}
                transition={{ duration: reduceMotion ? 0 : 0.16, ease: [0.22, 1, 0.36, 1] }}
              >
                {open ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
      {open && (
        <motion.div
          className="section-shell origin-top pb-4 md:hidden"
          initial={reduceMotion ? false : { opacity: 0, height: 0, y: -8 }}
          animate={{ opacity: 1, height: 'auto', y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, height: 0, y: -6 }}
          transition={{ duration: reduceMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.div
            className="glass rounded-3xl p-3"
            initial={reduceMotion ? false : { scale: 0.98 }}
            animate={{ scale: 1 }}
            transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {links.map((link) =>
              isHome ? (
                <a
                  key={link.to}
                  href={link.to.slice(1)}
                  onClick={() => setOpen(false)}
                  className="block rounded-2xl px-4 py-3.5 text-sm font-medium text-[#e0e7db] transition hover:bg-white/5"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setOpen(false)}
                  className="block rounded-2xl px-4 py-3.5 text-sm font-medium text-[#e0e7db] transition hover:bg-white/5"
                >
                  {link.label}
                </Link>
              )
            )}
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
                <div className="grid grid-cols-1 gap-2">
                  <Link className="btn-primary w-full" onClick={() => setOpen(false)} to={isHome ? '/stays' : '/manage-booking'}>
                    {isHome ? 'View rooms & availability' : 'Manage Booking'}
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </header>
  );
}

export default Navbar;
