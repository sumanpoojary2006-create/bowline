import AdventureGearCelebration from './AdventureGearCelebration';

function BookingSuccessOverlay({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-[fadeIn_0.25s_ease-out]">
      <AdventureGearCelebration />
      <div className="glass relative w-full max-w-sm rounded-[2rem] p-8 text-center animate-[popIn_0.35s_ease-out]">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-lime-400/10">
          <svg viewBox="0 0 52 52" className="h-16 w-16">
            <circle
              cx="26"
              cy="26"
              r="24"
              fill="none"
              stroke="#a3e635"
              strokeWidth="3"
              strokeLinecap="round"
              className="origin-center animate-[circleDraw_0.5s_ease-out_forwards]"
              style={{ strokeDasharray: 151, strokeDashoffset: 151 }}
            />
            <path
              fill="none"
              stroke="#a3e635"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M14 27l7 7 17-17"
              className="animate-[checkDraw_0.4s_ease-out_0.35s_forwards]"
              style={{ strokeDasharray: 36, strokeDashoffset: 36 }}
            />
          </svg>
        </div>

        <h2 className="mt-6 font-display text-2xl text-white">Booking Confirmed!</h2>
        <p className="mt-3 text-sm text-slate-300">Invoice has been sent to your email.</p>

        <button type="button" onClick={onClose} className="btn-primary mt-8 w-full">
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}

export default BookingSuccessOverlay;
