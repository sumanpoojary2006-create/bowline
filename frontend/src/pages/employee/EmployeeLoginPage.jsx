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
    document.title = 'Bowline Staff | Login';
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
    <section className="section-shell py-8 sm:py-16">
      <div className="mx-auto max-w-lg glass rounded-[2rem] p-5 sm:p-8">
        <p className="text-xs uppercase tracking-[0.3em] text-amber-300">Staff portal</p>
        <h1 className="mt-3 font-display text-3xl text-white sm:text-5xl">Employee Login</h1>
        <p className="mt-2 text-sm text-slate-300">Log in with your phone number and password to check in/out.</p>

        <form className="mt-8 space-y-4" onSubmit={submit}>
          <div>
            <label className="label">Phone number</label>
            <input
              className="input"
              type="tel"
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
            {submitting ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-400">Don't have an account? Ask the admin to set one up for you.</p>
      </div>
    </section>
  );
}

export default EmployeeLoginPage;
