import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import SectionHeader from '../components/SectionHeader';
import PageLoader from '../components/PageLoader';

const defaultRule = {
  name: '',
  listing: '',
  listingType: 'all',
  startDate: '',
  endDate: '',
  adjustmentType: 'flat',
  adjustmentValue: '',
  priority: 1,
  active: true,
};

function AdminPricingPage() {
  const [rules, setRules] = useState([]);
  const [listings, setListings] = useState([]);
  const [form, setForm] = useState(defaultRule);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rulesRes, listingsRes] = await Promise.all([
        api.get('/admin/pricing-rules'),
        api.get('/listings/admin/all'),
      ]);
      setRules(rulesRes.data.rules);
      setListings(listingsRes.data.listings);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Bowline Admin | Pricing';
    fetchData();
  }, []);

  const createRule = async (event) => {
    event.preventDefault();
    try {
      await api.post('/admin/pricing-rules', {
        ...form,
        listing: form.listing || null,
        adjustmentValue: Number(form.adjustmentValue),
        priority: Number(form.priority),
      });
      toast.success('Pricing rule created');
      setForm(defaultRule);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to create pricing rule');
    }
  };

  const deleteRule = async (id) => {
    try {
      await api.delete(`/admin/pricing-rules/${id}`);
      toast.success('Pricing rule removed');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to remove pricing rule');
    }
  };

  if (loading) {
    return <PageLoader label="Loading pricing controls..." />;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Pricing Control"
        title="Seasonal and manual pricing logic"
        description="Configure flat or percentage adjustments globally, by type, or for a specific listing."
      />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <form className="glass rounded-[2rem] p-6" onSubmit={createRule}>
          <h2 className="text-2xl font-semibold text-white">Create pricing rule</h2>
          <div className="mt-5 grid gap-4">
            <input className="input" placeholder="Rule name" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
            <select className="input" value={form.listingType} onChange={(event) => setForm((prev) => ({ ...prev, listingType: event.target.value }))}>
              <option value="all">All listings</option>
              <option value="room">Rooms</option>
              <option value="trek">Treks</option>
              <option value="camp">Camps</option>
            </select>
            <select className="input" value={form.listing} onChange={(event) => setForm((prev) => ({ ...prev, listing: event.target.value }))}>
              <option value="">No specific listing</option>
              {listings.map((listing) => (
                <option key={listing._id} value={listing._id}>
                  {listing.name}
                </option>
              ))}
            </select>
            <div className="grid gap-4 md:grid-cols-2">
              <input className="input" type="date" value={form.startDate} onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))} />
              <input className="input" type="date" value={form.endDate} onChange={(event) => setForm((prev) => ({ ...prev, endDate: event.target.value }))} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <select className="input" value={form.adjustmentType} onChange={(event) => setForm((prev) => ({ ...prev, adjustmentType: event.target.value }))}>
                <option value="flat">Flat amount</option>
                <option value="percentage">Percentage</option>
              </select>
              <input className="input" type="number" placeholder="Adjustment value" value={form.adjustmentValue} onChange={(event) => setForm((prev) => ({ ...prev, adjustmentValue: event.target.value }))} />
            </div>
            <input className="input" type="number" placeholder="Priority" value={form.priority} onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value }))} />
            <button className="btn-primary" type="submit">
              Save Rule
            </button>
          </div>
        </form>

        <div className="glass rounded-[2rem] p-6">
          <h2 className="text-2xl font-semibold text-white">Active rules</h2>
          <div className="mt-5 space-y-4">
            {rules.map((rule) => (
              <div key={rule._id} className="rounded-[1.5rem] bg-slate-900/70 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-white">{rule.name}</p>
                    <p className="mt-2 text-sm text-slate-300">
                      {rule.listing?.name || rule.listingType} • {rule.adjustmentType} • {rule.adjustmentValue}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      {rule.startDate.slice(0, 10)} to {rule.endDate.slice(0, 10)} • Priority {rule.priority}
                    </p>
                  </div>
                  <button className="rounded-full border border-rose-400/30 px-4 py-2 text-sm font-semibold text-rose-300" onClick={() => deleteRule(rule._id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminPricingPage;
