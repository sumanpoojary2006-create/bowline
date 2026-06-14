function Footer() {
  return (
    <footer className="border-t border-white/10 py-10">
      <div className="section-shell flex flex-col gap-4 text-sm text-slate-400 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-display text-2xl text-white">Bowline</p>
          <p>Bowline Nature Stay is a homestay in the hills with authentic Malnad food, shared spaces, and host-led local experiences.</p>
        </div>
        <div className="space-y-1 md:text-right">
          <p>Devaramane, Mudigere, Chikkamagaluru</p>
          <p>www.bowlinestays.com</p>
          <p>Breakfast complimentary | Meals Rs 350 per person per meal</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
