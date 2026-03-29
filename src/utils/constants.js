export const APP_NAME = 'Store Staff Manager';

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  VIEWER: 'viewer',
};

export const ROLE_OPTIONS = [
  { value: ROLES.SUPER_ADMIN, label: 'Super Admin' },
  { value: ROLES.ADMIN, label: 'Admin' },
  { value: ROLES.VIEWER, label: 'Viewer' },
];

export const ROLE_LABELS = {
  [ROLES.SUPER_ADMIN]: 'Super Admin',
  [ROLES.ADMIN]: 'Admin',
  [ROLES.VIEWER]: 'Viewer',
};

export const EMPLOYEE_STATUS_OPTIONS = [
  { value: 'aktif', label: 'Aktif' },
  { value: 'cuti', label: 'Cuti' },
  { value: 'mutasi', label: 'Mutasi' },
  { value: 'promosi', label: 'Promosi' },
  { value: 'resign', label: 'Resign' },
];

export const EMPLOYEE_STATUS_TONES = {
  aktif: 'green',
  cuti: 'amber',
  mutasi: 'brand',
  promosi: 'slate',
  resign: 'red',
};

export const EMPLOYEE_GENDER_OPTIONS = [
  { value: '', label: 'Pilih gender' },
  { value: 'laki-laki', label: 'Laki-laki' },
  { value: 'perempuan', label: 'Perempuan' },
];

export const EMPLOYEE_GENDER_LABELS = {
  'laki-laki': 'Laki-laki',
  perempuan: 'Perempuan',
};


export const ACTIVE_EMPLOYEE_STATUSES = ['aktif'];

export const CASH_TYPE_OPTIONS = [
  { value: 'income', label: 'Pemasukan' },
  { value: 'expense', label: 'Pengeluaran' },
];

export const SHIFT_TYPE_OPTIONS = [
  { value: 'pagi', label: 'Pagi' },
  { value: 'siang', label: 'Siang' },
  { value: 'malam', label: 'Malam' },
  { value: 'libur', label: 'Libur' },
];

export const SHIFT_HOURS = {
  pagi: { start: '08:00', end: '16:00' },
  siang: { start: '12:00', end: '20:00' },
  malam: { start: '16:00', end: '23:00' },
  libur: { start: '', end: '' },
};

export const EMPLOYEE_SHIFT_OPTIONS = [
  { value: '', label: 'Pilih shift' },
  { value: 'pagi', label: 'Pagi' },
  { value: 'siang', label: 'Siang' },
];

export const EMPLOYEE_SHIFT_LABELS = {
  pagi: 'Pagi',
  siang: 'Siang',
};
