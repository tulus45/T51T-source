import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { APP_NAME } from '../utils/constants';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, loading, login } = useAuth();
  const { showToast } = useToast();
  const [form, setForm] = useState({
    email: '',
    password: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const targetPath = location.state?.from?.pathname || '/dashboard';

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate(targetPath, { replace: true });
    }
  }, [isAuthenticated, loading, navigate, targetPath]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);

    try {
      await login(form.email, form.password);
      showToast({
        type: 'success',
        title: 'Login berhasil',
        message: 'Selamat datang kembali.',
      });
      navigate(targetPath, { replace: true });
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Login gagal',
        message: error.message,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout containerClassName="max-w-[620px]">
      <div>
        <div className="surface overflow-hidden p-0 text-slate-900">
          <div className="grid lg:grid-cols-[300px,280px]">
            <div className="px-6 py-8 sm:px-7 sm:py-9">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-600">Store Management</p>
              <h1 className="mt-4 max-w-[220px] text-3xl font-bold leading-tight tracking-tight">{APP_NAME}</h1>

              <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
                <Input label="Email" name="email" onChange={handleChange} required type="email" value={form.email} />
                <Input label="Password" name="password" onChange={handleChange} required type="password" value={form.password} />
                <Button className="w-full" disabled={submitting} size="lg" type="submit" variant="brand">
                  {submitting ? 'Memproses...' : 'Login'}
                </Button>
              </form>
            </div>

            <div className="flex min-h-[240px] items-center justify-center border-t border-slate-200 px-2 py-4 lg:min-h-[360px] lg:border-l lg:border-t-0 lg:px-2 lg:py-4">
              <img alt="Putri" className="h-[220px] w-[220px] object-contain object-center sm:h-[240px] sm:w-[240px] lg:h-[260px] lg:w-[260px]" src="/Putri.png" />
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-xs font-medium tracking-[0.08em] text-slate-400">
          &copy; 2026 The Alus. All rights reserved
        </p>
      </div>
    </AuthLayout>
  );
}

export default LoginPage;

