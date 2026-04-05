import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import PublicLayout from './layouts/PublicLayout';
import AdminLayout from './layouts/AdminLayout';
import ProtectedRoute from './components/ProtectedRoute';
import PageLoader from './components/PageLoader';

const HomePage = lazy(() => import('./pages/HomePage'));
const ListingsPage = lazy(() => import('./pages/ListingsPage'));
const ListingDetailPage = lazy(() => import('./pages/ListingDetailPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignupPage = lazy(() => import('./pages/SignupPage'));
const UserDashboardPage = lazy(() => import('./pages/UserDashboardPage'));
const BookingConfirmationPage = lazy(() => import('./pages/BookingConfirmationPage'));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'));
const AdminListingsPage = lazy(() => import('./pages/AdminListingsPage'));
const AdminBookingsPage = lazy(() => import('./pages/AdminBookingsPage'));
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage'));
const AdminPricingPage = lazy(() => import('./pages/AdminPricingPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

function App() {
  return (
    <Suspense fallback={<PageLoader label="Loading page..." />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/stays" element={<ListingsPage type="room" />} />
          <Route path="/treks" element={<ListingsPage type="trek" />} />
          <Route path="/camps" element={<ListingsPage type="camp" />} />
          <Route path="/experiences/:slug" element={<ListingDetailPage />} />
          <Route path="/book/:slug" element={<ListingDetailPage bookingFirst />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute role="user">
                <UserDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/booking/confirmation/:id"
            element={
              <ProtectedRoute>
                <BookingConfirmationPage />
              </ProtectedRoute>
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
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="pricing" element={<AdminPricingPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}

export default App;
