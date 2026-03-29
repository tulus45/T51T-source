import { LogOut, Menu } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { appRoutes } from '../routes/routeConfig';
import { getInitials } from '../utils/helpers';

function Topbar({ onToggleSidebar, profile, onLogout }) {
  const location = useLocation();
  const currentRoute = appRoutes.find((item) => item.path === location.pathname);

  return (
    <header className="surface flex items-center justify-between gap-4 px-5 py-4">
      <div className="flex items-center gap-3">
        <button
          className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 md:hidden"
          onClick={onToggleSidebar}
          type="button"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Workspace</p>
          <h2 className="text-lg font-bold text-slate-900">{currentRoute?.label || 'Dashboard'}</h2>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-semibold text-slate-900">{profile?.full_name || 'Tanpa Nama'}</p>
          <p className="text-xs text-slate-500">Session aktif</p>
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold text-white">
          {getInitials(profile?.full_name)}
        </div>

        <button
          className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-600 transition hover:bg-red-50 hover:text-red-600"
          onClick={onLogout}
          type="button"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}

export default Topbar;
