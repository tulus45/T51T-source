import { supabase, supabaseProjectRef } from '../lib/supabaseClient';

function toNumber(value = 0) {
  return Number(value || 0);
}

function formatDateLabel(value) {
  if (!value) {
    return '';
  }

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`));
}

function formatMonthLabel(value) {
  if (!value) {
    return '';
  }

  return new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${value.slice(0, 10)}T00:00:00`));
}

function getDashboardServiceErrorMessage(error, fallback = 'Gagal mengambil ringkasan dashboard.') {
  const message = String(error?.message || '');

  if (message.includes('get_dashboard_summary')) {
    return `Database Supabase belum diupdate atau schema cache belum refresh pada project ${supabaseProjectRef || 'aktif'}. Jalankan file supabase/dashboard_summary_rpc.sql di SQL Editor project itu, tunggu beberapa detik, lalu refresh aplikasi. Jika masih sama, jalankan SQL: NOTIFY pgrst, 'reload schema';`;
  }

  return message || fallback;
}

function mapProjection(projection) {
  if (!projection) {
    return null;
  }

  return {
    latestInputDate: projection.latestInputDate || null,
    latestInputDateLabel: formatDateLabel(projection.latestInputDate),
    monthLabel: formatMonthLabel(projection.latestInputDate),
    previousComparableDate: projection.previousComparableDate || null,
    previousComparableDateLabel: formatDateLabel(projection.previousComparableDate),
    spd: toNumber(projection.spd),
    spdLm: toNumber(projection.spdLm),
    spdDelta: toNumber(projection.spdDelta),
    dayCountInMonth: Number(projection.dayCountInMonth || 0),
    projectionValue: toNumber(projection.projectionValue),
    currentReceiptCount: Number(projection.currentReceiptCount || 0),
    previousReceiptCount: Number(projection.previousReceiptCount || 0),
    receiptDelta: Number(projection.receiptDelta || 0),
    currentApc: toNumber(projection.currentApc),
    previousApc: toNumber(projection.previousApc),
    apcDelta: toNumber(projection.apcDelta),
  };
}

function mapMtdComparison(comparison) {
  if (!comparison) {
    return null;
  }

  return {
    latestInputDate: comparison.latestInputDate || null,
    latestInputDateLabel: formatDateLabel(comparison.latestInputDate),
    previousComparableDate: comparison.previousComparableDate || null,
    previousComparableDateLabel: formatDateLabel(comparison.previousComparableDate),
    currentMtdSales: toNumber(comparison.currentMtdSales),
    previousMtdSales: toNumber(comparison.previousMtdSales),
    currentMtdReceipts: Number(comparison.currentMtdReceipts || 0),
    previousMtdReceipts: Number(comparison.previousMtdReceipts || 0),
    currentMtdApc: toNumber(comparison.currentMtdApc),
    previousMtdApc: toNumber(comparison.previousMtdApc),
  };
}

function mapScheduleItem(item = {}) {
  return {
    id: item.id || null,
    employeeName: item.employeeName || 'Pegawai',
    employeePosition: item.employeePosition || '-',
    photoUrl: item.photoUrl || null,
    shiftType: item.shiftType || null,
    startTime: item.startTime || null,
    endTime: item.endTime || null,
  };
}

function mapTodaySchedules(todaySchedules) {
  if (!todaySchedules) {
    return null;
  }

  return {
    date: todaySchedules.date || null,
    dateLabel: formatDateLabel(todaySchedules.date),
    morning: Array.isArray(todaySchedules.morning) ? todaySchedules.morning.map(mapScheduleItem) : [],
    afternoon: Array.isArray(todaySchedules.afternoon) ? todaySchedules.afternoon.map(mapScheduleItem) : [],
    off: Array.isArray(todaySchedules.off) ? todaySchedules.off.map(mapScheduleItem) : [],
  };
}

function mapProjectionAnalysis(analysis) {
  if (!analysis) {
    return null;
  }

  return {
    headline: analysis.headline || 'Projection belum bisa dianalisa.',
    driverLabel: analysis.driverLabel || 'Driver belum terbaca',
    analysisPoints: Array.isArray(analysis.analysisPoints) ? analysis.analysisPoints : [],
    recommendationPoints: Array.isArray(analysis.recommendationPoints) ? analysis.recommendationPoints : [],
  };
}

export async function getDashboardSummary() {
  const { data, error } = await supabase.rpc('get_dashboard_summary');

  if (error) {
    throw new Error(getDashboardServiceErrorMessage(error));
  }

  const salesSummary = data?.salesSummary || {};

  return {
    totalEmployees: Number(data?.totalEmployees || 0),
    totalIncome: toNumber(data?.totalIncome),
    totalExpense: toNumber(data?.totalExpense),
    balance: toNumber(data?.balance),
    salesSummary: {
      monthStart: salesSummary.monthStart || null,
      monthLabel: formatMonthLabel(salesSummary.monthStart),
      targetAmount: toNumber(salesSummary.targetAmount),
      totalSales: toNumber(salesSummary.totalSales),
      receiptCount: Number(salesSummary.receiptCount || 0),
      monthlyApc: toNumber(salesSummary.monthlyApc),
      remainingTarget: toNumber(salesSummary.remainingTarget),
    },
    projections: {
      salesProjection: mapProjection(data?.projections?.salesProjection),
      receiptImpactProjection: mapProjection(data?.projections?.receiptImpactProjection),
      apcImpactProjection: mapProjection(data?.projections?.apcImpactProjection),
    },
    mtdComparison: mapMtdComparison(data?.mtdComparison),
    projectionAnalysis: mapProjectionAnalysis(data?.projectionAnalysis),
    todaySchedules: mapTodaySchedules(data?.todaySchedules),
  };
}
