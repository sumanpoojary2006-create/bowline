import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import employeeApi from '../lib/employeeApi';

const EmployeeAuthContext = createContext(null);

export function EmployeeAuthProvider({ children }) {
  const [employee, setEmployee] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = async () => {
    const { data } = await employeeApi.get('/employee/me');
    setEmployee(data.employee);
    setSummary({
      attendanceSummary: data.attendanceSummary,
      score: data.score,
      today: data.today,
    });
    return data;
  };

  useEffect(() => {
    const bootstrap = async () => {
      const token = localStorage.getItem('bowline_employee_token');

      if (!token) {
        setLoading(false);
        return;
      }

      try {
        await fetchMe();
      } catch (error) {
        localStorage.removeItem('bowline_employee_token');
        setEmployee(null);
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, []);

  const login = async (values) => {
    const { data } = await employeeApi.post('/employee/login', values);
    localStorage.setItem('bowline_employee_token', data.token);
    setEmployee(data.employee);
    await fetchMe();
    toast.success(`Welcome back, ${data.employee.name.split(' ')[0]}`);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('bowline_employee_token');
    setEmployee(null);
    setSummary(null);
    toast.success('Logged out');
  };

  const value = useMemo(
    () => ({
      employee,
      summary,
      loading,
      isAuthenticated: Boolean(employee),
      login,
      logout,
      refresh: fetchMe,
    }),
    [employee, summary, loading]
  );

  return <EmployeeAuthContext.Provider value={value}>{children}</EmployeeAuthContext.Provider>;
}

export const useEmployeeAuth = () => {
  const context = useContext(EmployeeAuthContext);

  if (!context) {
    throw new Error('useEmployeeAuth must be used inside EmployeeAuthProvider');
  }

  return context;
};
