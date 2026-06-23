import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import EmployeeDetailsTable from '../components/employees/EmployeeDetailsTable';
import EmployeeMobileList from '../components/employees/EmployeeMobileList';
import EmployeeFormModal from '../components/employees/EmployeeFormModal';
import EmployeeHierarchyBoard from '../components/employees/EmployeeHierarchyBoard';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import EmptyState from '../components/ui/EmptyState';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../hooks/useToast';
import {
  createEmployee,
  deleteEmployee,
  listEmployees,
  replaceEmployeeShiftSeparationRules,
  updateEmployee,
  uploadEmployeePhoto,
} from '../services/employeesService';
import { assertPermission } from '../utils/permissions';

function getEmployeePageErrorMessage(error, fallback = 'Gagal memuat data pegawai.') {
  return error?.message || fallback;
}

function EmployeesPage() {
  const { user } = useAuth();
  const { canManageEmployees, isReadonly } = usePermissions();
  const { showToast } = useToast();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function loadEmployeesData() {
    try {
      setLoading(true);
      const data = await listEmployees();
      setEmployees(data);
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Data pegawai gagal dimuat',
        message: getEmployeePageErrorMessage(error),
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEmployeesData();
  }, []);

  function openCreateModal() {
    setEditingEmployee(null);
    setIsFormOpen(true);
  }

  function openEditModal(employee) {
    setEditingEmployee(employee);
    setIsFormOpen(true);
  }

  async function handleSubmit(form, photoFile) {
    try {
      assertPermission(canManageEmployees, 'Role Anda hanya punya akses baca untuk data pegawai.');
      setSaving(true);

      let photoUrl = editingEmployee?.photo_url || null;

      if (photoFile) {
        const upload = await uploadEmployeePhoto(photoFile, user.id);
        photoUrl = upload.publicUrl;
      }

      if (!form.shift_pagi && !form.shift_siang) {
        throw new Error('Pilih minimal 1 shift untuk pegawai.');
      }

      const payload = {
        name: form.name,
        position: form.position,
        phone: form.phone || null,
        email: form.email || null,
        gender: String(form.gender || '').trim().toLowerCase() || null,
        kasir: Boolean(form.kasir),
        pimpinan_shift: Boolean(form.pimpinan_shift),
        shift_pagi: Boolean(form.shift_pagi),
        shift_siang: Boolean(form.shift_siang),
        off_day_mode: String(form.off_day_mode || 'all').trim().toLowerCase(),
        off_day_weekdays:
          String(form.off_day_mode || 'all').trim().toLowerCase() === 'custom'
            ? form.off_day_weekdays.map((value) => Number(value))
            : [1, 2, 3, 4, 5, 6, 0],
        holiday_mandatory_off: Boolean(form.holiday_mandatory_off),
        status: String(form.status || 'aktif').trim().toLowerCase(),
        hierarchy_order: Number(form.hierarchy_order || 0),
        photo_url: photoUrl,
      };

      const savedEmployee = editingEmployee
        ? await updateEmployee(editingEmployee.id, payload)
        : await createEmployee({
            ...payload,
            created_by: user.id,
          });

      await replaceEmployeeShiftSeparationRules(savedEmployee.id, form.separated_employee_ids, user.id);

      await loadEmployeesData();
      setIsFormOpen(false);
      setEditingEmployee(null);
      showToast({
        type: 'success',
        title: 'Data pegawai tersimpan',
        message: 'Perubahan struktur pegawai berhasil diperbarui.',
      });
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Gagal menyimpan pegawai',
        message: getEmployeePageErrorMessage(error, 'Gagal menyimpan pegawai.'),
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
      assertPermission(canManageEmployees, 'Role Anda hanya punya akses baca untuk data pegawai.');
      setDeleting(true);
      await deleteEmployee(deleteTarget.id);
      await loadEmployeesData();
      setDeleteTarget(null);
      showToast({
        type: 'success',
        title: 'Pegawai dihapus',
        message: 'Data pegawai berhasil dihapus.',
      });
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Gagal menghapus pegawai',
        message: getEmployeePageErrorMessage(error, 'Gagal menghapus pegawai.'),
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      {canManageEmployees && (
        <div className="mb-5 flex justify-end">
          <Button className="w-full sm:w-auto" onClick={openCreateModal} variant="brand">
            <Plus className="h-4 w-4" />
            Tambah Pegawai
          </Button>
        </div>
      )}

      {loading ? (
        <div className="surface flex min-h-[280px] items-center justify-center">
          <Spinner label="Mengambil struktur pegawai..." />
        </div>
      ) : employees.length === 0 ? (
        <EmptyState
          action={
            canManageEmployees ? (
              <Button className="w-full sm:w-auto" onClick={openCreateModal} variant="brand">
                Tambah Pegawai Pertama
              </Button>
            ) : null
          }
          description="Belum ada data pegawai di sistem."
          title="Data pegawai masih kosong"
        />
      ) : (
        <>
          <EmployeeHierarchyBoard employees={employees} />
          <EmployeeDetailsTable
            canManage={canManageEmployees}
            employees={employees}
            hideRestrictedColumns={isReadonly}
            onDelete={setDeleteTarget}
            onEdit={openEditModal}
          />
        </>
      )}

      <EmployeeFormModal
        employee={editingEmployee}
        employees={employees}
        isOpen={isFormOpen}
        loading={saving}
        onClose={() => {
          setIsFormOpen(false);
          setEditingEmployee(null);
        }}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        confirmLabel="Hapus Pegawai"
        description={`Data ${deleteTarget?.name || 'pegawai'} akan dihapus secara permanen.`}
        isOpen={Boolean(deleteTarget)}
        loading={deleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus data pegawai?"
      />
    </div>
  );
}

export default EmployeesPage;



