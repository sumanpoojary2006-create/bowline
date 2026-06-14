import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useLocation, useNavigate } from 'react-router-dom';
import { useEmployeeAuth } from '../../context/EmployeeAuthContext';

function EmployeeLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useEmployeeAuth();
  const [form, setForm] = useState({ phone: '', password: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = 'Bowline Staff';
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await login(form);
      const from = location.state?.from;
      navigate(from ? from.pathname + (from.search || '') : '/employee/dashboard', { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to log in');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-lime-200 to-lime-400 text-2xl font-bold text-slate-950">
            B
          </div>
          <h1 className="mt-4 font-display text-3xl text-white">Bowline Staff</h1>
          <p className="mt-1 text-sm text-slate-400">Sign in to check in and out of your shift</p>
        </div>

        <form className="glass space-y-4 rounded-[2rem] p-6" onSubmit={submit}>
          <div>
            <label className="label">Phone number</label>
            <input
              className="input"
              type="tel"
              inputMode="numeric"
              autoFocus
              value={form.phone}
              onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
            />
          </div>
          <button className="btn-primary w-full" disabled={submitting} type="submit">
            {submitting ? 'Logging in...' : 'Log in'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">Don't have an account? Ask your admin to set one up.</p>
      </div>
    </div>
  );
}

export default EmployeeLoginPage;
