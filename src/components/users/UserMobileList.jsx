import Badge from '../ui/Badge';
import Button from '../ui/Button';
import { ROLE_OPTIONS } from '../../utils/constants';
import { formatDateTime } from '../../utils/formatters';

function UserMobileList({ onEdit, onRoleChange, onToggleActive, profile, savingId, users }) {
  return (
    <div className="space-y-4 md:hidden">
      {users.map((userItem) => {
        const isSelf = userItem.id === profile?.id;
        const disabled = savingId === userItem.id || isSelf;

        return (
          <article className="surface p-4" key={userItem.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-base font-bold text-slate-900">{userItem.full_name || 'Tanpa Nama'}</p>
                <p className="mt-1 break-all text-sm text-slate-500">{userItem.email || '-'}</p>
                <p className="mt-1 break-all text-xs text-slate-400">{userItem.id}</p>
              </div>
              <Badge tone={userItem.is_active ? 'green' : 'red'}>
                {userItem.is_active ? 'Aktif' : 'Nonaktif'}
              </Badge>
            </div>

            <div className="surface-muted mt-4 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Role</p>
              <select
                className="input mt-2 py-2.5"
                disabled={disabled}
                onChange={(event) => onRoleChange(userItem.id, event.target.value)}
                value={userItem.role}
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="surface-muted mt-4 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Dibuat</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{formatDateTime(userItem.created_at)}</p>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Button className="w-full" onClick={() => onEdit(userItem)} variant="secondary">
                Edit User
              </Button>
              <Button
                className="w-full"
                disabled={disabled}
                onClick={() => onToggleActive(userItem.id, userItem.is_active)}
                variant={userItem.is_active ? 'secondary' : 'brand'}
              >
                {savingId === userItem.id
                  ? 'Menyimpan...'
                  : isSelf
                    ? 'Akun aktif'
                    : userItem.is_active
                      ? 'Nonaktifkan User'
                      : 'Aktifkan User'}
              </Button>
            </div>

            {isSelf && (
              <p className="mt-3 text-xs leading-5 text-slate-400">
                Role dan status akun sendiri tidak bisa diubah cepat dari kartu ini. Gunakan Edit User jika ingin mengubah nama, email, atau password akun sendiri.
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}

export default UserMobileList;
