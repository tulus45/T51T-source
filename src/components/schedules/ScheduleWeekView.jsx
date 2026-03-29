import { formatDate } from '../../utils/formatters';
import { cn } from '../../utils/helpers';

const shiftLabelClassNames = {
  pagi: 'bg-brand-100 text-brand-700',
  siang: 'bg-amber-100 text-amber-700',
  malam: 'bg-slate-200 text-slate-700',
  libur: 'bg-emerald-100 text-emerald-700',
};

const shiftLabels = {
  pagi: 'pagi',
  siang: 'siang',
  malam: 'malam',
  libur: 'libur',
};

function toLocalDate(dateKey) {
  return new Date(`${dateKey}T00:00:00`);
}

function getWeekdayShortLabel(dateKey) {
  return new Intl.DateTimeFormat('id-ID', { weekday: 'short' }).format(toLocalDate(dateKey)).replace('.', '');
}

function ScheduleCell({ canManage, item, onEdit }) {
  if (!item) {
    return <span className="text-sm text-slate-300">-</span>;
  }

  const label = shiftLabels[item.shift_type] || item.shift_type;
  const content = (
    <span
      className={cn(
        'inline-flex min-w-[78px] justify-center rounded-lg px-2.5 py-1.5 text-xs font-semibold',
        shiftLabelClassNames[item.shift_type] || 'bg-slate-100 text-slate-700',
        item.isPending ? 'ring-2 ring-brand-300 ring-offset-1' : '',
      )}
    >
      {label}
    </span>
  );

  if (canManage) {
    return (
      <div className="flex justify-center">
        <button
          className={cn(
            'flex w-fit rounded-xl border border-transparent px-1 py-1 transition hover:border-brand-200 hover:bg-brand-50',
            item.isPending ? 'border-brand-200 bg-brand-50/50' : '',
          )}
          onClick={() => onEdit(item)}
          title={`${item.isPending ? 'Perubahan belum disimpan. ' : ''}Klik untuk edit jadwal ${item.employee?.name || '-'} pada ${item.date}`}
          type="button"
        >
          {content}
        </button>
      </div>
    );
  }

  return <div className="flex justify-center">{content}</div>;
}

function ScheduleWeekView({ canManage, dateKeys, holidayEntries = [], onEdit, rows, weekLabel }) {
  const holidayEntryMap = new Map(holidayEntries.map((entry) => [entry.date, entry]));

  return (
    <div className="space-y-4">
      <div className="flex">
        <div className="surface inline-flex max-w-full items-center px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">{weekLabel}</p>
        </div>
      </div>

      <div className="table-shell">
        <div className="overflow-x-auto">
          <table className="table-base min-w-[980px] w-full table-fixed">
            <colgroup>
              <col style={{ width: '240px' }} />
              {dateKeys.map((dateKey) => (
                <col key={dateKey} style={{ width: 'calc((100% - 240px) / 7)' }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th className="sticky left-0 z-20 w-[240px] bg-white normal-case tracking-normal">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Personel Toko</p>
                  </div>
                </th>
                {dateKeys.map((dateKey) => {
                  const holidayEntry = holidayEntryMap.get(dateKey);

                  return (
                    <th
                      className={cn(
                        'text-center normal-case tracking-normal',
                        holidayEntry ? 'bg-red-100/80' : '',
                      )}
                      key={dateKey}
                    >
                      <div className="text-center">
                        <p className={cn('text-sm font-semibold text-slate-900', holidayEntry ? 'text-red-700' : '')}>
                          {getWeekdayShortLabel(dateKey)}
                        </p>
                        <p className={cn('mt-1 text-xs text-slate-500', holidayEntry ? 'text-red-600' : '')}>
                          {formatDate(dateKey, { day: '2-digit', month: 'short' })}
                        </p>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="bg-white">
              {rows.length === 0 ? (
                <tr>
                  <td className="bg-slate-50/50 px-4 py-8 text-center text-sm text-slate-400" colSpan={dateKeys.length + 1}>
                    Belum ada personel untuk ditampilkan.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr className="hover:bg-slate-50/60" key={row.employee.id}>
                    <th className="sticky left-0 z-10 bg-white px-4 py-3 text-left" scope="row">
                      <span className="block text-sm font-semibold text-slate-900">{row.employee.name}</span>
                    </th>
                    {dateKeys.map((dateKey) => (
                      <td className="bg-slate-50/50 px-3 py-3 text-center" key={`${row.employee.id}-${dateKey}`}>
                        <ScheduleCell canManage={canManage} item={row.itemsByDate[dateKey] || null} onEdit={onEdit} />
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {holidayEntries.length > 0 ? (
        <div className="surface-muted px-4 py-3">
          <p className="text-sm font-semibold text-red-700">Keterangan Tanggal Merah</p>
          <div className="mt-2 space-y-1 text-sm text-slate-600">
            {holidayEntries.map((entry) => (
              <p key={entry.date}>
                <span className="font-semibold text-slate-900">{formatDate(entry.date)}</span>
                {entry.description ? ` - ${entry.description}` : ' - Tanggal merah'}
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default ScheduleWeekView;






