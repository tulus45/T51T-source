import { NavLink } from 'react-router-dom';
import { X } from 'lucide-react';
import { APP_NAME, ROLE_LABELS } from '../utils/constants';
import { cn } from '../utils/helpers';

function Sidebar({ items, isOpen, onClose, profile }) {
  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-30 bg-slate-950/40 transition md:hidden',
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-200 bg-white p-5 transition md:static md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="mb-8 flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-600">Store Ops</p>
            <h1 className="mt-2 text-xl font-bold text-slate-900">{APP_NAME}</h1>
            <p className="mt-1 text-sm text-slate-500">{ROLE_LABELS[profile?.role] || 'No Role'}</p>
          </div>
          <button
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 md:hidden"
            onClick={onClose}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="space-y-2">
          {items.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition',
                    isActive
                      ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/20'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                  )
                }
                onClick={onClose}
                to={item.path}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="mt-auto pt-6">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/95 px-4 py-3 text-center text-xs font-medium leading-5 text-slate-500 shadow-soft">
            &copy; 2026 The Alus. All rights reserved
          </div>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;

