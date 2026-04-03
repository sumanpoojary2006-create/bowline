function PageLoader({ label = 'Loading...' }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="glass rounded-3xl px-6 py-5 text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-amber-300/40 border-t-amber-300" />
        <p className="mt-4 text-sm text-slate-300">{label}</p>
      </div>
    </div>
  );
}

export default PageLoader;
