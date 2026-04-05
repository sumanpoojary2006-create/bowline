import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { GoogleLogin } from '@react-oauth/google';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const data = await login(form);
      const nextPath =
        location.state?.from?.pathname ||
        (data.user.role === 'admin' ? '/admin/overview' : '/dashboard');
      navigate(nextPath, { replace: true });
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
      const nextPath =
        location.state?.from?.pathname ||
        (data.user.role === 'admin' ? '/admin/overview' : '/dashboard');
      navigate(nextPath, { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Google login failed');
    } finally {
      setGoogleSubmitting(false);
    }
  };

  return (
    <section className="section-shell py-16">
      <div className="mx-auto max-w-lg glass rounded-[2rem] p-8">
        <p className="text-xs uppercase tracking-[0.3em] text-amber-300">Welcome back</p>
        <h1 className="mt-4 font-display text-5xl text-white">Log in to Bowline</h1>
        <p className="mt-3 text-sm text-slate-300">Use the seeded admin or user account, or create a new profile.</p>

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
          <p>User: `explorer@bowline.com` / `User@123`</p>
        </div>

        <p className="mt-6 text-sm text-slate-400">
          Need an account?{' '}
          <Link className="text-amber-300" to="/signup">
            Sign up
          </Link>
        </p>
      </div>
    </section>
  );
}

export default LoginPage;
