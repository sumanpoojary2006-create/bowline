import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import PageLoader from '../components/PageLoader';
import SectionHeader from '../components/SectionHeader';

const ROLE_LABELS = {
  housekeeping: 'Housekeeping',
  kitchen: 'Kitchen Assistant',
};

const emptyForm = { name: '', phone: '', email: '', password: '', role: 'housekeeping' };

function AdminEmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/employees');
      setEmployees(data.employees);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Bowline Admin | Employees';
    fetchEmployees();
  }, []);

  const createEmployee = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/admin/employees', form);
      toast.success('Employee created');
      setForm(emptyForm);
      fetchEmployees();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to create employee');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (employee) => {
    try {
      await api.put(`/admin/employees/${employee.id}`, { active: !employee.active });
      toast.success(employee.active ? 'Employee deactivated' : 'Employee activated');
      fetchEmployees();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to update employee');
    }
  };

  if (loading) {
    return <PageLoader label="Loading employees..." />;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Staff Management"
        title="Employees"
        description="Create staff accounts and manage their access."
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="glass rounded-[2rem] p-6">
          <h2 className="text-2xl font-semibold text-white">Add employee</h2>
          <form className="mt-5 space-y-4" onSubmit={createEmployee}>
            <div>
              <label className="label">Name</label>
              <input
                className="input"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
            </div>
            <div>
              <label className="label">Phone number</label>
              <input
                className="input"
                value={form.phone}
                onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                required
              />
            </div>
            <div>
              <label className="label">Email (optional)</label>
              <input
                className="input"
                type="email"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              />
            </div>
            <div>
              <label className="label">Role</label>
              <select
                className="input"
                value={form.role}
                onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}
              >
                <option value="housekeeping">Housekeeping</option>
                <option value="kitchen">Kitchen Assistant</option>
              </select>
            </div>
            <div>
              <label className="label">Initial password</label>
              <input
                className="input"
                type="text"
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                required
                minLength={6}
              />
            </div>
            <button className="btn-primary w-full" disabled={submitting} type="submit">
              {submitting ? 'Creating...' : 'Create employee'}
            </button>
          </form>
        </div>

        <div className="glass rounded-[2rem] p-6">
          <h2 className="text-2xl font-semibold text-white">All employees</h2>
          <div className="mt-5 space-y-4">
            {employees.length === 0 ? (
              <p className="text-sm text-slate-400">No employees yet.</p>
            ) : (
              employees.map((employee) => (
                <div key={employee.id} className="rounded-[1.5rem] bg-slate-900/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-white">{employee.name}</p>
                      <p className="mt-1 text-sm text-slate-400">{employee.phone}</p>
                      <p className="mt-1 text-sm text-slate-300">{ROLE_LABELS[employee.role] || employee.role}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-lime-200">
                        {employee.score != null ? `${employee.score} / 100` : 'No score yet'}
                      </p>
                      <button
                        className={`mt-2 rounded-full px-3 py-1 text-xs font-semibold ${
                          employee.active ? 'bg-rose-500/20 text-rose-300' : 'bg-lime-200 text-slate-950'
                        }`}
                        onClick={() => toggleActive(employee)}
                      >
                        {employee.active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminEmployeesPage;
