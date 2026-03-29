import Badge from '../ui/Badge';
import Button from '../ui/Button';
import { EMPLOYEE_GENDER_LABELS, EMPLOYEE_STATUS_TONES } from '../../utils/constants';
import { getInitials } from '../../utils/helpers';

function EmployeeCard({ employee, canManage, onDelete, onEdit }) {
  return (
    <article className="surface flex flex-col overflow-hidden">
      <div className="relative flex h-52 items-center justify-center bg-gradient-to-br from-slate-100 via-white to-brand-50 p-3">
        {employee.photo_url ? (
          <img
            alt={employee.name}
            className="h-full w-full rounded-2xl object-contain object-center"
            src={employee.photo_url}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-2xl bg-gradient-to-br from-brand-100 to-slate-100 text-4xl font-bold text-brand-700">
            {getInitials(employee.name)}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{employee.name}</h3>
            <p className="mt-1 text-sm text-slate-500">{employee.position}</p>
          </div>
          <Badge tone={EMPLOYEE_STATUS_TONES[employee.status] || 'slate'}>{employee.status}</Badge>
        </div>

        <dl className="mt-5 space-y-3 text-sm text-slate-600">
          <div className="flex items-center justify-between gap-4">
            <dt>Gender</dt>
            <dd className="font-medium text-slate-900">{EMPLOYEE_GENDER_LABELS[String(employee.gender || '').trim().toLowerCase()] || '-'}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt>Telepon</dt>
            <dd className="font-medium text-slate-900">{employee.phone || '-'}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt>Email</dt>
            <dd className="max-w-[65%] truncate font-medium text-slate-900">{employee.email || '-'}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt>Urutan Struktur</dt>
            <dd className="font-medium text-slate-900">{employee.hierarchy_order || 0}</dd>
          </div>
        </dl>

        {canManage && (
          <div className="mt-6 flex gap-3">
            <Button className="flex-1" onClick={() => onEdit(employee)} variant="secondary">
              Edit
            </Button>
            <Button className="flex-1" onClick={() => onDelete(employee)} variant="danger">
              Hapus
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}

export default EmployeeCard;

