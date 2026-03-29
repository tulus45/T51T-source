import { useAuth } from './useAuth';
import { canManageUsers, canMutateResource, isReadonlyRole } from '../utils/permissions';

export function usePermissions() {
  const { profile } = useAuth();
  const role = profile?.role;

  return {
    role,
    isReadonly: isReadonlyRole(role),
    canManageEmployees: canMutateResource(role, 'employees'),
    canManageCashReports: canMutateResource(role, 'cash_reports'),
    canManageSalesReports: canMutateResource(role, 'sales_reports'),
    canManageSchedules: canMutateResource(role, 'schedules'),
    canManageUsers: canManageUsers(role),
  };
}
