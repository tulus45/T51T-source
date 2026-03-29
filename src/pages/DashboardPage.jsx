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
  const receiptImpactProjection = summary?.projections?.receiptImpactProjection || null;
  const apcImpactProjection = summary?.projections?.apcImpactProjection || null;
  const mtdComparison = summary?.mtdComparison || null;
  const projectionAnalysis = summary?.projectionAnalysis || null;
  const todaySchedules = summary?.todaySchedules || null;
  const latestSalesLabel = salesProjection?.latestInputDateLabel || summary?.salesSummary?.monthLabel || '';

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
              hint={mtdComparison ? `LM s/d ${mtdComparison.previousComparableDateLabel}: ${formatRupiah(mtdComparison.previousMtdSales)}` : `Akumulasi penjualan s/d ${latestSalesLabel}`.trim()}
              label="MTD Sales"
              value={formatRupiah(summary?.salesSummary?.totalSales || 0)}
            />
            <StatCard
              accent="slate"
              hint={mtdComparison ? `LM s/d ${mtdComparison.previousComparableDateLabel}: ${mtdComparison.previousMtdReceipts}` : `Total transaksi/struk s/d ${latestSalesLabel}`.trim()}
              label="MTD Struk"
              value={summary?.salesSummary?.receiptCount || 0}
            />
            <StatCard
              accent="red"
              hint={mtdComparison ? `LM s/d ${mtdComparison.previousComparableDateLabel}: ${formatRupiah(mtdComparison.previousMtdApc)}` : `Sisa target ${formatRupiah(summary?.salesSummary?.remainingTarget || 0)}`}
              label="MTD APC"
              value={formatRupiah(summary?.salesSummary?.monthlyApc || 0)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div className="surface bg-gradient-to-br from-sky-600/15 to-cyan-100 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-500">Sales Projection</p>
                  <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                    {salesProjection ? formatRupiah(salesProjection.projectionValue) : '-'}
                  </p>
                </div>
                {salesProjection ? (
                  <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                    {`Per ${salesProjection.latestInputDateLabel}`}
                  </span>
                ) : null}
              </div>

              {salesProjection ? (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 px-3 py-2 text-sm">
                    <span className="text-slate-500">SPD</span>
                    <span className="font-semibold text-slate-900">{formatRupiah(salesProjection.spd)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 px-3 py-2 text-sm">
                    <span className="text-slate-500">SPD LM</span>
                    <span className="font-semibold text-slate-900">{formatRupiah(salesProjection.spdLm)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 px-3 py-2 text-sm">
                    <span className="text-slate-500">Selisih</span>
                    <span className="font-semibold text-slate-900">{formatRupiah(salesProjection.spdDelta)}</span>
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
                  <p className="text-sm font-medium text-slate-500">Receipt Impact Projection</p>
                  <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                    {receiptImpactProjection ? formatRupiah(receiptImpactProjection.projectionValue) : '-'}
                  </p>
                </div>
                {receiptImpactProjection ? (
                  <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                    {`Per ${receiptImpactProjection.latestInputDateLabel}`}
                  </span>
                ) : null}
              </div>

              {receiptImpactProjection ? (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 px-3 py-2 text-sm">
                    <span className="text-slate-500">Jumlah Struk</span>
                    <span className="font-semibold text-slate-900">{receiptImpactProjection.currentReceiptCount}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 px-3 py-2 text-sm">
                    <span className="text-slate-500">Struk LM</span>
                    <span className="font-semibold text-slate-900">{receiptImpactProjection.previousReceiptCount}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 px-3 py-2 text-sm">
                    <span className="text-slate-500">APC</span>
                    <span className="font-semibold text-slate-900">{formatRupiah(receiptImpactProjection.currentApc)}</span>
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
                  <p className="text-sm font-medium text-slate-500">APC Impact Projection</p>
                  <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                    {apcImpactProjection ? formatRupiah(apcImpactProjection.projectionValue) : '-'}
                  </p>
                </div>
                {apcImpactProjection ? (
                  <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                    {`Per ${apcImpactProjection.latestInputDateLabel}`}
                  </span>
                ) : null}
              </div>

              {apcImpactProjection ? (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 px-3 py-2 text-sm">
                    <span className="text-slate-500">APC</span>
                    <span className="font-semibold text-slate-900">{formatRupiah(apcImpactProjection.currentApc)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 px-3 py-2 text-sm">
                    <span className="text-slate-500">APC LM</span>
                    <span className="font-semibold text-slate-900">{formatRupiah(apcImpactProjection.previousApc)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 px-3 py-2 text-sm">
                    <span className="text-slate-500">Jumlah Struk</span>
                    <span className="font-semibold text-slate-900">{apcImpactProjection.currentReceiptCount}</span>
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
                <p className="text-lg font-semibold text-slate-900">Analisa Sales Projection</p>
                <p className="mt-1 text-sm text-slate-500">{projectionAnalysis?.headline || 'Analisa akan muncul setelah data projection tersedia.'}</p>
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
                  <p className="text-sm font-semibold text-slate-900">Analisa</p>
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
                      <span className="text-slate-400">•</span>
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
