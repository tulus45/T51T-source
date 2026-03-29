import Badge from '../ui/Badge';
import Button from '../ui/Button';
import { formatDate } from '../../utils/formatters';

const shiftTone = {
  pagi: 'brand',
  siang: 'amber',
  malam: 'slate',
  libur: 'green',
};

function ScheduleMobileList({ canManage, onDelete, onEdit, schedules }) {
  return (
    <div className="space-y-4 md:hidden">
      {schedules.map((item) => (
        <article className="surface p-4" key={item.id}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-base font-bold text-slate-900">{item.employee?.name || '-'}</p>
              <p className="mt-1 text-sm text-slate-500">{item.employee?.position || '-'}</p>
            </div>
            <Badge tone={shiftTone[item.shift_type] || 'slate'}>{item.shift_type}</Badge>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="surface-muted p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Tanggal</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{formatDate(item.date)}</p>
            </div>
            <div className="surface-muted p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Jam</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {item.shift_type === 'libur' ? 'Libur' : `${item.start_time || '--:--'} - ${item.end_time || '--:--'}`}
              </p>
            </div>
          </div>

          <div className="surface-muted mt-4 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Catatan</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{item.notes || 'Tidak ada catatan tambahan.'}</p>
          </div>

          {canManage && (
            <div className="mt-4 flex gap-2">
              <Button className="flex-1" onClick={() => onEdit(item)} size="sm" variant="secondary">
                Edit
              </Button>
              <Button className="flex-1" onClick={() => onDelete(item)} size="sm" variant="danger">
                Hapus
              </Button>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

export default ScheduleMobileList;
