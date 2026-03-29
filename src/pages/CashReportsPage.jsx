import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import CashReportFormModal from '../components/cash/CashReportFormModal';
import CashReportMobileList from '../components/cash/CashReportMobileList';
import PageHeader from '../components/PageHeader';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import EmptyState from '../components/ui/EmptyState';
import Select from '../components/ui/Select';
import Spinner from '../components/ui/Spinner';
import StatCard from '../components/ui/StatCard';
import Input from '../components/ui/Input';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../hooks/useToast';
import {
  createCashReport,
  deleteCashReport,
  listCashReports,
  updateCashReport,
} from '../services/cashReportsService';
import { CASH_TYPE_OPTIONS } from '../utils/constants';
import { formatDate, formatRupiah } from '../utils/formatters';
import { assertPermission } from '../utils/permissions';

function CashReportsPage() {
  const { canManageCashReports } = usePermissions();
  const { showToast } = useToast();
  const [cashReports, setCashReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCashReport, setEditingCashReport] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [filters, setFilters] = useState({
    type: 'all',
    dateFrom: '',
    dateTo: '',
  });

  async function loadCashReports() {
    try {
      setLoading(true);
      const data = await listCashReports(filters);
      setCashReports(data);
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Laporan kas gagal dimuat',
        message: error.message,
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCashReports();
  }, [filters.type, filters.dateFrom, filters.dateTo]);

  function handleFilterChange(event) {
    const { name, value } = event.target;
    setFilters((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(form) {
    try {
      assertPermission(canManageCashReports, 'Role Anda hanya punya akses baca untuk laporan kas.');
      setSaving(true);

      const payload = {
        date: form.date,
        type: form.type,
        amount: Number(form.amount || 0),
        category: form.category,
        description: form.description || null,
      };

      if (editingCashReport) {
        await updateCashReport(editingCashReport.id, payload);
      } else {
        await createCashReport(payload);
      }

      await loadCashReports();
      setIsFormOpen(false);
      setEditingCashReport(null);
      showToast({
        type: 'success',
        title: 'Laporan kas tersimpan',
        message: 'Transaksi berhasil diperbarui.',
      });
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Gagal menyimpan laporan kas',
        message: error.message,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) {
      return;
    }

    try {
      assertPermission(canManageCashReports, 'Role Anda hanya punya akses baca untuk laporan kas.');
      setDeleting(true);
      await deleteCashReport(deleteTarget.id);
      await loadCashReports();
      setDeleteTarget(null);
      showToast({
        type: 'success',
        title: 'Laporan kas dihapus',
        message: 'Transaksi berhasil dihapus.',
      });
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Gagal menghapus transaksi',
        message: error.message,
      });
    } finally {
      setDeleting(false);
    }
  }

  const totals = cashReports.reduce(
    (accumulator, item) => {
      if (item.type === 'income') {
        accumulator.income += Number(item.amount || 0);
      } else {
        accumulator.expense += Number(item.amount || 0);
      }

      return accumulator;
    },
    { income: 0, expense: 0 },
  );

  function openCreateModal() {
    setEditingCashReport(null);
    setIsFormOpen(true);
  }

  function openEditModal(item) {
    setEditingCashReport(item);
    setIsFormOpen(true);
  }

  return (
    <div>
      <PageHeader
        actions={canManageCashReports ? (
          <Button className="w-full sm:w-auto" onClick={openCreateModal} variant="brand">
            <Plus className="h-4 w-4" />
            Tambah Transaksi
          </Button>
        ) : null}
        title="Laporan Kas"
      />

      <div className="mb-6 grid gap-4 xl:grid-cols-3">
        <StatCard accent="green" label="Pemasukan" value={formatRupiah(totals.income)} />
        <StatCard accent="red" label="Pengeluaran" value={formatRupiah(totals.expense)} />
        <StatCard accent="brand" label="Saldo" value={formatRupiah(totals.income - totals.expense)} />
      </div>

      <div className="surface mb-6 grid gap-4 p-4 md:grid-cols-3 xl:grid-cols-4">
        <Select
          label="Jenis"
          name="type"
          onChange={handleFilterChange}
          options={[{ value: 'all', label: 'Semua jenis' }, ...CASH_TYPE_OPTIONS]}
          value={filters.type}
        />
        <Input label="Dari Tanggal" name="dateFrom" onChange={handleFilterChange} type="date" value={filters.dateFrom} />
        <Input label="Sampai Tanggal" name="dateTo" onChange={handleFilterChange} type="date" value={filters.dateTo} />
        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500 md:self-end">
          Total transaksi tersaring: <span className="font-semibold text-slate-900">{cashReports.length}</span>
        </div>
      </div>

      {loading ? (
        <div className="surface flex min-h-[260px] items-center justify-center">
          <Spinner label="Mengambil laporan kas..." />
        </div>
      ) : cashReports.length === 0 ? (
        <EmptyState description="Belum ada transaksi sesuai filter saat ini." title="Transaksi tidak ditemukan" />
      ) : (
        <>
          <CashReportMobileList
            canManage={canManageCashReports}
            cashReports={cashReports}
            onDelete={setDeleteTarget}
            onEdit={openEditModal}
          />

          <div className="table-shell hidden md:block">
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Jenis</th>
                    <th>Kategori</th>
                    <th>Deskripsi</th>
                    <th>Nominal</th>
                    {canManageCashReports && <th className="w-40">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {cashReports.map((item) => (
                    <tr key={item.id}>
                      <td>{formatDate(item.date)}</td>
                      <td>
                        <Badge tone={item.type === 'income' ? 'green' : 'red'}>
                          {item.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                        </Badge>
                      </td>
                      <td className="font-medium text-slate-900">{item.category}</td>
                      <td>{item.description || '-'}</td>
                      <td className="font-semibold text-slate-900">{formatRupiah(item.amount)}</td>
                      {canManageCashReports && (
                        <td>
                          <div className="flex gap-2">
                            <Button onClick={() => openEditModal(item)} size="sm" variant="secondary">
                              Edit
                            </Button>
                            <Button onClick={() => setDeleteTarget(item)} size="sm" variant="danger">
                              Hapus
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <CashReportFormModal
        cashReport={editingCashReport}
        isOpen={isFormOpen}
        loading={saving}
        onClose={() => {
          setIsFormOpen(false);
          setEditingCashReport(null);
        }}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        confirmLabel="Hapus Transaksi"
        description={`Transaksi ${deleteTarget?.category || ''} akan dihapus permanen.`}
        isOpen={Boolean(deleteTarget)}
        loading={deleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus transaksi kas?"
      />
    </div>
  );
}

export default CashReportsPage;

