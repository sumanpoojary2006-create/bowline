import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import PageLoader from '../components/PageLoader';
import SectionHeader from '../components/SectionHeader';

const ROLE_LABELS = {
  housekeeping: 'Housekeeping',
  kitchen: 'Kitchen Assistant',
};

const emptyForm = {
  name: '',
  phone: '',
  email: '',
  password: '',
  role: 'housekeeping',
  monthlySalary: '',
  leavesPerMonth: '',
};

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

  const savePay = async (employee, monthlySalary, leavesPerMonth) => {
    try {
      await api.put(`/admin/employees/${employee.id}`, { monthlySalary, leavesPerMonth });
      toast.success('Pay settings updated');
      fetchEmployees();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to update pay settings');
    }
  };

  const deleteEmployee = async (employee) => {
    if (
      !window.confirm(
        `Permanently delete ${employee.name}? This also removes their attendance, leave, and checklist history. This cannot be undone.`
      )
    ) {
      return;
    }
    try {
      await api.delete(`/admin/employees/${employee.id}`);
      toast.success(`${employee.name} deleted`);
      fetchEmployees();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to delete employee');
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Monthly salary (₹)</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={form.monthlySalary}
                  onChange={(event) => setForm((prev) => ({ ...prev, monthlySalary: event.target.value }))}
                />
              </div>
              <div>
                <label className="label">Leaves / month</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={form.leavesPerMonth}
                  onChange={(event) => setForm((prev) => ({ ...prev, leavesPerMonth: event.target.value }))}
                />
              </div>
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
                <EmployeeRow
                  key={employee.id}
                  employee={employee}
                  onToggleActive={toggleActive}
                  onSavePay={savePay}
                  onDelete={deleteEmployee}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmployeeRow({ employee, onToggleActive, onSavePay, onDelete }) {
  const [monthlySalary, setMonthlySalary] = useState(employee.monthlySalary ?? 0);
  const [leavesPerMonth, setLeavesPerMonth] = useState(employee.leavesPerMonth ?? 0);
  const dirty = Number(monthlySalary) !== (employee.monthlySalary ?? 0) || Number(leavesPerMonth) !== (employee.leavesPerMonth ?? 0);
  const salary = employee.currentMonthSalary;

  return (
    <div className="rounded-[1.5rem] bg-slate-900/70 p-4">
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
          <div className="mt-2 flex gap-2">
            <button
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                employee.active ? 'bg-rose-500/20 text-rose-300' : 'bg-lime-200 text-slate-950'
              }`}
              onClick={() => onToggleActive(employee)}
            >
              {employee.active ? 'Deactivate' : 'Activate'}
            </button>
            <button
              className="rounded-full bg-rose-500/20 px-3 py-1 text-xs font-semibold text-rose-300"
              onClick={() => onDelete(employee)}
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
        <div>
          <label className="label">Monthly salary (₹)</label>
          <input
            className="input"
            type="number"
            min="0"
            value={monthlySalary}
            onChange={(event) => setMonthlySalary(event.target.value)}
          />
        </div>
        <div>
          <label className="label">Leaves / month</label>
          <input
            className="input"
            type="number"
            min="0"
            value={leavesPerMonth}
            onChange={(event) => setLeavesPerMonth(event.target.value)}
          />
        </div>
      </div>
      {dirty ? (
        <button
          className="mt-2 w-full rounded-full bg-lime-200 py-1.5 text-xs font-semibold text-slate-950"
          onClick={() => onSavePay(employee, Number(monthlySalary) || 0, Number(leavesPerMonth) || 0)}
        >
          Save pay settings
        </button>
      ) : null}

      {salary ? (
        <div className="mt-3 rounded-xl bg-slate-950/50 p-3 text-xs text-slate-300">
          <p className="font-semibold text-slate-200">This month's calculated salary: ₹{salary.calculatedSalary}</p>
          <p className="mt-1 text-slate-400">
            {salary.fullDays} full day(s), {salary.halfDays} half day(s), {salary.leaveDays} leave day(s)
            {salary.excessLeaveDays > 0 ? ` (${salary.excessLeaveDays} beyond the ${salary.leavesPerMonth}-leave allowance, unpaid)` : ''}.
          </p>
        </div>
      ) : null}
    </div>
  );
}

export default AdminEmployeesPage;
