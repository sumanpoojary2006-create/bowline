import { useEffect, useMemo, useState } from 'react';
import api from '../lib/api';
import './LaundryPage.css';
import './AdminLaundryPage.css';

const formatDate = () => new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'long',
  timeZone: 'Asia/Kolkata',
}).format(new Date());

export default function AdminLaundryPage() {
  const [data, setData] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [newItem, setNewItem] = useState({ name: '', count: '' });
  const [draftCounts, setDraftCounts] = useState({});
  const [reductionReasons, setReductionReasons] = useState({});
  const [pinDrafts, setPinDrafts] = useState({});

  const load = async () => {
    const response = await api.get('/admin/laundry');
    setData(response.data);
    setDraftCounts(Object.fromEntries(response.data.stock.map((item) => [item.id, String(item.stock ?? '')])));
  };

  useEffect(() => {
    load().catch((requestError) => setError(requestError.response?.data?.message || 'Unable to load laundry inventory.'));
  }, []);

  const totalStock = useMemo(
    () => data?.stock.reduce((sum, item) => sum + (Number(item.stock) || 0), 0) || 0,
    [data]
  );

  const run = async (key, action) => {
    setBusyKey(key);
    setMessage('');
    setError('');
    try {
      const response = await action();
      setMessage(response.data.message);
      return response;
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'That change could not be saved. Please try again.');
      return null;
    } finally {
      setBusyKey('');
    }
  };

  const addItem = async (event) => {
    event.preventDefault();
    const response = await run('add', () => api.post('/admin/laundry/stock', {
      name: newItem.name,
      count: Number(newItem.count),
      revision: data.revision,
    }));
    if (!response) return;
    setData((current) => ({ ...current, stock: response.data.stock, revision: response.data.revision }));
    setDraftCounts(Object.fromEntries(response.data.stock.map((item) => [item.id, String(item.stock)])));
    setNewItem({ name: '', count: '' });
  };

  const saveCount = async (item) => {
    const isReduction = Number(draftCounts[item.id]) < item.stock;
    const response = await run(`stock-${item.id}`, () => api.patch(`/admin/laundry/stock/${item.id}`, {
      count: Number(draftCounts[item.id]),
      revision: data.revision,
      reason: isReduction ? reductionReasons[item.id] : undefined,
    }));
    if (!response) return;
    setData((current) => ({
      ...current,
      stock: response.data.stock,
      revision: response.data.revision,
      adjustments: response.data.adjustment
        ? [response.data.adjustment, ...(current.adjustments || [])].slice(0, 30)
        : current.adjustments,
    }));
    setDraftCounts(Object.fromEntries(response.data.stock.map((stockItem) => [stockItem.id, String(stockItem.stock)])));
    setReductionReasons((current) => ({ ...current, [item.id]: '' }));
  };

  const savePin = async (staff) => {
    const response = await run(`pin-${staff.id}`, () => api.put(`/admin/laundry/staff/${staff.id}/pin`, {
      pin: pinDrafts[staff.id],
    }));
    if (!response) return;
    setPinDrafts((current) => ({ ...current, [staff.id]: '' }));
    setData((current) => ({
      ...current,
      staff: current.staff.map((person) => person.id === staff.id ? { ...person, hasLaundryPin: true } : person),
    }));
  };

  return (
    <div className="laundry-page laundry-admin-page">
      <header className="laundry-heading">
        <div>
          <p className="laundry-eyebrow">ADMIN CONTROL</p>
          <h1>Laundry inventory</h1>
          <p>Add linen items, correct available stock, and manage staff verification PINs.</p>
        </div>
        <div className="laundry-date">{formatDate()}<small>Live inventory · IST</small></div>
      </header>

      {message && <div role="status" className="laundry-notice laundry-success">{message}</div>}
      {error && <div role="alert" className="laundry-notice laundry-error">{error}</div>}

      {!data ? <div className="laundry-loading">Loading inventory…</div> : <>
        <div className="laundry-admin-summary">
          <div><span>Inventory types</span><strong>{data.stock.length}</strong></div>
          <div><span>Total pieces in stock</span><strong>{totalStock}</strong></div>
          <div><span>Active staff</span><strong>{data.staff.length}</strong></div>
          <div><span>PINs configured</span><strong>{data.staff.filter((staff) => staff.hasLaundryPin).length}/{data.staff.length}</strong></div>
        </div>

        <div className="laundry-admin-grid">
          <section className="laundry-panel laundry-inventory-panel">
            <div className="laundry-panel-head">
              <div><h2>Current inventory</h2><p>Update a count whenever new stock arrives or the physical stock is corrected.</p></div>
            </div>
            <div className="laundry-inventory-list">
              {data.stock.map((item, index) => {
                const unchanged = Number(draftCounts[item.id]) === item.stock;
                const invalid = draftCounts[item.id] === '' || Number(draftCounts[item.id]) < 0 || !Number.isInteger(Number(draftCounts[item.id]));
                const isReduction = !invalid && Number(draftCounts[item.id]) < item.stock;
                const missingReason = isReduction && !reductionReasons[item.id];
                return <div className="laundry-inventory-row" key={item.id}>
                  <span className="laundry-number">{String(index + 1).padStart(2, '0')}</span>
                  <strong>{item.name}</strong>
                  <label><span>Actual stock</span><input aria-label={`Actual stock for ${item.name}`} type="number" min="0" max="10000" value={draftCounts[item.id] ?? ''} onChange={(event) => setDraftCounts((current) => ({ ...current, [item.id]: event.target.value }))} /></label>
                  {isReduction
                    ? <label className="laundry-reason"><span>Why reduced?</span><select aria-label={`Reason for reducing ${item.name}`} value={reductionReasons[item.id] || ''} onChange={(event) => setReductionReasons((current) => ({ ...current, [item.id]: event.target.value }))}><option value="" disabled>Select</option><option value="lost">Lost</option><option value="damaged">Damaged</option></select></label>
                    : <span className="laundry-reason-placeholder" />}
                  <button type="button" disabled={unchanged || invalid || missingReason || Boolean(busyKey)} onClick={() => saveCount(item)}>{busyKey === `stock-${item.id}` ? 'Saving…' : 'Update count'}</button>
                </div>;
              })}
            </div>
          </section>

          <aside className="laundry-admin-side">
            <section className="laundry-panel laundry-add-panel">
              <div className="laundry-panel-head"><div><h2>Add new stock item</h2><p>Create a new inventory row and set its opening count.</p></div></div>
              <form onSubmit={addItem}>
                <label>Item name<input required minLength="2" maxLength="80" placeholder="Example: Bath mat" value={newItem.name} onChange={(event) => setNewItem((current) => ({ ...current, name: event.target.value }))} /></label>
                <label>Opening stock<input required type="number" min="0" max="10000" placeholder="0" value={newItem.count} onChange={(event) => setNewItem((current) => ({ ...current, count: event.target.value }))} /></label>
                <button disabled={Boolean(busyKey) || !newItem.name.trim() || newItem.count === ''}>{busyKey === 'add' ? 'Adding…' : '+ Add to inventory'}</button>
              </form>
            </section>

            <section className="laundry-panel laundry-pin-panel">
              <div className="laundry-panel-head"><div><h2>Staff verification PINs</h2><p>Set the private 4-digit PIN used at final laundry submission.</p></div></div>
              <div className="laundry-pin-list">
                {data.staff.length === 0 ? <p>No active staff accounts found.</p> : data.staff.map((staff) => <div key={staff.id}>
                  <span><strong>{staff.name}</strong><small>{staff.role} · {staff.hasLaundryPin ? 'PIN configured' : 'PIN not set'}</small></span>
                  <input aria-label={`4-digit PIN for ${staff.name}`} inputMode="numeric" type="password" maxLength="4" pattern="\d{4}" placeholder="••••" value={pinDrafts[staff.id] || ''} onChange={(event) => setPinDrafts((current) => ({ ...current, [staff.id]: event.target.value.replace(/\D/g, '').slice(0, 4) }))} />
                  <button type="button" disabled={Boolean(busyKey) || (pinDrafts[staff.id] || '').length !== 4} onClick={() => savePin(staff)}>{busyKey === `pin-${staff.id}` ? 'Saving…' : staff.hasLaundryPin ? 'Change PIN' : 'Set PIN'}</button>
                </div>)}
              </div>
            </section>
          </aside>
        </div>

        <section className="laundry-panel laundry-adjustment-history">
          <div className="laundry-panel-head"><div><h2>Recent lost and damaged stock</h2><p>These reductions are included automatically in the monthly admin email.</p></div></div>
          {(data.adjustments || []).length === 0
            ? <p className="laundry-adjustment-empty">No stock reductions have been recorded.</p>
            : <div className="laundry-adjustment-list">{data.adjustments.map((entry) => <div key={entry._id}>
              <span><strong>{entry.itemName}</strong><small>{new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(entry.createdAt))} · {entry.adminName}</small></span>
              <b className={`laundry-adjustment-reason ${entry.reason}`}>{entry.reason}</b>
              <strong>−{entry.quantity}</strong>
            </div>)}</div>}
        </section>
      </>}
    </div>
  );
}
