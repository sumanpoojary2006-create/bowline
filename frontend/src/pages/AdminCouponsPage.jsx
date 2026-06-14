import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import SectionHeader from '../components/SectionHeader';
import PageLoader from '../components/PageLoader';
import api from '../lib/api';
import { formatCurrency } from '../lib/formatters';

const defaultCoupon = {
  code: '',
  title: '',
  description: '',
  discountType: 'percentage',
  discountValue: '',
  minBookingAmount: 0,
  maxDiscountAmount: '',
  startsAt: '',
  endsAt: '',
  active: true,
};

const toDateInput = (value) => (value ? value.slice(0, 10) : '');

function AdminCouponsPage() {
  const [coupons, setCoupons] = useState([]);
  const [form, setForm] = useState(defaultCoupon);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/coupons');
      setCoupons(data.coupons);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Bowline Admin | Coupons';
    fetchCoupons();
  }, []);

  const resetForm = () => {
    setForm(defaultCoupon);
    setEditingId(null);
  };

  const saveCoupon = async (event) => {
    event.preventDefault();
    setSaving(true);

    const payload = {
      ...form,
      code: form.code.trim().toUpperCase(),
      discountValue: Number(form.discountValue),
      minBookingAmount: Number(form.minBookingAmount || 0),
      maxDiscountAmount: form.maxDiscountAmount === '' ? '' : Number(form.maxDiscountAmount),
      startsAt: form.startsAt || null,
      endsAt: form.endsAt || null,
    };

    try {
      if (editingId) {
        await api.put(`/admin/coupons/${editingId}`, payload);
        toast.success('Coupon updated');
      } else {
        await api.post('/admin/coupons', payload);
        toast.success('Coupon created');
      }
      resetForm();
      fetchCoupons();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to save coupon');
    } finally {
      setSaving(false);
    }
  };

  const editCoupon = (coupon) => {
    setEditingId(coupon._id);
    setForm({
      code: coupon.code,
      title: coupon.title,
      description: coupon.description || '',
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minBookingAmount: coupon.minBookingAmount || 0,
      maxDiscountAmount: coupon.maxDiscountAmount ?? '',
      startsAt: toDateInput(coupon.startsAt),
      endsAt: toDateInput(coupon.endsAt),
      active: coupon.active,
    });
  };

  const deleteCoupon = async (id) => {
    try {
      await api.delete(`/admin/coupons/${id}`);
      toast.success('Coupon removed');
      fetchCoupons();
      if (editingId === id) resetForm();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to remove coupon');
    }
  };

  if (loading) {
    return <PageLoader label="Loading coupon controls..." />;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Coupon Offers"
        title="Configure booking coupon codes"
        description="Create optional codes guests can apply during checkout to get a precise discount on their final bill."
      />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <form className="glass rounded-[2rem] p-6" onSubmit={saveCoupon}>
          <h2 className="text-2xl font-semibold text-white">{editingId ? 'Edit coupon' : 'Create coupon'}</h2>
          <div className="mt-5 grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="label">Coupon code</label>
                <input
                  className="input uppercase"
                  required
                  placeholder="SUMMER20"
                  value={form.code}
                  onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
                />
              </div>
              <div>
                <label className="label">Offer title</label>
                <input
                  className="input"
                  required
                  placeholder="Summer stay offer"
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="label">Offer description</label>
              <textarea
                className="input min-h-24 resize-y"
                placeholder="Optional details shown to the team"
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="label">Discount type</label>
                <select
                  className="input"
                  value={form.discountType}
                  onChange={(event) => setForm((prev) => ({ ...prev, discountType: event.target.value }))}
                >
                  <option value="percentage">Percentage</option>
                  <option value="flat">Flat amount</option>
                </select>
              </div>
              <div>
                <label className="label">Discount value</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  required
                  value={form.discountValue}
                  onChange={(event) => setForm((prev) => ({ ...prev, discountValue: event.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="label">Minimum bill</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={form.minBookingAmount}
                  onChange={(event) => setForm((prev) => ({ ...prev, minBookingAmount: event.target.value }))}
                />
              </div>
              <div>
                <label className="label">Maximum discount</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  placeholder="No cap"
                  value={form.maxDiscountAmount}
                  onChange={(event) => setForm((prev) => ({ ...prev, maxDiscountAmount: event.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="label">Starts on</label>
                <input
                  className="input"
                  type="date"
                  value={form.startsAt}
                  onChange={(event) => setForm((prev) => ({ ...prev, startsAt: event.target.value }))}
                />
              </div>
              <div>
                <label className="label">Ends on</label>
                <input
                  className="input"
                  type="date"
                  value={form.endsAt}
                  onChange={(event) => setForm((prev) => ({ ...prev, endsAt: event.target.value }))}
                />
              </div>
            </div>
            <label className="flex items-center gap-3 text-sm font-semibold text-slate-200">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.checked }))}
                className="h-4 w-4 rounded border-white/20 bg-slate-900"
              />
              Active coupon
            </label>
            <div className="flex flex-wrap gap-3">
              <button className="btn-primary" type="submit" disabled={saving}>
                {saving ? 'Saving...' : editingId ? 'Update Coupon' : 'Save Coupon'}
              </button>
              {editingId && (
                <button className="btn-secondary" type="button" onClick={resetForm}>
                  Cancel Edit
                </button>
              )}
            </div>
          </div>
        </form>

        <div className="glass rounded-[2rem] p-6">
          <h2 className="text-2xl font-semibold text-white">Coupons</h2>
          <div className="mt-5 space-y-4">
            {coupons.length === 0 && <p className="text-sm text-slate-400">No coupon codes configured yet.</p>}
            {coupons.map((coupon) => (
              <div key={coupon._id} className="rounded-[1.5rem] bg-slate-900/70 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-lg font-semibold text-white">{coupon.code}</p>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${coupon.active ? 'bg-lime-300 text-slate-950' : 'bg-white/10 text-slate-300'}`}>
                        {coupon.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-lime-200">{coupon.title}</p>
                    <p className="mt-2 text-sm text-slate-300">
                      {coupon.discountType === 'percentage' ? `${coupon.discountValue}% off` : `${formatCurrency(coupon.discountValue)} off`}
                      {coupon.maxDiscountAmount ? ` · capped at ${formatCurrency(coupon.maxDiscountAmount)}` : ''}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      Minimum bill {formatCurrency(coupon.minBookingAmount || 0)}
                      {coupon.startsAt || coupon.endsAt
                        ? ` · ${toDateInput(coupon.startsAt) || 'Any time'} to ${toDateInput(coupon.endsAt) || 'No end'}`
                        : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button className="rounded-full border border-lime-300/30 px-4 py-2 text-sm font-semibold text-lime-200" onClick={() => editCoupon(coupon)}>
                      Edit
                    </button>
                    <button className="rounded-full border border-rose-400/30 px-4 py-2 text-sm font-semibold text-rose-300" onClick={() => deleteCoupon(coupon._id)}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminCouponsPage;
