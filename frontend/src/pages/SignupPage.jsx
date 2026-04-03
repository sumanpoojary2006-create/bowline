import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function SignupPage() {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = 'Bowline | Sign Up';
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await signup(form);
      navigate('/dashboard', { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to create account');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="section-shell py-16">
      <div className="mx-auto max-w-2xl glass rounded-[2rem] p-8">
        <p className="text-xs uppercase tracking-[0.3em] text-amber-300">Create account</p>
        <h1 className="mt-4 font-display text-5xl text-white">Start planning with Bowline</h1>
        <form className="mt-8 grid gap-4 sm:grid-cols-2" onSubmit={submit}>
          <div className="sm:col-span-2">
            <label className="label">Full name</label>
            <input
              className="input"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            />
          </div>
          <div>
            <label className="label">Phone</label>
            <input
              className="input"
              value={form.phone}
              onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <button className="btn-primary w-full" disabled={submitting} type="submit">
              {submitting ? 'Creating account...' : 'Create Account'}
            </button>
          </div>
        </form>
        <p className="mt-6 text-sm text-slate-400">
          Already registered?{' '}
          <Link className="text-amber-300" to="/login">
            Login here
          </Link>
        </p>
      </div>
    </section>
  );
}

export default SignupPage;
