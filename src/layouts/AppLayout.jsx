import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import { appRoutes } from '../routes/routeConfig';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { hasRoleAccess } from '../utils/permissions';
import { useState } from 'react';

function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { logout, profile } = useAuth();
  const { showToast } = useToast();

  const menuItems = appRoutes.filter((item) => hasRoleAccess(profile?.role, item.roles));

  async function handleLogout() {
    try {
      await logout();
      showToast({
        type: 'info',
        title: 'Logout berhasil',
        message: 'Sampai jumpa lagi.',
      });
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Logout gagal',
        message: error.message,
      });
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <Sidebar
          isOpen={sidebarOpen}
          items={menuItems}
          onClose={() => setSidebarOpen(false)}
          profile={profile}
        />

        <div className="flex min-h-screen flex-1 flex-col gap-5 p-4 md:p-6">
          <Topbar onLogout={handleLogout} onToggleSidebar={() => setSidebarOpen(true)} profile={profile} />
          <main className="flex-1">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

export default AppLayout;
