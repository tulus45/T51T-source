import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import Button from '../components/ui/Button';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Input from '../components/ui/Input';
import Spinner from '../components/ui/Spinner';
import StatCard from '../components/ui/StatCard';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../hooks/useToast';
import {
  deleteDailySalesReport,
  getSalesMonthTarget,
  listDailySalesReports,
  upsertDailySalesReport,
  upsertSalesMonthTarget,
} from '../services/salesReportsService';
import { formatDate, formatRupiah } from '../utils/formatters';
import { cn } from '../utils/helpers';
import { assertPermission } from '../utils/permissions';

const WEEKDAY_LABELS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

function padNumber(value) {
  return String(value).padStart(2, '0');
}

function toDateKey(date) {
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;
}

function getTodayDateKey() {
  return toDateKey(new Date());
}

function toMonthValue(date) {
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}`;
}

function parseMonthValue(value) {
  if (!value) {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  }

  const [year, month] = value.split('-').map(Number);

  if (!year || !month) {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  }

  return new Date(year, month - 1, 1);
}

function getCurrentMonthValue() {
  return toMonthValue(new Date());
}

function getMonthContext(monthValue = getCurrentMonthValue()) {
  const monthDate = parseMonthValue(monthValue);
  const startDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const endDate = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

  return {
    monthStart: toDateKey(startDate),
    monthEnd: toDateKey(endDate),
    dayCount: endDate.getDate(),
    monthLabel: new Intl.DateTimeFormat('id-ID', {
      month: 'long',
      year: 'numeric',
    }).format(startDate),
  };
}

function getDefaultSelectedDate(monthContext) {
  const today = getTodayDateKey();

  if (today >= monthContext.monthStart && today <= monthContext.monthEnd) {
    return today;
  }

  return monthContext.monthStart;
}

function calculateApc(salesAmount = 0, receiptCount = 0) {
  const normalizedSalesAmount = Number(salesAmount || 0);
  const normalizedReceiptCount = Number(receiptCount || 0);

  if (normalizedReceiptCount <= 0) {
    return 0;
  }

  return Math.round((normalizedSalesAmount / normalizedReceiptCount) * 100) / 100;
}

function calculateAchievementPercentage(currentValue = 0, targetValue = 0) {
  const normalizedCurrentValue = Number(currentValue || 0);
  const normalizedTargetValue = Number(targetValue || 0);

  if (normalizedTargetValue <= 0) {
    return 0;
  }

  return Math.round((normalizedCurrentValue / normalizedTargetValue) * 1000) / 10;
}

function buildMonthCalendarDays(monthContext) {
  const monthStart = new Date(`${monthContext.monthStart}T00:00:00`);
  const calendarStart = new Date(monthStart);
  const mondayOffset = (monthStart.getDay() + 6) % 7;
  calendarStart.setDate(monthStart.getDate() - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarStart);
    date.setDate(calendarStart.getDate() + index);

    return {
      date: toDateKey(date),
      dayNumber: date.getDate(),
      isCurrentMonth: date.getMonth() === monthStart.getMonth(),
      isToday: toDateKey(date) === getTodayDateKey(),
    };
  });
}

function sanitizeNumberInput(value) {
  return value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
}

function formatGroupedNumber(value) {
  const normalizedValue = sanitizeNumberInput(String(value || ''));

  if (!normalizedValue) {
    return '';
  }

  return normalizedValue.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function getMonthValueFromDateKey(value) {
  if (!value || value.length < 7) {
    return getCurrentMonthValue();
  }

  return value.slice(0, 7);
}

function shiftMonthValue(monthValue, offset) {
  const monthDate = parseMonthValue(monthValue);
  return toMonthValue(new Date(monthDate.getFullYear(), monthDate.getMonth() + offset, 1));
}

function getSalesPageErrorMessage(error) {
  return error?.message || 'Terjadi kesalahan pada laporan sales.';
}

function SalesReportsPage() {
  const { canManageSalesReports } = usePermissions();
  const { showToast } = useToast();
  const [selectedMonth, setSelectedMonth] = useState(() => getCurrentMonthValue());
  const monthContext = useMemo(() => getMonthContext(selectedMonth), [selectedMonth]);
  const calendarDays = useMemo(() => buildMonthCalendarDays(monthContext), [monthContext]);
  const currentMonthDays = useMemo(() => calendarDays.filter((day) => day.isCurrentMonth), [calendarDays]);
  const [monthTarget, setMonthTarget] = useState(null);
  const [dailyReports, setDailyReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingTarget, setSavingTarget] = useState(false);
  const [savingDailyReport, setSavingDailyReport] = useState(false);
  const [deletingDailyReport, setDeletingDailyReport] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [targetAmountInput, setTargetAmountInput] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => getDefaultSelectedDate(getMonthContext(getCurrentMonthValue())));
  const [salesAmountInput, setSalesAmountInput] = useState('');
  const [receiptCountInput, setReceiptCountInput] = useState('');
  const isDailyReportMutating = savingDailyReport || deletingDailyReport;
  const isMonthNavigationDisabled = loading || savingTarget || isDailyReportMutating;

  async function loadSalesData() {
    try {
      setLoading(true);
      const [targetData, dailyReportRows] = await Promise.all([
        getSalesMonthTarget(monthContext.monthStart),
        listDailySalesReports({
          dateFrom: monthContext.monthStart,
          dateTo: monthContext.monthEnd,
        }),
      ]);

      setMonthTarget(targetData);
      setDailyReports(dailyReportRows);
      setTargetAmountInput(targetData ? String(Number(targetData.target_amount || 0)) : '');
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Laporan sales gagal dimuat',
        message: getSalesPageErrorMessage(error),
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSalesData();
  }, [monthContext.monthEnd, monthContext.monthStart]);

  useEffect(() => {
    setSelectedDate((currentDate) => {
      if (currentDate >= monthContext.monthStart && currentDate <= monthContext.monthEnd) {
        return currentDate;
      }

      return getDefaultSelectedDate(monthContext);
    });
  }, [monthContext.monthEnd, monthContext.monthStart]);

  const dailyReportsByDate = useMemo(
    () => new Map(dailyReports.map((report) => [report.date, report])),
    [dailyReports],
  );

  useEffect(() => {
    const selectedReport = dailyReportsByDate.get(selectedDate);

    setSalesAmountInput(selectedReport ? String(Number(selectedReport.sales_amount || 0)) : '');
    setReceiptCountInput(selectedReport ? String(Number(selectedReport.receipt_count || 0)) : '');
  }, [dailyReportsByDate, selectedDate]);

  const selectedDayReport = dailyReportsByDate.get(selectedDate) || null;
  const targetAmount = Number(monthTarget?.target_amount || 0);
  const dailyTargetAmount = monthContext.dayCount > 0 ? targetAmount / monthContext.dayCount : 0;
  const selectedDaySalesAmount = Number(salesAmountInput || 0);
  const apcPreview = calculateApc(salesAmountInput, receiptCountInput);
  const selectedDayAchievement = calculateAchievementPercentage(selectedDaySalesAmount, dailyTargetAmount);
  const totals = useMemo(
    () =>
      dailyReports.reduce(
        (accumulator, item) => {
          accumulator.sales += Number(item.sales_amount || 0);
          accumulator.receipts += Number(item.receipt_count || 0);
          return accumulator;
        },
        { sales: 0, receipts: 0 },
      ),
    [dailyReports],
  );

  const remainingTarget = Math.max(targetAmount - totals.sales, 0);
  const progressPercentage = targetAmount > 0 ? Math.min((totals.sales / targetAmount) * 100, 100) : 0;
  const monthlyApc = calculateApc(totals.sales, totals.receipts);

  async function handleSaveTarget(event) {
    event.preventDefault();

    try {
      assertPermission(canManageSalesReports, 'Role Anda hanya punya akses baca untuk laporan sales.');
      setSavingTarget(true);

      await upsertSalesMonthTarget({
        month_start: monthContext.monthStart,
        target_amount: Number(targetAmountInput || 0),
      });

      await loadSalesData();
      showToast({
        type: 'success',
        title: 'Target sales tersimpan',
        message: `Target sales untuk ${monthContext.monthLabel} berhasil diperbarui.`,
      });
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Gagal menyimpan target sales',
        message: getSalesPageErrorMessage(error),
      });
    } finally {
      setSavingTarget(false);
    }
  }

  async function handleSaveDailySales(event) {
    event.preventDefault();

    try {
      assertPermission(canManageSalesReports, 'Role Anda hanya punya akses baca untuk laporan sales.');
      setSavingDailyReport(true);

      await upsertDailySalesReport({
        date: selectedDate,
        sales_amount: Number(salesAmountInput || 0),
        receipt_count: Number(receiptCountInput || 0),
      });

      await loadSalesData();
      showToast({
        type: 'success',
        title: 'Sales harian tersimpan',
        message: `Data sales untuk ${selectedDate} berhasil diperbarui dan APC dihitung otomatis.`,
      });
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Gagal menyimpan sales harian',
        message: getSalesPageErrorMessage(error),
      });
    } finally {
      setSavingDailyReport(false);
    }
  }

  async function handleDeleteDailySales() {
    if (!selectedDayReport) {
      setIsDeleteDialogOpen(false);
      return;
    }

    try {
      assertPermission(canManageSalesReports, 'Role Anda hanya punya akses baca untuk laporan sales.');
      setDeletingDailyReport(true);

      await deleteDailySalesReport(selectedDate);

      await loadSalesData();
      setIsDeleteDialogOpen(false);
      showToast({
        type: 'success',
        title: 'Sales harian dihapus',
        message: `Data sales untuk ${selectedDate} berhasil dikosongkan.`,
      });
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Gagal menghapus sales harian',
        message: getSalesPageErrorMessage(error),
      });
    } finally {
      setDeletingDailyReport(false);
    }
  }

  function handleDailyDateChange(event) {
    const nextDate = event.target.value;

    if (!nextDate) {
      return;
    }

    setSelectedMonth(getMonthValueFromDateKey(nextDate));
    setSelectedDate(nextDate);
  }

  function handleMonthChange(event) {
    const nextMonth = event.target.value;

    if (!nextMonth) {
      return;
    }

    setSelectedMonth(nextMonth);
  }

  function handleMonthShift(offset) {
    setSelectedMonth((currentMonth) => shiftMonthValue(currentMonth, offset));
  }

  function handleSelectCalendarDate(dateKey) {
    setSelectedMonth(getMonthValueFromDateKey(dateKey));
    setSelectedDate(dateKey);
  }

  return (
    <div>
      <PageHeader
        description="Atur target sales bulanan, input penjualan harian, dan pantau sales, struk, serta APC."
        title="Laporan Sales"
      />

      {loading ? (
        <div className="surface flex min-h-[260px] items-center justify-center">
          <Spinner label="Mengambil laporan sales..." />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="surface p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-lg font-semibold text-slate-900">Periode Laporan</p>
                <p className="mt-1 text-sm text-slate-500">Pilih bulan untuk lihat atau lengkapi data sales bulan sebelumnya.</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <Button className="h-[46px] w-full sm:w-auto" disabled={isMonthNavigationDisabled} onClick={() => handleMonthShift(-1)} variant="secondary">
                  Bulan Sebelumnya
                </Button>
                <Input
                  className="sm:w-[220px]"
                  disabled={isMonthNavigationDisabled}
                  label="Pilih Bulan"
                  onChange={handleMonthChange}
                  type="month"
                  value={selectedMonth}
                />
                <Button className="h-[46px] w-full sm:w-auto" disabled={isMonthNavigationDisabled} onClick={() => handleMonthShift(1)} variant="secondary">
                  Bulan Berikutnya
                </Button>
              </div>
            </div>
          </div>

          {canManageSalesReports ? (
          <div className="surface p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-lg font-semibold text-slate-900">Target Sales Bulanan</p>
                <p className="mt-1 text-sm text-slate-500">Periode {monthContext.monthLabel}</p>
              </div>
              <form className="grid gap-3 sm:grid-cols-[minmax(0,260px),auto] xl:min-w-[460px]" onSubmit={handleSaveTarget}>
                <Input
                  disabled={!canManageSalesReports || savingTarget}
                  inputMode="numeric"
                  label="Target Sales"
                  onChange={(event) => setTargetAmountInput(sanitizeNumberInput(event.target.value))}
                  placeholder="Contoh: 12.000.000"
                  required={canManageSalesReports}
                  type="text"
                  value={formatGroupedNumber(targetAmountInput)}
                />
                <Button className="h-[46px] w-full sm:mt-[30px] sm:w-auto" disabled={!canManageSalesReports || savingTarget} type="submit" variant="brand">
                  {savingTarget ? 'Menyimpan...' : 'Simpan Target'}
                </Button>
              </form>
            </div>

            <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${progressPercentage}%` }} />
            </div>
            <p className="mt-2 text-sm text-slate-500">
              Pencapaian bulan terpilih <span className="font-semibold text-slate-900">{progressPercentage.toFixed(1)}%</span>
            </p>
          </div>

          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard accent="brand" hint={monthContext.monthLabel} label="Target Bulan" value={formatRupiah(targetAmount)} />
            <StatCard accent="green" hint={`Akumulasi penjualan ${monthContext.monthLabel}`} label="Total Penjualan" value={formatRupiah(totals.sales)} />
            <StatCard accent="slate" hint="Total transaksi/struk tersimpan" label="Jumlah Struk" value={totals.receipts} />
            <StatCard accent="red" hint={`Sisa target ${formatRupiah(remainingTarget)}`} label="APC Bulan" value={formatRupiah(monthlyApc)} />
          </div>

          {canManageSalesReports ? (
          <div className="surface p-5">
            <div>
              <p className="text-lg font-semibold text-slate-900">Input Sales Harian</p>
              <p className="mt-1 text-sm text-slate-500">Masukkan nilai penjualan dan jumlah struk. APC akan dihitung otomatis setelah data disimpan.</p>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl bg-slate-50 px-4 py-4">
                <p className="text-sm font-medium text-slate-500">Target Harian Rata-rata</p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{formatRupiah(dailyTargetAmount)}</p>
                <p className="mt-1 text-sm text-slate-500">Dihitung dari target bulan ini dibagi {monthContext.dayCount} hari.</p>
              </div>
              <div className="rounded-3xl bg-emerald-50 px-4 py-4">
                <p className="text-sm font-medium text-emerald-700">Pencapaian Tanggal Terpilih</p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{targetAmount > 0 ? `${selectedDayAchievement.toFixed(1)}%` : '-'}</p>
                <p className="mt-1 text-sm text-emerald-700/80">{formatDate(selectedDate)} dibanding target harian rata-rata.</p>
              </div>
            </div>

            <form className="mt-4 grid gap-4 xl:grid-cols-[180px,minmax(0,1fr),220px,220px,auto] xl:items-end" onSubmit={handleSaveDailySales}>
              <Input
                disabled={isDailyReportMutating}
                label="Tanggal"
                max={monthContext.monthEnd}
                min={monthContext.monthStart}
                onChange={handleDailyDateChange}
                required
                type="date"
                value={selectedDate}
              />
              <Input
                disabled={!canManageSalesReports || isDailyReportMutating}
                inputMode="numeric"
                label="Nilai Penjualan"
                onChange={(event) => setSalesAmountInput(sanitizeNumberInput(event.target.value))}
                placeholder="Contoh: 850.000"
                required
                type="text"
                value={formatGroupedNumber(salesAmountInput)}
              />
              <Input
                disabled={!canManageSalesReports || isDailyReportMutating}
                label="Jumlah Struk"
                min="0"
                onChange={(event) => setReceiptCountInput(sanitizeNumberInput(event.target.value))}
                required
                type="number"
                value={receiptCountInput}
              />
              <Input label="APC" readOnly value={formatRupiah(apcPreview)} />
              <Button className="h-[46px] w-full xl:w-auto" disabled={!canManageSalesReports || isDailyReportMutating} type="submit" variant="brand">
                {savingDailyReport ? 'Menyimpan...' : selectedDayReport ? 'Perbarui Sales' : 'Simpan Sales'}
              </Button>
            </form>

            {selectedDayReport ? (
              <div className="mt-3 flex flex-col gap-3 rounded-3xl border border-red-100 bg-red-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-red-700">Perlu kosongkan tanggal ini?</p>
                  <p className="mt-1 text-sm text-red-700/80">Hapus data jika tanggal terpilih salah input agar dashboard tidak menghitung tanggal ini sebagai hari yang sudah terisi.</p>
                </div>
                <Button
                  className="w-full sm:w-auto"
                  disabled={!canManageSalesReports || isDailyReportMutating}
                  onClick={() => setIsDeleteDialogOpen(true)}
                  variant="danger"
                >
                  {deletingDailyReport ? 'Menghapus...' : 'Hapus Sales'}
                </Button>
              </div>
            ) : null}
          </div>
          ) : null}

          <div className="surface p-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-lg font-semibold text-slate-900">Kalender Sales Bulanan</p>
                <p className="mt-1 text-sm text-slate-500">Tiap tanggal menyimpan Nilai Penjualan, Jumlah Struk, dan APC pada bulan yang sedang dipilih.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button className="h-[40px]" disabled={isMonthNavigationDisabled} onClick={() => handleMonthShift(-1)} size="sm" variant="secondary">
                  Sebelumnya
                </Button>
                <p className="text-sm text-slate-500">Periode {monthContext.monthLabel}</p>
                <Button className="h-[40px]" disabled={isMonthNavigationDisabled} onClick={() => handleMonthShift(1)} size="sm" variant="secondary">
                  Berikutnya
                </Button>
              </div>
            </div>

            <div className="mt-4 space-y-3 md:hidden">
              {currentMonthDays.map((day) => {
                const report = dailyReportsByDate.get(day.date);
                const isSelected = day.date === selectedDate;
                const dailyAchievement = calculateAchievementPercentage(report?.sales_amount || 0, dailyTargetAmount);
                const cardClassName = cn(
                  'w-full rounded-3xl border p-4 text-left transition',
                  report ? 'border-emerald-200 bg-emerald-50/70' : 'border-slate-200 bg-white',
                  isSelected ? 'border-brand-300 ring-2 ring-brand-100' : '',
                  day.isToday ? 'shadow-soft' : '',
                  !isMonthNavigationDisabled ? 'hover:border-brand-200 hover:bg-brand-50/40' : '',
                );

                return (
                  <button
                    className={cardClassName}
                    disabled={isMonthNavigationDisabled}
                    key={day.date}
                    onClick={() => handleSelectCalendarDate(day.date)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-slate-900">{formatDate(day.date)}</p>
                        <p className="mt-1 text-sm text-slate-500">Tanggal {day.dayNumber} {monthContext.monthLabel}</p>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        {report ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Tersimpan</span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">Belum input</span>
                        )}
                        {day.isToday ? (
                          <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700">Hari ini</span>
                        ) : null}
                      </div>
                    </div>

                    {report ? (
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-white/80 px-3 py-3">
                          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">Penjualan</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">{formatRupiah(report.sales_amount)}</p>
                        </div>
                        <div className="rounded-2xl bg-white/80 px-3 py-3">
                          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">Struk</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">{report.receipt_count}</p>
                        </div>
                        <div className="rounded-2xl bg-white/80 px-3 py-3">
                          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">APC</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">{formatRupiah(report.apc)}</p>
                        </div>
                        <div className="rounded-2xl bg-white/80 px-3 py-3">
                          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">Pencapaian</p>
                          <p className={cn('mt-1 text-sm font-semibold', dailyAchievement >= 100 ? 'text-emerald-700' : 'text-slate-900')}>
                            {targetAmount > 0 ? `${dailyAchievement.toFixed(1)}%` : '-'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-2xl bg-slate-50 px-3 py-4 text-center text-sm text-slate-400">
                        Belum ada input untuk tanggal ini.
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 hidden overflow-x-auto md:block">
              <div className="min-w-[980px]">
                <div className="grid grid-cols-7 gap-3">
                  {WEEKDAY_LABELS.map((label) => (
                    <div className="rounded-2xl bg-slate-50 px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.16em] text-slate-500" key={label}>
                      {label}
                    </div>
                  ))}
                </div>

                <div className="mt-3 grid grid-cols-7 gap-3">
                  {calendarDays.map((day) => {
                    const report = dailyReportsByDate.get(day.date);
                    const isSelected = day.date === selectedDate;
                    const dailyAchievement = calculateAchievementPercentage(report?.sales_amount || 0, dailyTargetAmount);
                    const cardClassName = cn(
                      'min-h-[184px] rounded-3xl border p-3 text-left transition',
                      day.isCurrentMonth ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50/70 text-slate-300',
                      day.isCurrentMonth && report ? 'border-emerald-200 bg-emerald-50/70' : '',
                      day.isCurrentMonth && isSelected && report ? 'border-brand-300 bg-gradient-to-br from-brand-50 to-emerald-50 ring-2 ring-brand-100' : '',
                      day.isCurrentMonth && isSelected && !report ? 'border-brand-300 ring-2 ring-brand-100 bg-brand-50/40' : '',
                      day.isCurrentMonth && day.isToday ? 'shadow-soft' : '',
                      !isMonthNavigationDisabled ? 'cursor-pointer hover:border-brand-200 hover:bg-brand-50/40' : '',
                    );

                    const content = (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <span className={cn('text-sm font-semibold', day.isCurrentMonth ? 'text-slate-900' : 'text-slate-300')}>
                            {day.dayNumber}
                          </span>
                          <div className="flex flex-wrap items-center justify-end gap-1">
                            {report && day.isCurrentMonth ? (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Tersimpan</span>
                            ) : null}
                            {day.isToday && day.isCurrentMonth ? (
                              <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700">Hari ini</span>
                            ) : null}
                          </div>
                        </div>

                        {day.isCurrentMonth ? (
                          report ? (
                            <div className="mt-4 space-y-2">
                              <div>
                                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">Penjualan</p>
                                <p className="mt-1 text-sm font-semibold text-slate-900">{formatRupiah(report.sales_amount)}</p>
                              </div>
                              <div>
                                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">Jumlah Struk</p>
                                <p className="mt-1 text-sm font-semibold text-slate-900">{report.receipt_count}</p>
                              </div>
                              <div>
                                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">APC</p>
                                <p className="mt-1 text-sm font-semibold text-slate-900">{formatRupiah(report.apc)}</p>
                              </div>
                              <div>
                                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">Pencapaian</p>
                                <p className={cn('mt-1 text-sm font-semibold', dailyAchievement >= 100 ? 'text-emerald-700' : 'text-slate-900')}>
                                  {targetAmount > 0 ? `${dailyAchievement.toFixed(1)}%` : '-'}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-8 rounded-2xl bg-slate-50 px-3 py-4 text-center text-sm text-slate-400">
                              Belum ada input
                            </div>
                          )
                        ) : null}
                      </>
                    );

                    if (isMonthNavigationDisabled) {
                      return (
                        <div className={cardClassName} key={day.date}>
                          {content}
                        </div>
                      );
                    }

                    return (
                      <button className={cardClassName} key={day.date} onClick={() => handleSelectCalendarDate(day.date)} type="button">
                        {content}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        confirmLabel="Hapus Sales"
        description={`Data sales pada ${formatDate(selectedDate)} akan dihapus dan tanggal ini kembali kosong di kalender serta dashboard.`}
        isOpen={isDeleteDialogOpen}
        loading={deletingDailyReport}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteDailySales}
        title="Hapus data sales harian?"
      />
    </div>
  );
}

export default SalesReportsPage;





