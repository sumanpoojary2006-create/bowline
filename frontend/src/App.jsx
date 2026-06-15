import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import PublicLayout from './layouts/PublicLayout';
import AdminLayout from './layouts/AdminLayout';
import EmployeeLayout from './layouts/EmployeeLayout';
import ProtectedRoute from './components/ProtectedRoute';
import EmployeeProtectedRoute from './components/EmployeeProtectedRoute';
import PageLoader from './components/PageLoader';
import BookingCartDrawer from './components/BookingCartDrawer';
import { BookingCartProvider } from './context/BookingCartContext';
import { EmployeeAuthProvider } from './context/EmployeeAuthContext';

const HomePage = lazy(() => import('./pages/HomePage'));
const ListingsPage = lazy(() => import('./pages/ListingsPage'));
const ListingDetailPage = lazy(() => import('./pages/ListingDetailPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const ManageBookingPage = lazy(() => import('./pages/ManageBookingPage'));
const BookingConfirmationPage = lazy(() => import('./pages/BookingConfirmationPage'));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'));
const AdminListingsPage = lazy(() => import('./pages/AdminListingsPage'));
const AdminBookingsPage = lazy(() => import('./pages/AdminBookingsPage'));
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage'));
const AdminPricingPage = lazy(() => import('./pages/AdminPricingPage'));
const AdminCouponsPage = lazy(() => import('./pages/AdminCouponsPage'));
const AdminCalendarPage = lazy(() => import('./pages/AdminCalendarPage'));
const AdminReportsPage = lazy(() => import('./pages/AdminReportsPage'));
const AdminSyncPage = lazy(() => import('./pages/AdminSyncPage'));
const BrowseRoomsPage = lazy(() => import('./pages/BrowseRoomsPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const EmployeeLoginPage = lazy(() => import('./pages/employee/EmployeeLoginPage'));
const EmployeeDashboardPage = lazy(() => import('./pages/employee/EmployeeDashboardPage'));
const EmployeeChecklistPage = lazy(() => import('./pages/employee/EmployeeChecklistPage'));
const AdminEmployeesPage = lazy(() => import('./pages/AdminEmployeesPage'));
const AdminAttendancePage = lazy(() => import('./pages/AdminAttendancePage'));
const AdminChecklistsPage = lazy(() => import('./pages/AdminChecklistsPage'));
const AdminEmployeeSettingsPage = lazy(() => import('./pages/AdminEmployeeSettingsPage'));

function App() {
  return (
    <BookingCartProvider>
      <EmployeeAuthProvider>
      <BookingCartDrawer />
    <Suspense fallback={<PageLoader label="Loading page..." />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/stays" element={<ListingsPage type="room" />} />
          <Route path="/treks" element={<ListingsPage type="trek" />} />
          <Route path="/camps" element={<ListingsPage type="camp" />} />
          <Route path="/browse" element={<BrowseRoomsPage />} />
          <Route path="/experiences/:slug" element={<ListingDetailPage />} />
          <Route path="/book/:slug" element={<ListingDetailPage bookingFirst />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/manage-booking" element={<ManageBookingPage />} />
          <Route path="/booking/confirmation/:id" element={<BookingConfirmationPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
        </Route>

        <Route element={<EmployeeLayout />}>
          <Route path="/employee/login" element={<EmployeeLoginPage />} />
          <Route
            path="/employee/dashboard"
            element={
              <EmployeeProtectedRoute>
                <EmployeeDashboardPage />
              </EmployeeProtectedRoute>
            }
          />
          <Route
            path="/employee/checkout"
            element={
              <EmployeeProtectedRoute>
                <EmployeeChecklistPage />
              </EmployeeProtectedRoute>
            }
          />
        </Route>

        <Route
          path="/admin"
          element={
            <ProtectedRoute role="admin">
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<AdminDashboardPage />} />
          <Route path="listings" element={<AdminListingsPage />} />
          <Route path="bookings" element={<AdminBookingsPage />} />
          <Route path="calendar" element={<AdminCalendarPage />} />
          <Route path="reports" element={<AdminReportsPage />} />
          <Route path="sync" element={<AdminSyncPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="pricing" element={<AdminPricingPage />} />
          <Route path="coupons" element={<AdminCouponsPage />} />
          <Route path="employees" element={<AdminEmployeesPage />} />
          <Route path="attendance" element={<AdminAttendancePage />} />
          <Route path="checklists" element={<AdminChecklistsPage />} />
          <Route path="employee-settings" element={<AdminEmployeeSettingsPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
      </EmployeeAuthProvider>
    </BookingCartProvider>
  );
}

export default App;
