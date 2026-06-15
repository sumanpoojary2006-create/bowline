import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { GoogleLogin } from '@react-oauth/google';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, googleLogin } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const googleEnabled = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);

  useEffect(() => {
    document.title = 'Bowline | Login';
  }, []);

  const resolveNextPath = (data) => {
    const from = location.state?.from;
    if (from) return typeof from === 'string' ? from : from.pathname + (from.search || '');
    return data.user.role === 'admin' ? '/admin/overview' : '/';
  };

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const data = await login(form);
      navigate(resolveNextPath(data), { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to log in');
    } finally {
      setSubmitting(false);
    }
  };

  const submitGoogle = async (credentialResponse) => {
    if (!credentialResponse?.credential) {
      toast.error('Google login failed. Please try again.');
      return;
    }

    setGoogleSubmitting(true);
    try {
      const data = await googleLogin(credentialResponse.credential);
      navigate(resolveNextPath(data), { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Google login failed');
    } finally {
      setGoogleSubmitting(false);
    }
  };

  return (
    <section className="section-shell py-8 sm:py-16">
      <div className="mx-auto max-w-lg glass rounded-[2rem] p-5 sm:p-8">
        <p className="text-xs uppercase tracking-[0.3em] text-amber-300">Welcome back</p>
        <h1 className="mt-3 font-display text-3xl text-white sm:text-5xl">Log in to Bowline</h1>
        <p className="mt-2 text-sm text-slate-300">Use the seeded admin or user account, or create a new profile.</p>

        <form className="mt-8 space-y-4" onSubmit={submit}>
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

        {googleEnabled ? (
          <div className="mt-5 space-y-3">
            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.22em] text-slate-500">
              <span className="h-px flex-1 bg-white/10" />
              Or continue with
              <span className="h-px flex-1 bg-white/10" />
            </div>
            <div className={googleSubmitting ? 'pointer-events-none opacity-60' : ''}>
              <GoogleLogin
                onSuccess={submitGoogle}
                onError={() => toast.error('Google login failed')}
                text="continue_with"
                shape="pill"
                width="100%"
              />
            </div>
          </div>
        ) : null}

        <div className="mt-6 rounded-[1.5rem] bg-slate-900/70 p-4 text-sm text-slate-300">
          <p>Admin: `admin@bowline.com` / `Admin@123`</p>
        </div>
      </div>
    </section>
  );
}

export default LoginPage;
