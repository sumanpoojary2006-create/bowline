function StatsCard({ label, value, hint }) {
  return (
    <div className="glass rounded-[2rem] p-5">
      <p className="text-sm text-[#b7c2b2]">{label}</p>
      <p className="mt-3 text-3xl font-bold text-white">{value}</p>
      {hint ? <p className="mt-2 text-xs text-lime-100/45">{hint}</p> : null}
    </div>
  );
}

export default StatsCard;
