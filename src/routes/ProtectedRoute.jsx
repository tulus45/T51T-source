import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { hasRoleAccess } from '../utils/permissions';
import { useAuth } from '../hooks/useAuth';
import Spinner from '../components/ui/Spinner';

function ProtectedRoute({ allowedRoles = [] }) {
  const { isAuthenticated, loading, profile } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <Spinner label="Menyiapkan aplikasi..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate replace state={{ from: location }} to="/login" />;
  }

  if (!hasRoleAccess(profile?.role, allowedRoles)) {
    return <Navigate replace to="/unauthorized" />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
