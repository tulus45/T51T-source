import { ROLES } from './constants';

const mutationMap = {
  employees: [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  cash_reports: [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  sales_reports: [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  schedules: [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  users: [ROLES.SUPER_ADMIN],
};

export function hasRoleAccess(role, allowedRoles = []) {
  if (!allowedRoles.length) {
    return true;
  }

  return allowedRoles.includes(role);
}

export function canMutateResource(role, resource) {
  return mutationMap[resource]?.includes(role) ?? false;
}

export function isReadonlyRole(role) {
  return role === ROLES.VIEWER;
}

export function canManageUsers(role) {
  return role === ROLES.SUPER_ADMIN;
}

export function canAssignRole(actorRole, targetRole) {
  if (actorRole === ROLES.SUPER_ADMIN) {
    return true;
  }

  if (actorRole === ROLES.ADMIN) {
    return targetRole !== ROLES.SUPER_ADMIN;
  }

  return false;
}

export function assertPermission(condition, message = 'Anda tidak memiliki izin untuk aksi ini.') {
  if (!condition) {
    throw new Error(message);
  }
}
