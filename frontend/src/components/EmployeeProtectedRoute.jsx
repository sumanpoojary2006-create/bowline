import { Navigate, useLocation } from 'react-router-dom';
import { useEmployeeAuth } from '../context/EmployeeAuthContext';
import PageLoader from './PageLoader';

function EmployeeProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useEmployeeAuth();
  const location = useLocation();

  if (loading) {
    return <PageLoader label="Loading your dashboard..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/employee/login" replace state={{ from: location }} />;
  }

  return children;
}

export default EmployeeProtectedRoute;
