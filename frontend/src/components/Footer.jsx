import { DINNER_PRICE, LUNCH_PRICE } from '../lib/stayInfo';

function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#050b07] pb-32 pt-10 md:pb-28">
      <div className="section-shell flex flex-col gap-4 text-sm text-slate-400 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-display text-2xl text-white">Bowline</p>
          <p>Bowline Nature Stay is a homestay in the hills with authentic Malnad food, shared spaces, and host-led local experiences.</p>
        </div>
        <div className="space-y-1 md:text-right">
          <p>Devaramane, Mudigere, Chikkamagaluru</p>
          <p><a className="hover:text-white" href="tel:+916366004404">+91 63660 04404</a> · <a className="hover:text-white" href="mailto:bowlinestays@gmail.com">bowlinestays@gmail.com</a></p>
          <p>Breakfast complimentary · Lunch ₹{LUNCH_PRICE} per person (not on day 1) · Dinner ₹{DINNER_PRICE} per person</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
