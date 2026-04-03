function Footer() {
  return (
    <footer className="border-t border-white/10 py-10">
      <div className="section-shell flex flex-col gap-4 text-sm text-slate-400 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-display text-2xl text-white">Bowline</p>
          <p>Stay bookings, guided treks, and camping experiences crafted for the outdoors.</p>
        </div>
        <div className="space-y-1 text-right">
          <p>Mudigere, Chikkamagaluru</p>
          <p>admin@bowline.com</p>
          <p>Built with React, Express, and MongoDB.</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
