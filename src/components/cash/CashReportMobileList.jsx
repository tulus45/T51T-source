import Badge from '../ui/Badge';
import Button from '../ui/Button';
import { formatDate, formatRupiah } from '../../utils/formatters';

function CashReportMobileList({ cashReports, canManage, onDelete, onEdit }) {
  return (
    <div className="space-y-4 md:hidden">
      {cashReports.map((item) => (
        <article className="surface p-4" key={item.id}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-base font-bold text-slate-900">{item.category}</p>
              <p className="mt-1 text-sm text-slate-500">{formatDate(item.date)}</p>
            </div>
            <Badge tone={item.type === 'income' ? 'green' : 'red'}>
              {item.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
            </Badge>
          </div>

          <p className="mt-4 text-2xl font-bold tracking-tight text-slate-900">{formatRupiah(item.amount)}</p>

          <div className="surface-muted mt-4 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Deskripsi</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{item.description || 'Tidak ada deskripsi.'}</p>
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

export default CashReportMobileList;
