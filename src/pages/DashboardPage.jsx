import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import Spinner from '../components/ui/Spinner';
import StatCard from '../components/ui/StatCard';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { getDashboardSummary } from '../services/dashboardService';
import { formatRupiah } from '../utils/formatters';

const shiftAccentClass = {
  pagi: 'from-sky-600/15 to-cyan-100',
  siang: 'from-amber-500/15 to-orange-100',
};

function getDayOfMonth(dateValue) {
  if (!dateValue) {
    return 0;
  }

  return Number(String(dateValue).slice(8, 10) || 0);
}

function getDaysInMonth(dateValue) {
  if (!dateValue) {
    return 0;
  }

  const date = new Date(`${String(dateValue).slice(0, 10)}T00:00:00`);
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function formatSignedRupiah(value = 0) {
  const amount = Number(value || 0);
  const prefix = amount > 0 ? '+' : amount < 0 ? '-' : '';
  return `${prefix}${formatRupiah(Math.abs(amount))}`;
}

function formatSignedPercentage(value = 0) {
  const amount = Number(value || 0);
  const prefix = amount > 0 ? '+' : amount < 0 ? '-' : '';
  return `${prefix}${Math.abs(amount).toFixed(1)}%`;
}

function formatPercentage(value = 0) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function formatAverageCount(value = 0) {
  const amount = Number(value || 0);
  const hasFraction = Math.abs(amount % 1) > 0.001;

  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: hasFraction ? 1 : 0,
    maximumFractionDigits: 1,
  }).format(amount);
}

function ShiftScheduleCard({ title, shiftKey, schedules = [] }) {
  return (
    <div className={`surface bg-gradient-to-br ${shiftAccentClass[shiftKey] || shiftAccentClass.pagi} p-4 sm:p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-slate-900">{title}</p>
          <p className="mt-1 text-sm text-slate-500">
            {schedules.length ? `${schedules.length} pegawai terjadwal` : `Belum ada jadwal ${title.toLowerCase()} hari ini.`}
          </p>
        </div>
        <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
          {schedules.length} orang
        </span>
      </div>

      {schedules.length ? (
        <div className="mt-4 space-y-3">
          {schedules.map((item) => (
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 px-4 py-3" key={item.id || `${item.employeeName}-${item.startTime || 'na'}`}>
              <div className="flex min-w-0 items-center gap-3">
                {item.photoUrl ? (
                  <img alt={item.employeeName} className="h-11 w-11 rounded-2xl object-cover" src={item.photoUrl} />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-200 text-sm font-semibold uppercase text-slate-600">
                    {item.employeeName.slice(0, 1)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{item.employeeName}</p>
                  <p className="truncate text-xs text-slate-500">{item.employeePosition || 'Posisi belum diatur'}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl bg-white/70 px-4 py-5 text-sm text-slate-500">
          Belum ada pegawai yang dijadwalkan pada {title.toLowerCase()} hari ini.
        </div>
      )}
    </div>
  );
}

function DashboardPage() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const salesProjection = summary?.projections?.salesProjection || null;
  const mtdComparison = summary?.mtdComparison || null;
  const projectionAnalysis = summary?.projectionAnalysis || null;
  const todaySchedules = summary?.todaySchedules || null;
  const targetAmount = summary?.salesSummary?.targetAmount || 0;
  const currentMtdSales = summary?.salesSummary?.totalSales || 0;
  const currentMtdReceipts = mtdComparison?.currentMtdReceipts ?? summary?.salesSummary?.receiptCount ?? 0;
  const previousMtdSales = mtdComparison?.previousMtdSales || 0;
  const previousMtdReceipts = mtdComparison?.previousMtdReceipts || 0;
  const latestSalesDate = mtdComparison?.latestInputDate || salesProjection?.latestInputDate || null;
  const previousComparableDate = mtdComparison?.previousComparableDate || salesProjection?.previousComparableDate || null;
  const latestSalesLabel = mtdComparison?.latestInputDateLabel || salesProjection?.latestInputDateLabel || summary?.salesSummary?.monthLabel || '';
  const latestInputDay = getDayOfMonth(latestSalesDate);
  const previousComparableDay = getDayOfMonth(previousComparableDate);
  const averageDailySales = latestInputDay > 0 ? currentMtdSales / latestInputDay : 0;
  const previousAverageDailySales = previousComparableDay > 0 ? previousMtdSales / previousComparableDay : 0;
  const averageDailySalesDelta = averageDailySales - previousAverageDailySales;
  const averageDailySalesGrowth = previousAverageDailySales > 0 ? (averageDailySalesDelta / previousAverageDailySales) * 100 : null;
  const averageDailyReceipts = latestInputDay > 0 ? currentMtdReceipts / latestInputDay : 0;
  const previousAverageDailyReceipts = previousComparableDay > 0 ? previousMtdReceipts / previousComparableDay : 0;
  const averageDailyReceiptDelta = averageDailyReceipts - previousAverageDailyReceipts;
  const currentMtdApc = currentMtdReceipts > 0 ? currentMtdSales / currentMtdReceipts : 0;
  const previousMtdApc = previousMtdReceipts > 0 ? previousMtdSales / previousMtdReceipts : 0;
  const averageDailyApcDelta = currentMtdApc - previousMtdApc;
  const daysInMonth = getDaysInMonth(summary?.salesSummary?.monthStart) || Number(salesProjection?.dayCountInMonth || 0);
  const averageDailyTarget = daysInMonth > 0 ? targetAmount / daysInMonth : 0;
  const averageDailyTargetGap = averageDailySales - averageDailyTarget;
  const mtdTargetAmount = daysInMonth > 0 && latestInputDay > 0 ? (targetAmount / daysInMonth) * latestInputDay : 0;
  const salesAchievementPercentage = targetAmount > 0 ? (currentMtdSales / targetAmount) * 100 : null;
  const salesTargetBalance = currentMtdSales - targetAmount;
  const salesProgressHint =
    salesAchievementPercentage === null
      ? `Akumulasi penjualan s/d ${latestSalesLabel}`.trim()
      : `${formatPercentage(salesAchievementPercentage)} target tercapai | ${salesTargetBalance >= 0 ? `lebih ${formatRupiah(salesTargetBalance)}` : `kurang ${formatRupiah(Math.abs(salesTargetBalance))}`}`;
  const currentApcValue = currentMtdReceipts > 0 ? currentMtdApc : 0;
  const hasCurrentApcData = currentMtdReceipts > 0;
  const hasAverageDailySalesData = latestInputDay > 0;
  const hasPreviousAverageDailySalesData = previousComparableDay > 0;
  const hasProjectionComparisonData = hasAverageDailySalesData && hasPreviousAverageDailySalesData;
  const projectionInputDays = latestInputDay;
  const salesProjectionValue = hasProjectionComparisonData ? (previousAverageDailySales - averageDailySales) * projectionInputDays : null;
  const receiptImpactProjectionValue = hasProjectionComparisonData ? averageDailyReceiptDelta * currentMtdApc * projectionInputDays * -1 : null;
  const apcImpactProjectionValue = hasProjectionComparisonData ? (previousMtdApc - currentMtdApc) * averageDailyReceipts * projectionInputDays : null;

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        const data = await getDashboardSummary();
        setSummary(data);
      } catch (error) {
        showToast({
          type: 'error',
          title: 'Dashboard gagal dimuat',
          message: error.message,
        });
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [showToast]);

  return (
    <div>
      <PageHeader
        description={`Ringkasan operasional toko untuk ${profile?.full_name || 'pengguna aktif'} dengan akses sesuai role ${profile?.role}.`}
        title="Dashboard"
      />

      {loading ? (
        <div className="surface flex min-h-[240px] items-center justify-center">
          <Spinner label="Mengambil ringkasan toko..." />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard accent="brand" hint={summary?.salesSummary?.monthLabel} label="Target Bulan" value={formatRupiah(summary?.salesSummary?.targetAmount || 0)} />
            <StatCard
              accent="green"
              hint={salesProgressHint}
              label="Akumulasi Sales Berjalan"
              value={formatRupiah(summary?.salesSummary?.totalSales || 0)}
            />
            <StatCard
              accent="slate"
              hint={mtdComparison ? `LM s/d ${mtdComparison.previousComparableDateLabel}: ${mtdComparison.previousMtdReceipts}` : `Total transaksi/struk s/d ${latestSalesLabel}`.trim()}
              label="Akumulasi STD Berjalan"
              value={summary?.salesSummary?.receiptCount || 0}
            />
            <StatCard
              accent="red"
              hint=""
              label="APC Aktual"
              value={hasCurrentApcData ? formatRupiah(currentApcValue) : '-'}
            />
          </div>

          <div className="surface overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.14),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.18),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.95),rgba(248,250,252,0.98))] p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-lg font-semibold text-slate-900">SPD Rata-rata berjalan</p>
                <p className="mt-1 text-sm text-slate-500">
                  {hasAverageDailySalesData
                    ? `Dihitung ulang dari akumulasi sales berjalan dibagi ${latestInputDay} hari input sampai ${latestSalesLabel || 'tanggal input terakhir'}.`
                    : 'SPD rata-rata berjalan akan muncul setelah ada input sales harian.'}
                </p>
              </div>
              {latestSalesLabel ? (
                <span className="inline-flex rounded-full bg-white/85 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                  {`Per ${latestSalesLabel}`}
                </span>
              ) : null}
            </div>

            {hasAverageDailySalesData ? (
              <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.4fr),repeat(3,minmax(0,1fr))]">
                <div className="rounded-3xl bg-white/85 p-4 shadow-sm ring-1 ring-white/70 sm:p-5">
                  <p className="text-sm font-medium text-slate-500">SPD Berjalan</p>
                  <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{formatRupiah(averageDailySales)}</p>
                  <p className="mt-2 text-sm text-slate-500">
                    {latestInputDay > 0
                      ? `${formatRupiah(currentMtdSales)} dibagi ${latestInputDay} hari input pada ${summary?.salesSummary?.monthLabel || 'bulan berjalan'}.`
                      : 'Menunggu jumlah hari input untuk menghitung ulang SPD.'}
                  </p>
                </div>

                <div className="rounded-3xl bg-sky-50/90 px-4 py-4">
                  <p className="text-sm font-medium text-sky-800">SPD Bulan Lalu</p>
                  <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{hasPreviousAverageDailySalesData ? formatRupiah(previousAverageDailySales) : '-'}</p>
                  <p className="mt-1 text-sm text-sky-800/80">
                    {hasPreviousAverageDailySalesData && mtdComparison?.previousComparableDateLabel
                      ? `${formatRupiah(previousMtdSales)} dibagi ${previousComparableDay} hari input sampai ${mtdComparison.previousComparableDateLabel}`
                      : 'Pembanding bulan lalu belum tersedia'}
                  </p>
                </div>

                <div className="rounded-3xl bg-emerald-50/90 px-4 py-4">
                  <p className="text-sm font-medium text-emerald-700">Selisih vs LM</p>
                  <p className={`mt-2 text-2xl font-bold tracking-tight ${averageDailySalesDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {hasPreviousAverageDailySalesData ? formatSignedRupiah(averageDailySalesDelta) : '-'}
                  </p>
                  <p className={`mt-1 text-sm ${averageDailySalesGrowth === null ? 'text-slate-500' : averageDailySalesGrowth >= 0 ? 'text-emerald-700/80' : 'text-rose-700/80'}`}>
                    {averageDailySalesGrowth === null ? 'Belum ada pembanding persentase' : `${formatSignedPercentage(averageDailySalesGrowth)} dibanding SPD bulan lalu hasil hitung ulang`}
                  </p>
                </div>

                <div className="rounded-3xl bg-amber-50/90 px-4 py-4">
                  <p className="text-sm font-medium text-amber-700">Sales Net vs Target</p>
                  <p className={`mt-2 text-2xl font-bold tracking-tight ${averageDailyTargetGap >= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {averageDailyTarget > 0 ? formatSignedRupiah(averageDailyTargetGap) : '-'}
                  </p>
                  <p className="mt-1 text-sm text-amber-700/80">
                    {averageDailyTarget > 0 ? `Target harian rata-rata ${formatRupiah(averageDailyTarget)}` : 'Target harian belum tersedia'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-3xl bg-white/75 px-4 py-4 text-sm text-slate-500">
                Belum ada data sales harian untuk menghitung SPD rata-rata berjalan.
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div className="surface bg-gradient-to-br from-sky-600/15 to-cyan-100 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-500">Hutang Sales</p>
                  <p className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                    {hasProjectionComparisonData ? formatRupiah(salesProjectionValue) : '-'}
                  </p>
                </div>
                {latestSalesLabel ? (
                  <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                    {`Per ${latestSalesLabel}`}
                  </span>
                ) : null}
              </div>

              {hasAverageDailySalesData ? (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 px-3 py-2 text-sm">
                    <span className="text-slate-500">SPD Berjalan</span>
                    <span className="font-semibold text-slate-900">{formatRupiah(averageDailySales)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 px-3 py-2 text-sm">
                    <span className="text-slate-500">SPD Bulan Lalu</span>
                    <span className="font-semibold text-slate-900">{hasPreviousAverageDailySalesData ? formatRupiah(previousAverageDailySales) : '-'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 px-3 py-2 text-sm">
                    <span className="text-slate-500">Selisih SPD</span>
                    <span className="font-semibold text-slate-900">{hasPreviousAverageDailySalesData ? formatSignedRupiah(averageDailySalesDelta) : '-'}</span>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl bg-white/70 px-4 py-3 text-sm text-slate-500">
                  Belum ada data sales harian untuk menghitung projection.
                </div>
              )}
            </div>

            <div className="surface bg-gradient-to-br from-amber-500/15 to-orange-100 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p aria-hidden="true" className="text-sm font-medium invisible">
                    Projection
                  </p>
                  <p className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                    {hasProjectionComparisonData ? formatRupiah(receiptImpactProjectionValue) : '-'}
                  </p>
                </div>
                {latestSalesLabel ? (
                  <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                    {`Per ${latestSalesLabel}`}
                  </span>
                ) : null}
              </div>

              {hasAverageDailySalesData ? (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 px-3 py-2 text-sm">
                    <span className="text-slate-500">STD Berjalan</span>
                    <span className="font-semibold text-slate-900">{formatAverageCount(averageDailyReceipts)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 px-3 py-2 text-sm">
                    <span className="text-slate-500">STD Bulan lalu</span>
                    <span className="font-semibold text-slate-900">{hasPreviousAverageDailySalesData ? formatAverageCount(previousAverageDailyReceipts) : '-'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 px-3 py-2 text-sm">
                    <span className="text-slate-500">APC Berjalan</span>
                    <span className="font-semibold text-slate-900">{currentMtdReceipts > 0 ? formatRupiah(currentMtdApc) : '-'}</span>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl bg-white/70 px-4 py-3 text-sm text-slate-500">
                  Belum ada data struk untuk menghitung projection.
                </div>
              )}
            </div>

            <div className="surface bg-gradient-to-br from-emerald-500/15 to-lime-100 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p aria-hidden="true" className="text-sm font-medium invisible">
                    Projection
                  </p>
                  <p className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                    {hasProjectionComparisonData ? formatRupiah(apcImpactProjectionValue) : '-'}
                  </p>
                </div>
                {latestSalesLabel ? (
                  <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                    {`Per ${latestSalesLabel}`}
                  </span>
                ) : null}
              </div>

              {hasAverageDailySalesData ? (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 px-3 py-2 text-sm">
                    <span className="text-slate-500">APC Berjalan</span>
                    <span className="font-semibold text-slate-900">{currentMtdReceipts > 0 ? formatRupiah(currentMtdApc) : '-'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 px-3 py-2 text-sm">
                    <span className="text-slate-500">APC Bulan lalu</span>
                    <span className="font-semibold text-slate-900">{previousMtdReceipts > 0 ? formatRupiah(previousMtdApc) : '-'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 px-3 py-2 text-sm">
                    <span className="text-slate-500">STD Berjalan</span>
                    <span className="font-semibold text-slate-900">{formatAverageCount(averageDailyReceipts)}</span>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl bg-white/70 px-4 py-3 text-sm text-slate-500">
                  Belum ada data APC untuk menghitung projection.
                </div>
              )}
            </div>
          </div>

          <div className="surface p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-lg font-semibold text-slate-900">Analisis Hutang Sales</p>
                <p className="mt-1 text-sm text-slate-500">{projectionAnalysis?.headline || 'Analisis akan muncul setelah data hutang sales tersedia.'}</p>
              </div>
              {projectionAnalysis ? (
                <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {projectionAnalysis.driverLabel}
                </span>
              ) : null}
            </div>

            {projectionAnalysis ? (
              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                <div className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">Analisis</p>
                  <ul className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
                    {projectionAnalysis.analysisPoints.map((point) => (
                      <li className="flex gap-3" key={point}>
                        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-3xl bg-emerald-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">Rekomendasi</p>
                  <ul className="mt-3 space-y-3 text-sm leading-6 text-slate-700">
                    {projectionAnalysis.recommendationPoints.map((point) => (
                      <li className="flex gap-3" key={point}>
                        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}
          </div>

          <div className="surface p-4 sm:p-5">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-lg font-semibold text-slate-900">Jadwal Pegawai Hari Ini</p>
                <p className="mt-1 text-sm text-slate-500">
                  {todaySchedules ? `Jadwal aktif untuk ${todaySchedules.dateLabel}.` : 'Jadwal hari ini belum tersedia.'}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <ShiftScheduleCard schedules={todaySchedules?.morning || []} shiftKey="pagi" title="Shift Pagi" />
              <ShiftScheduleCard schedules={todaySchedules?.afternoon || []} shiftKey="siang" title="Shift Siang" />
            </div>

            <div className="mt-4 rounded-3xl bg-slate-50 px-4 py-4">
              <p className="text-sm font-semibold text-slate-900">Note Pegawai Libur</p>
              <p className="mt-1 text-sm text-slate-500">
                {todaySchedules?.off?.length
                  ? `${todaySchedules.off.length} pegawai dijadwalkan libur hari ini.`
                  : 'Tidak ada pegawai yang dijadwalkan libur hari ini.'}
              </p>

              {todaySchedules?.off?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {todaySchedules.off.map((item) => (
                    <span
                      className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm text-slate-700 shadow-sm"
                      key={item.id || `${item.employeeName}-libur`}
                    >
                      <span className="font-semibold text-slate-900">{item.employeeName}</span>
                      <span className="text-slate-400">&bull;</span>
                      <span>{item.employeePosition || 'Posisi belum diatur'}</span>
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-lg font-semibold text-slate-900">Kas Tim Toko</p>
              <p className="mt-1 text-sm text-slate-500">Pencatatan kas internal tim toko, bukan kas perusahaan.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard accent="slate" label="Total Pegawai" value={summary?.totalEmployees || 0} />
              <StatCard accent="green" hint="Akumulasi kas masuk internal tim" label="Pemasukan Kas Tim" value={formatRupiah(summary?.totalIncome || 0)} />
              <StatCard accent="red" hint="Akumulasi kas keluar internal tim" label="Pengeluaran Kas Tim" value={formatRupiah(summary?.totalExpense || 0)} />
              <StatCard accent="brand" hint="Kas masuk dikurangi kas keluar tim" label="Saldo Kas Tim" value={formatRupiah(summary?.balance || 0)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DashboardPage;


