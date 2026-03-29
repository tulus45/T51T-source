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

function EmployeeDetailsTable({ canManage, employees, hideRestrictedColumns = false, onDelete, onEdit }) {
  const activeEmployees = employees.filter((employee) => ACTIVE_EMPLOYEE_STATUSES.includes(employee.status));
  const inactiveEmployees = employees.filter((employee) => !ACTIVE_EMPLOYEE_STATUSES.includes(employee.status));
  const showRestrictedColumns = !hideRestrictedColumns;
  const tableMinWidthClass = showRestrictedColumns ? 'min-w-[1880px]' : 'min-w-[1220px]';

  function renderEmployeeCell(employee) {
    return (
      <div className="flex items-center gap-3">
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
        <div>
          <p className="font-semibold text-slate-900">{employee.name}</p>
        </div>
      </div>
    );
  }

  function renderStatusBadge(employee) {
    return <Badge tone={EMPLOYEE_STATUS_TONES[employee.status] || 'slate'}>{employee.status}</Badge>;
  }

  function renderGender(employee) {
    const normalizedGender = String(employee.gender || '').trim().toLowerCase();
    return EMPLOYEE_GENDER_LABELS[normalizedGender] || '-';
  }

  function renderChecklistCell(value, label) {
    return (
      <div className="flex justify-center">
        <input
          aria-label={label}
          checked={Boolean(value)}
          className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          readOnly
          type="checkbox"
        />
      </div>
    );
  }

  function renderShiftCell(employee) {
    return (
      <div className="flex flex-col gap-2 text-sm text-slate-600">
        <label className="flex items-center gap-2">
          <input
            aria-label={`Shift pagi ${employee.name}`}
            checked={employee.shift_pagi == null ? true : Boolean(employee.shift_pagi)}
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            readOnly
            type="checkbox"
          />
          <span>Pagi</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            aria-label={`Shift siang ${employee.name}`}
            checked={employee.shift_siang == null ? true : Boolean(employee.shift_siang)}
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            readOnly
            type="checkbox"
          />
          <span>Siang</span>
        </label>
      </div>
    );
  }

  function renderOffDayCell(employee) {
    const offDayMode = String(employee.off_day_mode || 'all').trim().toLowerCase();

    if (offDayMode !== 'custom') {
      return 'Semua hari';
    }

    const offDayWeekdays = Array.isArray(employee.off_day_weekdays)
      ? employee.off_day_weekdays.map((value) => Number(value)).filter((value) => weekdayLabelMap.has(value))
      : [];

    return offDayWeekdays.length ? offDayWeekdays.map((value) => weekdayLabelMap.get(value)).join(', ') : '-';
  }

  function renderSeparatedEmployeesCell(employee) {
    const names = Array.isArray(employee.separated_employee_names)
      ? employee.separated_employee_names.filter(Boolean)
      : [];

    if (!names.length) {
      return '-';
    }

    return names.join(', ');
  }

  function renderActionCell(employee) {
    if (!canManage) {
      return null;
    }

    return (
      <td>
        <div className="flex gap-2">
          <Button onClick={() => onEdit(employee)} size="sm" variant="secondary">
            Edit
          </Button>
          <Button onClick={() => onDelete(employee)} size="sm" variant="danger">
            Hapus
          </Button>
        </div>
      </td>
    );
  }

  function renderTableRows(list) {
    return list.map((employee) => (
      <tr key={employee.id}>
        <td>{renderEmployeeCell(employee)}</td>
        <td className="font-medium text-slate-900">{employee.position}</td>
        <td>{renderChecklistCell(employee.kasir, `Kasir ${employee.name}`)}</td>
        <td>{renderChecklistCell(employee.pimpinan_shift, `Pimpinan shift ${employee.name}`)}</td>
        {showRestrictedColumns ? <td>{renderShiftCell(employee)}</td> : null}
        {showRestrictedColumns ? <td className="text-sm text-slate-600">{renderOffDayCell(employee)}</td> : null}
        {showRestrictedColumns ? <td className="max-w-[280px] whitespace-normal text-sm text-slate-600">{renderSeparatedEmployeesCell(employee)}</td> : null}
        {showRestrictedColumns ? <td>{renderChecklistCell(employee.holiday_mandatory_off, `Tanggal merah wajib libur ${employee.name}`)}</td> : null}
        <td>{renderGender(employee)}</td>
        {showRestrictedColumns ? <td>{renderStatusBadge(employee)}</td> : null}
        <td>{employee.phone || '-'}</td>
        <td className="max-w-[240px] truncate">{employee.email || '-'}</td>
        {renderActionCell(employee)}
      </tr>
    ));
  }

  return (
    <div className="space-y-6">
      <section className="table-shell">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-white px-5 py-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Data Detail</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Pegawai aktif</h2>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Total aktif: <span className="font-semibold text-slate-900">{activeEmployees.length}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className={`table-base ${tableMinWidthClass}`}>
            <thead>
              <tr>
                <th>Pegawai</th>
                <th>Jabatan</th>
                <th className="text-center">Kasir</th>
                <th className="text-center">Pimpinan Shift</th>
                {showRestrictedColumns ? <th>Shift</th> : null}
                {showRestrictedColumns ? <th>Libur</th> : null}
                {showRestrictedColumns ? <th>Pisah Shift Dengan</th> : null}
                {showRestrictedColumns ? <th className="text-center">Tgl Merah Wajib Libur</th> : null}
                <th>Gender</th>
                {showRestrictedColumns ? <th>Status</th> : null}
                <th>Telepon</th>
                <th>Email</th>
                {canManage && <th className="w-40">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">{renderTableRows(activeEmployees)}</tbody>
          </table>
        </div>
      </section>

      {inactiveEmployees.length > 0 && (
        <section className="overflow-hidden rounded-3xl border border-amber-200 bg-white shadow-soft">
          <div className="flex flex-col gap-3 border-b border-amber-200 bg-amber-50 px-5 py-5 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Former Team Members</h2>
            </div>
            <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-500">
              Total status lain: <span className="font-semibold text-slate-900">{inactiveEmployees.length}</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className={`table-base ${tableMinWidthClass}`}>
              <thead>
                <tr>
                  <th>Pegawai</th>
                  <th>Jabatan</th>
                  <th className="text-center">Kasir</th>
                  <th className="text-center">Pimpinan Shift</th>
                  {showRestrictedColumns ? <th>Shift</th> : null}
                  {showRestrictedColumns ? <th>Libur</th> : null}
                  {showRestrictedColumns ? <th>Pisah Shift Dengan</th> : null}
                  {showRestrictedColumns ? <th className="text-center">Tgl Merah Wajib Libur</th> : null}
                  <th>Gender</th>
                  {showRestrictedColumns ? <th>Status</th> : null}
                  <th>Telepon</th>
                  <th>Email</th>
                  {canManage && <th className="w-40">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">{renderTableRows(inactiveEmployees)}</tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

export default EmployeeDetailsTable;
