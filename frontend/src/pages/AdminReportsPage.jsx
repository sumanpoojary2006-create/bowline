import { ArrowDownTrayIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import api from '../lib/api';
import { formatDate } from '../lib/formatters';
import PageLoader from '../components/PageLoader';
import SectionHeader from '../components/SectionHeader';

function todayISO() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function AdminReportsPage() {
  const [date, setDate] = useState(todayISO());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState(null);

  useEffect(() => {
    document.title = 'Bowline Admin | Reports';
  }, []);

  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/admin/reports/daily', { params: { date } });
        setReport(data.report);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [date]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const { data } = await api.get('/admin/reports/daily/pdf', {
        params: { date },
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `guest-report-${date}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  const handleSendNow = async () => {
    setSending(true);
    setSendStatus(null);
    try {
      await api.post('/admin/reports/daily/send');
      setSendStatus({ ok: true, message: "Tomorrow's guest list email has been sent." });
    } catch (error) {
      setSendStatus({
        ok: false,
        message: error.response?.data?.message || 'Failed to send email. Check SMTP settings.',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Daily Report"
        title="Guest & meal report"
        description="Veg/non-veg counts and the full guest list for the selected day, ready to share with the team."
        action={
          <button
            onClick={handleDownload}
            disabled={downloading || loading}
            className="inline-flex items-center gap-2 rounded-full bg-lime-200 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-lime-100 disabled:opacity-60"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            {downloading ? 'Preparing...' : 'Download PDF'}
          </button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label htmlFor="report-date" className="text-sm text-slate-400">
            Date
          </label>
          <input
            id="report-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-full border border-white/10 bg-[#0d1710] px-4 py-2 text-sm text-white focus:border-lime-300 focus:outline-none"
          />
          <button
            onClick={() => setDate(todayISO())}
            className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-400 hover:text-white"
          >
            Today
          </button>
        </div>

        <div className="flex flex-col items-end gap-2">
          <button
            onClick={handleSendNow}
            disabled={sending}
            className="inline-flex items-center gap-2 rounded-full border border-lime-200/30 px-5 py-2.5 text-sm font-semibold text-lime-200 transition hover:bg-lime-200/10 disabled:opacity-60"
          >
            <PaperAirplaneIcon className="h-4 w-4" />
            {sending ? 'Sending...' : "Send Tomorrow's Guest List Now"}
          </button>
          {sendStatus && (
            <p className={`text-xs ${sendStatus.ok ? 'text-lime-300' : 'text-rose-400'}`}>{sendStatus.message}</p>
          )}
        </div>
      </div>

      {loading ? (
        <PageLoader label="Loading report..." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <SummaryCard label="Veg" value={report.totals.veg} accent="text-lime-300" />
            <SummaryCard label="Non-Veg" value={report.totals.nonVeg} accent="text-amber-300" />
            <SummaryCard label="Adults" value={report.totals.adults} />
            <SummaryCard label="Children" value={report.totals.children} />
            <SummaryCard label="Pets" value={report.totals.pets} />
          </div>

          <div className="overflow-x-auto rounded-[2rem] border border-white/10 bg-[#0d1710]/70">
            {report.entries.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500">
                No confirmed guests for {report.dateLabel}.
              </div>
            ) : (
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">Room</th>
                    <th className="px-4 py-3">Guest</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Dates</th>
                    <th className="px-4 py-3">Guests</th>
                    <th className="px-4 py-3">Pets</th>
                    <th className="px-4 py-3">Meals (V/NV)</th>
                    <th className="px-4 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {report.entries.map((entry) => (
                    <tr key={entry.bookingId} className="border-b border-white/5">
                      <td className="px-4 py-3 font-medium text-white">{entry.room}</td>
                      <td className="px-4 py-3 text-slate-300">{entry.contactName}</td>
                      <td className="px-4 py-3 text-slate-400">{entry.contactPhone || '-'}</td>
                      <td className="px-4 py-3 text-slate-400">
                        {formatDate(entry.checkIn)} - {formatDate(entry.checkOut)}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {entry.adultGuests} adult{entry.adultGuests > 1 ? 's' : ''}
                        {entry.childGuests ? `, ${entry.childGuests} child${entry.childGuests > 1 ? 'ren' : ''}` : ''}
                      </td>
                      <td className="px-4 py-3 text-slate-400">{entry.pets || '-'}</td>
                      <td className="px-4 py-3 text-slate-300">
                        {entry.vegCount} / {entry.nonVegCount}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{entry.specialRequests || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, accent = 'text-white' }) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-[#0d1710]/70 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${accent}`}>{value}</p>
    </div>
  );
}

export default AdminReportsPage;
