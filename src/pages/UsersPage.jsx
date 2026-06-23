import { Pencil, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import UserFormModal from '../components/users/UserFormModal';
import UserMobileList from '../components/users/UserMobileList';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import Spinner from '../components/ui/Spinner';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { createUser, listProfiles, updateProfile } from '../services/usersService';
import { ROLE_OPTIONS } from '../utils/constants';
import { formatDateTime } from '../utils/formatters';
import { assertPermission, canManageUsers } from '../utils/permissions';

function UsersPage() {
  const { profile, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [savingForm, setSavingForm] = useState(false);

  async function loadUsers() {
    try {
      setLoading(true);
      const data = await listProfiles();
      setUsers(data);
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Gagal mengambil user',
        message: error.message,
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  function openCreateModal() {
    setEditingUser(null);
    setIsFormOpen(true);
  }

  function openEditModal(userItem) {
    setEditingUser(userItem);
    setIsFormOpen(true);
  }

  async function handleRoleChange(userId, nextRole) {
    try {
      assertPermission(canManageUsers(profile?.role));
      setSavingId(userId);
      const updated = await updateProfile(userId, { role: nextRole });
      setUsers((current) => current.map((item) => (item.id === userId ? updated : item)));

      if (userId === profile?.id) {
        await refreshProfile();
      }

      showToast({
        type: 'success',
        title: 'Role diperbarui',
        message: 'Hak akses user sudah diperbarui.',
      });
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Update role gagal',
        message: error.message,
      });
    } finally {
      setSavingId('');
    }
  }

  async function handleToggleActive(userId, isActive) {
    try {
      assertPermission(canManageUsers(profile?.role));
      setSavingId(userId);
      const updated = await updateProfile(userId, { is_active: !isActive });
      setUsers((current) => current.map((item) => (item.id === userId ? updated : item)));
      showToast({
        type: 'success',
        title: 'Status user diperbarui',
        message: 'Status aktif user sudah tersimpan.',
      });
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Update status gagal',
        message: error.message,
      });
    } finally {
      setSavingId('');
    }
  }

  async function handleSubmitUser(formPayload) {
    try {
      assertPermission(canManageUsers(profile?.role));
      setSavingForm(true);

      const savedUser = editingUser
        ? await updateProfile(editingUser.id, formPayload)
        : await createUser(formPayload);

      setUsers((current) => {
        if (editingUser) {
          return current.map((item) => (item.id === editingUser.id ? savedUser : item));
        }

        return [savedUser, ...current];
      });

      if (editingUser?.id === profile?.id) {
        await refreshProfile();
      }

      setIsFormOpen(false);
      setEditingUser(null);
      showToast({
        type: 'success',
        title: editingUser ? 'User diperbarui' : 'User ditambahkan',
        message: editingUser
          ? 'Data user berhasil diperbarui.'
          : 'User baru berhasil dibuat dan sudah bisa login.',
      });
    } catch (error) {
      showToast({
        type: 'error',
        title: editingUser ? 'Gagal memperbarui user' : 'Gagal menambah user',
        message: error.message,
      });
    } finally {
      setSavingForm(false);
    }
  }

  return (
    <div>
      <PageHeader
        actions={(
          <Button className="w-full sm:w-auto" onClick={openCreateModal} variant="brand">
            <Plus className="h-4 w-4" />
            Tambah User
          </Button>
        )}
        description="Khusus super admin. Atur role, status aktif, email login, password, dan tambah user langsung dari backend lokal."
        title="Manajemen User"
      />

      {loading ? (
        <div className="surface flex min-h-[240px] items-center justify-center">
          <Spinner label="Mengambil daftar user..." />
        </div>
      ) : users.length === 0 ? (
        <EmptyState
          action={(
            <Button className="w-full sm:w-auto" onClick={openCreateModal} variant="brand">
              Tambah User Pertama
            </Button>
          )}
          description="Belum ada user yang bisa dikelola dari sistem."
          title="User belum tersedia"
        />
      ) : (
        <>
          <UserMobileList
            onEdit={openEditModal}
            onRoleChange={handleRoleChange}
            onToggleActive={handleToggleActive}
            profile={profile}
            savingId={savingId}
            users={users}
          />

          <div className="table-shell hidden md:block">
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Dibuat</th>
                    <th className="w-64">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {users.map((userItem) => {
                    const isSelf = userItem.id === profile?.id;
                    const disabled = savingId === userItem.id || isSelf;

                    return (
                      <tr key={userItem.id}>
                        <td>
                          <div>
                            <p className="font-semibold text-slate-900">{userItem.full_name || 'Tanpa Nama'}</p>
                            <p className="mt-1 text-sm text-slate-500">{userItem.email || '-'}</p>
                            <p className="mt-1 text-xs text-slate-400">{userItem.id}</p>
                          </div>
                        </td>
                        <td>
                          <select
                            className="input py-2.5"
                            disabled={disabled}
                            onChange={(event) => handleRoleChange(userItem.id, event.target.value)}
                            value={userItem.role}
                          >
                            {ROLE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <Badge tone={userItem.is_active ? 'green' : 'red'}>
                            {userItem.is_active ? 'Aktif' : 'Nonaktif'}
                          </Badge>
                        </td>
                        <td>{formatDateTime(userItem.created_at)}</td>
                        <td>
                          <div className="flex flex-wrap gap-2">
                            <Button onClick={() => openEditModal(userItem)} size="sm" variant="secondary">
                              <Pencil className="h-4 w-4" />
                              Edit
                            </Button>
                            <Button
                              disabled={disabled}
                              onClick={() => handleToggleActive(userItem.id, userItem.is_active)}
                              size="sm"
                              variant={userItem.is_active ? 'secondary' : 'brand'}
                            >
                              {savingId === userItem.id
                                ? 'Menyimpan...'
                                : isSelf
                                  ? 'Akun aktif'
                                  : userItem.is_active
                                    ? 'Nonaktifkan'
                                    : 'Aktifkan'}
                            </Button>
                          </div>
                          {isSelf && (
                            <p className="mt-2 text-xs text-slate-400">
                              Role dan status akun sendiri tidak bisa diubah cepat dari tabel ini. Gunakan tombol Edit untuk mengubah nama, email, atau password akun Anda.
                            </p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <UserFormModal
        currentUserId={profile?.id}
        isOpen={isFormOpen}
        loading={savingForm}
        onClose={() => {
          setIsFormOpen(false);
          setEditingUser(null);
        }}
        onSubmit={handleSubmitUser}
        user={editingUser}
      />
    </div>
  );
}

export default UsersPage;
