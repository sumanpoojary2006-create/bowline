import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import PageLoader from '../components/PageLoader';
import SectionHeader from '../components/SectionHeader';

const ROLES = [
  { value: 'housekeeping', label: 'Housekeeping' },
  { value: 'kitchen', label: 'Kitchen' },
];

const FIELD_TYPES = [
  { value: 'boolean', label: 'Yes / No', scoreable: true },
  { value: 'status', label: 'Good / Low / Empty', scoreable: true },
  { value: 'number', label: 'Number', scoreable: true },
  { value: 'text', label: 'Text note (no score)', scoreable: false },
];

const isScoreable = (type) => FIELD_TYPES.find((t) => t.value === type)?.scoreable;

function AdminChecklistTemplatesPage() {
  const [items, setItems] = useState([]);
  const [role, setRole] = useState('housekeeping');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newItem, setNewItem] = useState({ label: '', type: 'boolean', maxPoints: 4 });

  const fetchItems = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/checklist-items');
      setItems(data.items);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to load checklists');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Bowline Admin | Checklist Editor';
    fetchItems();
  }, []);

  const roleItems = useMemo(
    () => items.filter((item) => item.role === role).sort((a, b) => a.order - b.order),
    [items, role]
  );

  const otherRole = role === 'housekeeping' ? 'kitchen' : 'housekeeping';
  const otherRoleLabel = ROLES.find((r) => r.value === otherRole)?.label;

  const replaceItem = (updated) =>
    setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));

  const addItem = async (event) => {
    event.preventDefault();
    const label = newItem.label.trim();
    if (!label) {
      toast.error('Enter a checklist label');
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post('/admin/checklist-items', {
        role,
        label,
        type: newItem.type,
        maxPoints: isScoreable(newItem.type) ? Number(newItem.maxPoints) || 0 : 0,
      });
      setItems((prev) => [...prev, data.item]);
      setNewItem({ label: '', type: 'boolean', maxPoints: 4 });
      toast.success('Checklist item added');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to add item');
    } finally {
      setBusy(false);
    }
  };

  const patchItem = async (item, changes) => {
    try {
      const { data } = await api.put(`/admin/checklist-items/${item.id}`, changes);
      replaceItem(data.item);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to save change');
      fetchItems();
    }
  };

  const removeItem = async (item) => {
    if (!window.confirm(`Remove "${item.label}" from the ${role} checklist?`)) return;
    try {
      await api.delete(`/admin/checklist-items/${item.id}`);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      toast.success('Removed');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to remove');
    }
  };

  const moveToOtherRole = async (item) => {
    if (!window.confirm(`Move "${item.label}" to the ${otherRoleLabel} checklist?`)) return;
    try {
      const { data } = await api.put(`/admin/checklist-items/${item.id}`, { role: otherRole });
      replaceItem(data.item);
      toast.success(`Moved to ${otherRoleLabel}`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to move item');
    }
  };

  const move = async (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= roleItems.length) return;

    const reordered = [...roleItems];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];

    // optimistic local order update
    const orderById = new Map(reordered.map((item, i) => [item.id, i]));
    setItems((prev) =>
      prev.map((item) => (orderById.has(item.id) ? { ...item, order: orderById.get(item.id) } : item))
    );

    try {
      await api.put('/admin/checklist-items/reorder', { orderedIds: reordered.map((i) => i.id) });
    } catch (error) {
      toast.error('Unable to reorder');
      fetchItems();
    }
  };

  if (loading) {
    return <PageLoader label="Loading checklists..." />;
  }

  const scoreableCount = roleItems.filter((i) => i.active && isScoreable(i.type)).length;

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Staff Management"
        title="Checklist Editor"
        description="Add, edit, reorder, or remove the checklist items each type of employee completes at check-out. Scoreable items count towards the staff score; text notes are informational only."
      />

      {/* Employee-type selector */}
      <div className="flex flex-wrap gap-2">
        {ROLES.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => setRole(r.value)}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
              role === r.value
                ? 'bg-lime-300 text-[#0d1710]'
                : 'bg-slate-900/70 text-slate-300 hover:text-white'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Add new item */}
      <form className="glass space-y-4 rounded-[2rem] p-6" onSubmit={addItem}>
        <h2 className="text-lg font-semibold text-white">
          Add item to the {ROLES.find((r) => r.value === role)?.label} checklist
        </h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
          <div>
            <label className="label">Checklist question</label>
            <input
              className="input"
              placeholder="e.g. Towels restocked?"
              value={newItem.label}
              onChange={(e) => setNewItem((f) => ({ ...f, label: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Answer type</label>
            <select
              className="input"
              value={newItem.type}
              onChange={(e) => setNewItem((f) => ({ ...f, type: e.target.value }))}
            >
              {FIELD_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Points</label>
            <input
              type="number"
              min="0"
              className="input w-24"
              disabled={!isScoreable(newItem.type)}
              value={isScoreable(newItem.type) ? newItem.maxPoints : 0}
              onChange={(e) => setNewItem((f) => ({ ...f, maxPoints: e.target.value }))}
            />
          </div>
          <div className="flex items-end">
            <button className="btn-primary w-full" type="submit" disabled={busy}>
              Add
            </button>
          </div>
        </div>
      </form>

      {/* Existing items */}
      <div className="glass rounded-[2rem] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">
            {roleItems.length} item{roleItems.length === 1 ? '' : 's'}
          </h2>
          <span className="text-xs text-slate-400">{scoreableCount} scoreable</span>
        </div>

        {roleItems.length === 0 ? (
          <p className="text-sm text-slate-400">No checklist items yet. Add one above.</p>
        ) : (
          <div className="space-y-3">
            {roleItems.map((item, index) => (
              <div
                key={item.id}
                className={`rounded-2xl border border-white/5 bg-slate-900/60 p-4 ${
                  item.active ? '' : 'opacity-60'
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <label className="label">Question</label>
                    <input
                      className="input"
                      defaultValue={item.label}
                      onBlur={(e) => {
                        const value = e.target.value.trim();
                        if (value && value !== item.label) patchItem(item, { label: value });
                      }}
                    />
                  </div>
                  <div>
                    <label className="label">Answer type</label>
                    <select
                      className="input"
                      value={item.type}
                      onChange={(e) => patchItem(item, { type: e.target.value })}
                    >
                      {FIELD_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Points</label>
                    <input
                      type="number"
                      min="0"
                      className="input w-20"
                      disabled={!isScoreable(item.type)}
                      defaultValue={item.maxPoints}
                      key={`${item.id}-${item.type}-${item.maxPoints}`}
                      onBlur={(e) => {
                        const value = Math.max(0, Number(e.target.value) || 0);
                        if (value !== item.maxPoints) patchItem(item, { maxPoints: value });
                      }}
                    />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    className="rounded-lg bg-slate-800 px-2.5 py-1 text-slate-200 disabled:opacity-30"
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === roleItems.length - 1}
                    className="rounded-lg bg-slate-800 px-2.5 py-1 text-slate-200 disabled:opacity-30"
                    title="Move down"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => patchItem(item, { active: !item.active })}
                    className={`rounded-lg px-2.5 py-1 font-semibold ${
                      item.active
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-slate-700/60 text-slate-300'
                    }`}
                  >
                    {item.active ? 'Active' : 'Hidden'}
                  </button>
                  <button
                    type="button"
                    onClick={() => moveToOtherRole(item)}
                    className="rounded-lg bg-slate-800 px-2.5 py-1 text-slate-200"
                  >
                    Move to {otherRoleLabel}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(item)}
                    className="ml-auto rounded-lg bg-rose-500/20 px-2.5 py-1 font-semibold text-rose-300"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminChecklistTemplatesPage;
