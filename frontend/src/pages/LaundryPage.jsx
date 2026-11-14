import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import employeeApi from '../lib/employeeApi';
import './LaundryPage.css';
import './LaundryStaffPage.css';

export default function LaundryPage() {
  const [data, setData] = useState(null);
  const [entries, setEntries] = useState({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const requestId = useRef(crypto.randomUUID());

  async function load() {
    const { data: result } = await employeeApi.get('/employee/laundry');
    setData(result);
    setEntries(Object.fromEntries(result.stock.map((item) => [item.id, { sent: 0, received: 0 }])));
  }

  useEffect(() => {
    load().catch((error) => setMessage(error.response?.data?.message || 'Unable to load laundry stock. Please reload.'));
  }, []);

  const rows = data?.stock || [];
  const availability = Object.fromEntries((data?.availability || []).map((item) => [item.id, item]));

  const change = (id, field, rawValue) => {
    const value = Number(rawValue);
    setEntries((current) => {
      const entry = current[id] || { sent: 0, received: 0 };
      return {
        ...current,
        [id]: { ...entry, [field]: value },
      };
    });
  };

  async function submit() {
    setBusy(true);
    try {
      const { data: result } = await employeeApi.post('/employee/laundry', {
        requestId: requestId.current,
        revision: data.revision,
        entries: rows.map((item) => ({ id: item.id, ...entries[item.id] })),
      });
      setMessage(result.message);
      requestId.current = crypto.randomUUID();
      setEntries(Object.fromEntries(rows.map((item) => [item.id, { sent: 0, received: 0 }])));
      setData((current) => ({
        ...current,
        availability: result.availability,
        history: [result.record, ...current.history.filter((record) => record._id !== result.record._id)],
      }));
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to confirm submission. Try again; your entry will not be duplicated.');
    } finally {
      setBusy(false);
    }
  }

  const complete = rows.length > 0 && rows.every((item) => {
    const entry = entries[item.id] || { sent: 0, received: 0 };
    const limits = availability[item.id] || { inHouse: item.stock, availableToSend: item.stock, availableToReceive: 0 };
    const inHouse = limits.inHouse - entry.sent + entry.received;
    return Number.isInteger(item.stock)
      && entry.sent <= limits.availableToSend
      && entry.received <= limits.availableToReceive
      && inHouse >= 0
      && inHouse <= item.stock;
  });

  return <div className="laundry-page laundry-staff-page">
    <div className="laundry-top"><Link to="/employee/dashboard">← Back to dashboard</Link><span>BOWLINE / HOUSEKEEPING</span></div>
    <header className="laundry-heading">
      <div><p className="laundry-eyebrow">EVERY PIECE, ACCOUNTED FOR</p><h1>Laundry dashboard</h1><p>Record what leaves for laundry and what returns to the stay.</p></div>
      <div className="laundry-date">{new Intl.DateTimeFormat('en-IN', { dateStyle: 'long', timeZone: 'Asia/Kolkata' }).format(new Date())}<small>Daily laundry record · IST</small></div>
    </header>

    {message && <div role="status" className="laundry-notice">{message}</div>}
    {!data ? <p>Loading inventory…</p> : <>
      {!data.sheetsConfigured && <div className="laundry-notice">Google Sheets connection pending. Records are saved in Bowline until the connection is configured.</div>}
      <section className="laundry-panel">
        <div className="laundry-panel-head"><div><h2>Daily laundry movement</h2><p>Set what's sent and received for each item, then submit.</p></div></div>
        <div className="laundry-table-wrap">
          <table className="laundry-staff-table">
            <thead><tr><th>Item</th><th>Sent <span className="laundry-arrow">↑</span></th><th>Received <span className="laundry-arrow">↓</span></th><th>🏠 In-house</th></tr></thead>
            <tbody>{rows.map((item, index) => {
              const entry = entries[item.id] || { sent: 0, received: 0 };
              const limits = availability[item.id] || { inHouse: item.stock || 0, previouslySent: 0, availableToSend: item.stock || 0, availableToReceive: 0 };
              const inHouse = item.stock === null ? null : limits.inHouse - entry.sent + entry.received;
              return <tr key={item.id}>
                <td data-label="Item"><span className="laundry-number">{String(index + 1).padStart(2, '0')}</span>{item.name}</td>
                <td data-label="Sent ↑"><select disabled={busy || item.stock === null} aria-label={`Sent ${item.name}`} title={`${limits.availableToSend} currently in-house and available to send`} value={entry.sent} onChange={(event) => change(item.id, 'sent', event.target.value)}>{Array.from({ length: limits.availableToSend + 1 }, (_, value) => <option key={value} value={value}>{value}</option>)}</select></td>
                <td data-label="Received ↓"><select disabled={busy || item.stock === null || limits.availableToReceive === 0} aria-label={`Received ${item.name}`} title={`Maximum ${limits.availableToReceive} can be received`} value={entry.received} onChange={(event) => change(item.id, 'received', event.target.value)}>{Array.from({ length: limits.availableToReceive + 1 }, (_, value) => <option key={value} value={value}>{value}</option>)}</select></td>
                <td data-label="In-house"><strong className="laundry-in-house">{inHouse ?? '—'}</strong></td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        <footer className="laundry-submit">
          <p>Review the sent and received quantities before submitting.</p>
          <button disabled={!complete || busy} onClick={submit}>{busy ? 'Submitting…' : `Submit as ${data.employee?.name || 'staff'} →`}</button>
        </footer>
      </section>

      <section className="laundry-panel laundry-history">
        <h2>Recent submissions</h2>
        {data.history.length === 0 ? <p>No records yet. Your first submission will appear here.</p> : data.history.map((record) => {
          const sent = record.rows.reduce((sum, row) => sum + (row.sent || 0), 0);
          const received = record.rows.reduce((sum, row) => sum + (row.received || 0), 0);
          return <div key={record._id}><span><strong>{record.staffName}</strong><small>{record.date} · Sent {sent} · Received {received}</small></span><span>{record.synced ? '✓ Google Sheets' : 'Sync pending'}</span></div>;
        })}
      </section>
    </>}

  </div>;
}
