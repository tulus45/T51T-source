import { BarChart3, CalendarDays, LayoutDashboard, ReceiptText, ShieldCheck, Users } from 'lucide-react';
import { ROLES } from '../utils/constants';

export const appRoutes = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.VIEWER],
  },
  {
    path: '/employees',
    label: 'Struktur Pegawai',
    icon: Users,
    roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.VIEWER],
  },
  {
    path: '/schedules',
    label: 'Jadwal Shift',
    icon: CalendarDays,
    roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.VIEWER],
  },
  {
    path: '/cash-reports',
    label: 'Laporan Kas',
    icon: ReceiptText,
    roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.VIEWER],
  },
  {
    path: '/sales-reports',
    label: 'Laporan Sales',
    icon: BarChart3,
    roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.VIEWER],
  },
  {
    path: '/users',
    label: 'Manajemen User',
    icon: ShieldCheck,
    roles: [ROLES.SUPER_ADMIN],
  },
];


