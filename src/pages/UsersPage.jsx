import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import UserMobileList from '../components/users/UserMobileList';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import Spinner from '../components/ui/Spinner';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { listProfiles, updateProfile } from '../services/usersService';
import { formatDateTime } from '../utils/formatters';
import { ROLE_OPTIONS } from '../utils/constants';
import { assertPermission, canManageUsers } from '../utils/permissions';

function UsersPage() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');

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

  async function handleRoleChange(userId, nextRole) {
    try {
      assertPermission(canManageUsers(profile?.role));
      setSavingId(userId);
      const updated = await updateProfile(userId, { role: nextRole });
      setUsers((current) => current.map((item) => (item.id === userId ? updated : item)));
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

  return (
    <div>
      <PageHeader
        description="Khusus super admin. Atur role dan status aktif user langsung dari backend lokal."
        title="Manajemen User"
      />

      {loading ? (
        <div className="surface flex min-h-[240px] items-center justify-center">
          <Spinner label="Mengambil daftar user..." />
        </div>
      ) : users.length === 0 ? (
        <EmptyState description="Belum ada user yang bisa dikelola dari sistem." title="User belum tersedia" />
      ) : (
        <>
          <UserMobileList
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
                    <th className="w-44">Aksi</th>
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
                          <button
                            className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={disabled}
                            onClick={() => handleToggleActive(userItem.id, userItem.is_active)}
                            type="button"
                          >
                            {savingId === userItem.id
                              ? 'Menyimpan...'
                              : isSelf
                                ? 'Akun aktif'
                                : userItem.is_active
                                  ? 'Nonaktifkan'
                                  : 'Aktifkan'}
                          </button>
                          {isSelf && <p className="mt-2 text-xs text-slate-400">Role akun sendiri tidak bisa diubah dari halaman ini.</p>}
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
    </div>
  );
}

export default UsersPage;

