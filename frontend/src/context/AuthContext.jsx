import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      const token = localStorage.getItem('bowline_token');

      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const { data } = await api.get('/auth/me');
        setUser(data.user);
      } catch (error) {
        localStorage.removeItem('bowline_token');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, []);

  const persistAuth = (payload) => {
    localStorage.setItem('bowline_token', payload.token);
    setUser(payload.user);
  };

  const login = async (values) => {
    const { data } = await api.post('/auth/login', values);
    persistAuth(data);
    toast.success(`Welcome back, ${data.user.name.split(' ')[0]}`);
    return data;
  };

  const signup = async (values) => {
    const { data } = await api.post('/auth/signup', values);
    persistAuth(data);
    toast.success('Account created successfully');
    return data;
  };

  const updateProfile = async (values) => {
    const { data } = await api.put('/auth/profile', values);
    persistAuth(data);
    toast.success('Profile updated');
  };

  const logout = () => {
    localStorage.removeItem('bowline_token');
    setUser(null);
    toast.success('Logged out');
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      login,
      signup,
      logout,
      updateProfile,
      setUser,
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
};
