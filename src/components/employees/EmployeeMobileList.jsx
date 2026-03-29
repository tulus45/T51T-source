import {
  ACTIVE_EMPLOYEE_STATUSES,
  EMPLOYEE_GENDER_LABELS,
  EMPLOYEE_STATUS_TONES,
} from '../../utils/constants';
import { SCHEDULE_RULE_WEEKDAY_OPTIONS } from '../../utils/schedule';
import { getInitials } from '../../utils/helpers';
import Badge from '../ui/Badge';
import Button from '../ui/Button';

const weekdayLabelMap = new Map(SCHEDULE_RULE_WEEKDAY_OPTIONS.map((option) => [option.value, option.shortLabel]));

function getShiftSummary(employee) {
  const shifts = [];

  if (employee.shift_pagi == null ? true : Boolean(employee.shift_pagi)) {
    shifts.push('Pagi');
  }

  if (employee.shift_siang == null ? true : Boolean(employee.shift_siang)) {
    shifts.push('Siang');
  }

  return shifts.length ? shifts.join(', ') : '-';
}

function getOffDaySummary(employee) {
  const offDayMode = String(employee.off_day_mode || 'all').trim().toLowerCase();

  if (offDayMode !== 'custom') {
    return 'Semua hari';
  }

  const offDayWeekdays = Array.isArray(employee.off_day_weekdays)
    ? employee.off_day_weekdays.map((value) => Number(value)).filter((value) => weekdayLabelMap.has(value))
    : [];

  return offDayWeekdays.length ? offDayWeekdays.map((value) => weekdayLabelMap.get(value)).join(', ') : '-';
}

function getSeparatedEmployeesSummary(employee) {
  const names = Array.isArray(employee.separated_employee_names)
    ? employee.separated_employee_names.filter(Boolean)
    : [];

  return names.length ? names.join(', ') : '-';
}

function getGenderLabel(employee) {
  const normalizedGender = String(employee.gender || '').trim().toLowerCase();
  return EMPLOYEE_GENDER_LABELS[normalizedGender] || '-';
}

function EmployeeCard({ canManage, employee, onDelete, onEdit }) {
  return (
    <article className="surface p-4" key={employee.id}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100">
            {employee.photo_url ? (
              <img
                alt={employee.name}
                className="h-full w-full object-contain object-center"
                src={employee.photo_url}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-100 to-slate-100 text-sm font-bold text-brand-700">
                {getInitials(employee.name)}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-slate-900">{employee.name}</p>
            <p className="mt-1 text-sm text-slate-500">{employee.position || '-'}</p>
          </div>
        </div>
        <Badge tone={EMPLOYEE_STATUS_TONES[employee.status] || 'slate'}>{employee.status}</Badge>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {employee.pimpinan_shift ? <Badge tone="brand">Pimpinan Shift</Badge> : null}
        {employee.kasir ? <Badge tone="green">Kasir</Badge> : null}
        <Badge tone="slate">Shift {getShiftSummary(employee)}</Badge>
      </div>

      <div className="surface-muted mt-4 grid gap-3 p-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Gender</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">{getGenderLabel(employee)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Libur</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">{getOffDaySummary(employee)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Tgl Merah Wajib Libur</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">{employee.holiday_mandatory_off ? 'Ya' : 'Tidak'}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Telepon</p>
          <p className="mt-2 break-all text-sm font-semibold text-slate-900">{employee.phone || '-'}</p>
        </div>
      </div>

      <div className="surface-muted mt-4 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Email</p>
        <p className="mt-2 break-all text-sm font-semibold text-slate-900">{employee.email || '-'}</p>
      </div>

      <div className="surface-muted mt-4 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Pisah Shift Dengan</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">{getSeparatedEmployeesSummary(employee)}</p>
      </div>

      {canManage ? (
        <div className="mt-4 flex gap-2">
          <Button className="flex-1" onClick={() => onEdit(employee)} size="sm" variant="secondary">
            Edit
          </Button>
          <Button className="flex-1" onClick={() => onDelete(employee)} size="sm" variant="danger">
            Hapus
          </Button>
        </div>
      ) : null}
    </article>
  );
}

function EmployeeMobileList({ canManage, employees, onDelete, onEdit }) {
  const activeEmployees = employees.filter((employee) => ACTIVE_EMPLOYEE_STATUSES.includes(employee.status));
  const inactiveEmployees = employees.filter((employee) => !ACTIVE_EMPLOYEE_STATUSES.includes(employee.status));

  return (
    <div className="space-y-6 md:hidden">
      {activeEmployees.length ? (
        <section className="space-y-4">
          <div className="surface-muted p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Data Detail</p>
            <p className="mt-2 text-lg font-bold text-slate-900">Pegawai aktif</p>
            <p className="mt-1 text-sm text-slate-500">Total aktif: {activeEmployees.length}</p>
          </div>
          {activeEmployees.map((employee) => (
            <EmployeeCard canManage={canManage} employee={employee} key={employee.id} onDelete={onDelete} onEdit={onEdit} />
          ))}
        </section>
      ) : null}

      {inactiveEmployees.length ? (
        <section className="space-y-4">
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700/70">Status lain</p>
            <p className="mt-2 text-lg font-bold text-slate-900">Former Team Members</p>
            <p className="mt-1 text-sm text-slate-500">Total status lain: {inactiveEmployees.length}</p>
          </div>
          {inactiveEmployees.map((employee) => (
            <EmployeeCard canManage={canManage} employee={employee} key={employee.id} onDelete={onDelete} onEdit={onEdit} />
          ))}
        </section>
      ) : null}
    </div>
  );
}

export default EmployeeMobileList;
