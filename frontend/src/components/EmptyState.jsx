function EmptyState({ title, description }) {
  return (
    <div className="glass rounded-[2rem] p-10 text-center">
      <h3 className="text-xl font-semibold text-white">{title}</h3>
      <p className="mt-3 text-sm text-slate-300">{description}</p>
    </div>
  );
}

export default EmptyState;
