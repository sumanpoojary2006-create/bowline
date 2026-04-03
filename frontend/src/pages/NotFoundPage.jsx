import { Link } from 'react-router-dom';

function NotFoundPage() {
  return (
    <section className="section-shell py-16">
      <div className="mx-auto max-w-2xl glass rounded-[2rem] p-10 text-center">
        <p className="text-xs uppercase tracking-[0.35em] text-amber-300">404</p>
        <h1 className="mt-4 font-display text-5xl text-white">This trail ends here.</h1>
        <p className="mt-4 text-slate-300">The page you’re looking for doesn’t exist in the Bowline route map.</p>
        <Link className="btn-primary mt-8" to="/">
          Back to home
        </Link>
      </div>
    </section>
  );
}

export default NotFoundPage;
