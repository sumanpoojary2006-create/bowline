import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { BookmarkIcon, CalendarDaysIcon, Square2StackIcon, QueueListIcon, Bars3Icon, ArrowUpRightIcon, XMarkIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import AdminSidebar from '../components/AdminSidebar';
import bowlineLogo from '../assets/bowline-logo.png';
import '../admin.css';

const tabs = [
  ['Today', '/admin/overview', BookmarkIcon, 'Today'],
  ['Calendar', '/admin/calendar', CalendarDaysIcon, 'Calendar'],
  ['Listings', '/admin/listings', Square2StackIcon, 'Listings'],
  ['Reservations', '/admin/bookings', QueueListIcon, 'Bookings'],
  ['Staff Calendar', '/admin/staff-calendar', UserGroupIcon, 'Staff'],
];
const sectionNames = {
  overview: 'Today', calendar: 'Calendar', listings: 'Listings', bookings: 'Reservations',
  reservations: "Today's stays", 'block-rooms': 'Block rooms', pricing: 'Pricing', coupons: 'Coupons',
  reports: 'Reports', performance: 'Performance',
  sync: 'Calendar sync', users: 'Customers', employees: 'Employees', attendance: 'Attendance',
  'staff-calendar': 'Staff calendar', laundry: 'Laundry', checklists: 'Checklists',
  'checklist-editor': 'Checklist editor', faqs: 'Website FAQs',
};
export default function AdminLayout() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const menuRef = useRef(null);
  useEffect(() => { setMenuOpen(false); window.scrollTo(0, 0); }, [location.pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const controls = () => Array.from(menuRef.current?.querySelectorAll('button, a[href]') || []);
    controls()[0]?.focus();
    const close = (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
      if (event.key === 'Tab') {
        const elements = controls();
        const first = elements[0]; const last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('keydown', close);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [menuOpen]);
  const secondary = !tabs.some(([, path]) => location.pathname === path);
  const sectionName = sectionNames[location.pathname.split('/').filter(Boolean).at(-1)] || 'Hosting';
  return <div className="admin-workspace">
    <a className="admin-skip" href="#admin-content">Skip to content</a>
    <header className="host-header">
      <Link className="host-brand" to="/admin/overview"><img src={bowlineLogo} alt="" /><span><strong>Bowline</strong><span className="host-brand-caption">HOSTING</span></span></Link>
      <nav className="host-nav" aria-label="Hosting navigation">
        {tabs.map(([label, to, Icon, mobileLabel]) => <NavLink key={to} to={to} aria-label={label} className={({ isActive }) => `host-nav-item ${isActive ? 'is-active' : ''}`}><Icon /><span className="host-nav-label host-nav-label-desktop">{label}</span><span className="host-nav-label host-nav-label-mobile">{mobileLabel}</span></NavLink>)}
        <button className={`host-nav-item ${menuOpen || secondary ? 'is-active' : ''}`} aria-expanded={menuOpen} aria-controls="host-menu" onClick={() => setMenuOpen(!menuOpen)}><Bars3Icon /><span>Menu</span></button>
      </nav>
      <div className="host-account"><span className="host-current-section">{sectionName}</span><Link to="/" className="host-website">View website <ArrowUpRightIcon /></Link><button className="host-avatar" title={`${user?.name || 'Admin'} · Open menu`} aria-label="Open admin menu" onClick={() => setMenuOpen(true)}>{user?.name?.charAt(0) || 'B'}</button></div>
    </header>
    {menuOpen && <div className="host-menu-backdrop" onClick={() => setMenuOpen(false)}><section ref={menuRef} role="dialog" aria-modal="true" id="host-menu" className="host-menu" aria-label="All hosting tools" onClick={e => e.stopPropagation()}><div className="host-menu-heading"><div><p className="host-eyebrow">YOUR WORKSPACE</p><h2>Everything for your stay.</h2></div><button className="host-icon-button" aria-label="Close menu" onClick={() => setMenuOpen(false)}><XMarkIcon /></button></div><AdminSidebar /><div className="host-menu-footer"><Link to="/">View guest website ↗</Link><button onClick={logout}>Log out</button></div></section></div>}
    {import.meta.env.DEV && import.meta.env.VITE_ADMIN_PREVIEW === 'true' && <div className="host-preview-banner">DESIGN PREVIEW · Sample data · Changes stay in this session</div>}
    <main id="admin-content" className="host-content"><Outlet /></main>
    <footer className="host-footer"><span>Bowline Nature Stay</span><span>Mudigere · A little closer to nature.</span></footer>
  </div>;
}
