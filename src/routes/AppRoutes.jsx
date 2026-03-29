import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from '../layouts/AppLayout';
import DashboardPage from '../pages/DashboardPage';
import EmployeesPage from '../pages/EmployeesPage';
import CashReportsPage from '../pages/CashReportsPage';
import SalesReportsPage from '../pages/SalesReportsPage';
import SchedulesPage from '../pages/SchedulesPage';
import UsersPage from '../pages/UsersPage';
import LoginPage from '../pages/LoginPage';
import UnauthorizedPage from '../pages/UnauthorizedPage';
import NotFoundPage from '../pages/NotFoundPage';
import ProtectedRoute from './ProtectedRoute';
import { ROLES } from '../utils/constants';

const allRoles = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.VIEWER];
const cashRoles = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.VIEWER];

function AppRoutes() {
  return (
    <Routes>
      <Route element={<LoginPage />} path="/login" />
      <Route element={<UnauthorizedPage />} path="/unauthorized" />

      <Route element={<ProtectedRoute allowedRoles={allRoles} />}>
        <Route element={<AppLayout />}>
          <Route element={<Navigate replace to="/dashboard" />} index />
          <Route element={<DashboardPage />} path="/dashboard" />
          <Route element={<EmployeesPage />} path="/employees" />
          <Route element={<SalesReportsPage />} path="/sales-reports" />
          <Route element={<SchedulesPage />} path="/schedules" />

          <Route element={<ProtectedRoute allowedRoles={cashRoles} />}>
            <Route element={<CashReportsPage />} path="/cash-reports" />
          </Route>
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN]} />}>
        <Route element={<AppLayout />}>
          <Route element={<UsersPage />} path="/users" />
        </Route>
      </Route>

      <Route element={<NotFoundPage />} path="*" />
    </Routes>
  );
}

export default AppRoutes;

