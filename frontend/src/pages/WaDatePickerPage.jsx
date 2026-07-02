import { useState } from 'react';
import FloatingDateRangePicker from '../components/FloatingDateRangePicker';

function fmt(date) {
  if (!date) return '';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtShort(date) {
  // Produces "12 Jul 2026" which parseDateRange accepts
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function WaDatePickerPage() {
  const params = new URLSearchParams(window.location.search);
  const room = params.get('room') || 'your room';

  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [open, setOpen] = useState(true);

  const handleChange = ({ startDate: s, endDate: e }) => {
    setStartDate(s || null);
    setEndDate(e || null);
  };

  const handleConfirm = () => {
    if (!startDate || !endDate) return;
    const text = `DATES: ${fmtShort(startDate)} - ${fmtShort(endDate)}`;
    // Opens the WhatsApp chat with pre-filled message
    window.location.href = `whatsapp://send?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-start px-4 pt-8 pb-24">
      <div className="w-full max-w-sm">
        <p className="text-xs uppercase tracking-widest text-amber-400 mb-1">Bowline Nature Stay</p>
        <h1 className="text-white font-display text-2xl mb-1">Select Dates</h1>
        <p className="text-slate-400 text-sm mb-6">{room}</p>

        <FloatingDateRangePicker
          open={open}
          startDate={startDate}
          endDate={endDate}
          onChange={handleChange}
          onComplete={() => {}}
          onClose={() => {}}
        />

        {startDate && endDate && (
          <div className="mt-6 rounded-2xl bg-slate-800 p-4 text-sm text-slate-300 space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">Check-in</span>
              <span className="text-white font-medium">{fmt(startDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Check-out</span>
              <span className="text-white font-medium">{fmt(endDate)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-700 pt-2 mt-2">
              <span className="text-slate-400">Nights</span>
              <span className="text-white font-medium">
                {Math.round((endDate - startDate) / 86400000)}
              </span>
            </div>
          </div>
        )}

        <button
          onClick={handleConfirm}
          disabled={!startDate || !endDate}
          className="mt-4 w-full rounded-2xl bg-amber-400 disabled:opacity-40 text-slate-900 font-semibold py-4 text-base"
        >
          Confirm Dates →
        </button>
      </div>
    </div>
  );
}
