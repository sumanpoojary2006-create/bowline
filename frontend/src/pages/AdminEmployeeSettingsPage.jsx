import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import PageLoader from '../components/PageLoader';
import SectionHeader from '../components/SectionHeader';

function AdminEmployeeSettingsPage() {
  const [ips, setIps] = useState([]);
  const [newIp, setNewIp] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSetting = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/settings/wifi');
      setIps(data.allowedIps);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Bowline Admin | Employee Settings';
    fetchSetting();
  }, []);

  const save = async (nextIps) => {
    setSaving(true);
    try {
      const { data } = await api.put('/admin/settings/wifi', { allowedIps: nextIps });
      setIps(data.allowedIps);
      toast.success('WiFi settings updated');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to update settings');
    } finally {
      setSaving(false);
    }
  };

  const addIp = (event) => {
    event.preventDefault();
    const trimmed = newIp.trim();
    if (!trimmed || ips.includes(trimmed)) return;
    save([...ips, trimmed]);
    setNewIp('');
  };

  const removeIp = (ip) => {
    save(ips.filter((item) => item !== ip));
  };

  if (loading) {
    return <PageLoader label="Loading settings..." />;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Staff Management"
        title="Employee WiFi Settings"
        description="Employees can only check in while connected to the homestay's WiFi. Add the homestay's public IP address(es) here. To find it, visit whatismyip.com from a device connected to that WiFi."
      />

      <div className="glass max-w-xl rounded-[2rem] p-6">
        <h2 className="text-2xl font-semibold text-white">Allowed IP addresses</h2>
        <form className="mt-5 flex gap-3" onSubmit={addIp}>
          <input
            className="input"
            placeholder="e.g. 49.207.123.45"
            value={newIp}
            onChange={(event) => setNewIp(event.target.value)}
          />
          <button className="btn-primary" disabled={saving} type="submit">
            Add
          </button>
        </form>

        <div className="mt-5 space-y-3">
          {ips.length === 0 ? (
            <p className="text-sm text-slate-400">
              No IP addresses configured yet. Employee check-in will be blocked until one is added.
            </p>
          ) : (
            ips.map((ip) => (
              <div key={ip} className="flex items-center justify-between rounded-xl bg-slate-900/70 px-4 py-3">
                <span className="text-sm text-slate-200">{ip}</span>
                <button
                  className="rounded-full bg-rose-500/20 px-3 py-1 text-xs font-semibold text-rose-300"
                  disabled={saving}
                  onClick={() => removeIp(ip)}
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminEmployeeSettingsPage;
