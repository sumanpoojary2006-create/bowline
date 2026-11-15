import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import {
  ArchiveBoxIcon,
  BanknotesIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  CheckBadgeIcon,
  ClipboardDocumentCheckIcon,
  ClockIcon,
  ArrowPathRoundedSquareIcon,
  DocumentTextIcon,
  GiftIcon,
  HomeModernIcon,
  PresentationChartLineIcon,
  QuestionMarkCircleIcon,
  Squares2X2Icon,
  UserGroupIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';

export const groups = [
  {
    label: 'General',
    items: [
      { label: 'Overview', to: '/admin/overview', icon: Squares2X2Icon },
      { label: 'Website FAQs', to: '/admin/faqs', icon: QuestionMarkCircleIcon },
    ],
  },
  {
    label: 'Bookings',
    items: [
      { label: "Today's Stays", to: '/admin/reservations', icon: ClockIcon },
      { label: 'Listings', to: '/admin/listings', icon: HomeModernIcon },
      { label: 'Block Rooms', to: '/admin/block-rooms', icon: ArchiveBoxIcon },
      { label: 'Bookings', to: '/admin/bookings', icon: DocumentTextIcon },
      { label: 'Room Calendar', to: '/admin/calendar', icon: CalendarDaysIcon },
      { label: 'Pricing', to: '/admin/pricing', icon: BanknotesIcon },
      { label: 'Coupons', to: '/admin/coupons', icon: GiftIcon },
    ],
  },
  {
    label: 'Data',
    items: [
      { label: 'Reports', to: '/admin/reports', icon: ChartBarIcon },
      { label: 'Performance', to: '/admin/performance', icon: PresentationChartLineIcon },
      { label: 'Sheets Sync', to: '/admin/sync', icon: ArrowPathRoundedSquareIcon },
      { label: 'Customers', to: '/admin/users', icon: UsersIcon },
    ],
  },
  {
    label: 'Staff',
    items: [
      { label: 'Employees', to: '/admin/employees', icon: UserGroupIcon },
      { label: 'Attendance', to: '/admin/attendance', icon: CheckBadgeIcon },
      { label: 'Staff Calendar', to: '/admin/staff-calendar', icon: CalendarDaysIcon },
      { label: 'Laundry', to: '/admin/laundry', icon: ArchiveBoxIcon },
      { label: 'Checklists', to: '/admin/checklists', icon: ClipboardDocumentCheckIcon },
      { label: 'Checklist Editor', to: '/admin/checklist-editor', icon: DocumentTextIcon },
    ],
  },
];

function AdminSidebar() {
  return (
    <nav className="host-tool-groups" aria-label="All admin sections">
      {groups.map(group => <section key={group.label}>
        <h3>{group.label}</h3>
        {group.items.map(item => {
          const Icon = item.icon;
          return <NavLink key={item.to} to={item.to} className={({ isActive }) => clsx('host-tool-link', isActive && 'is-active')}><Icon /><span className="host-tool-label">{item.label}</span><span className="host-tool-arrow" aria-hidden="true">›</span></NavLink>;
        })}
      </section>)}
    </nav>
  );
}

export default AdminSidebar;
