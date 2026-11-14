import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  FireIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import heroImage from '../assets/marketing/starry-bowline.jpg';
import campfireImage from '../assets/marketing/campfire.jpg';
import ListingCard from '../components/ListingCard';
import api from '../lib/api';
import { buildGroupBookingListings, getRoomDisplayOrder } from '../lib/roomRates';
import { DEFAULT_FAQS } from '../lib/faqs';
import { CHECK_IN_TIME, CHECK_OUT_TIME } from '../lib/stayInfo';

const whatsappUrl =
  'https://wa.me/916360718604?text=Hi';
const inquiryWhatsappUrl =
  'https://wa.me/916366004404?text=Hi';

function WhatsAppIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
      <path d="M16.01 3A12.82 12.82 0 0 0 5.07 22.49L3.25 29l6.68-1.75A12.96 12.96 0 0 0 16 28.8h.01A12.9 12.9 0 0 0 16.01 3Zm7.5 18.21c-.32.9-1.87 1.72-2.58 1.82-.66.1-1.5.14-2.42-.15-.56-.18-1.28-.42-2.2-.81-3.87-1.67-6.39-5.57-6.58-5.83-.19-.26-1.57-2.09-1.57-3.99 0-1.9.99-2.84 1.35-3.23.35-.39.77-.49 1.03-.49h.74c.24.01.56-.09.87.67.32.77 1.09 2.66 1.19 2.85.1.19.16.42.03.68-.13.26-.19.42-.39.65-.19.23-.4.51-.58.68-.19.19-.39.4-.16.79.23.39 1.01 1.67 2.17 2.7 1.49 1.33 2.75 1.74 3.14 1.94.39.19.61.16.84-.1.23-.26.97-1.13 1.23-1.52.26-.39.52-.32.87-.19.36.13 2.26 1.06 2.65 1.26.39.19.65.29.74.45.1.17.1.94-.22 1.84Z" />
    </svg>
  );
}

const experiences = [
  ['Secret trail', 'A host-guided, easy 5 km round trip through a trail marked and maintained by Bowline.'],
  ['Hidden waterfall', 'A quiet local waterfall about 3 km away, shared with guests away from tourist crowds.'],
  ['Freshwater stream', 'A five-minute walk to mountain-fed water, with life jackets provided for swimming.'],
  ['4×4 off-road drive', 'Reach a scenic hilltop without the climb in a Bolero 4×4. Optional and paid.'],
  ['Devaramane sunset', 'A 1,400-year-old temple and sunset viewpoint around 20 minutes from the stay.'],
  ['Campfire evenings', 'Slow evenings with shared stories, games and the sounds of the Western Ghats.'],
];

function SectionHeading({ eyebrow, title, copy }) {
  return (
    <div className="max-w-2xl">
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-lime-200/80">{eyebrow}</p>
      <h2 className="mt-4 font-display text-4xl font-bold leading-[1.08] tracking-[-0.035em] text-white sm:text-5xl">{title}</h2>
      {copy && <p className="mt-5 text-base font-medium leading-8 !text-[#e1e8de] sm:text-lg">{copy}</p>}
    </div>
  );
}

function HomePage() {
  const reduceMotion = useReducedMotion();
  const location = useLocation();
  const [openFaq, setOpenFaq] = useState(-1);
  const [faqs, setFaqs] = useState(DEFAULT_FAQS);
  const [roomListings, setRoomListings] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomsError, setRoomsError] = useState(false);
  const roomCarouselRef = useRef(null);

  useEffect(() => {
    document.title = 'Bowline Nature Stay | Mudigere, Chikkamagaluru';
    const description = document.querySelector('meta[name="description"]');
    if (description) {
      description.setAttribute(
        'content',
        'A quiet, host-led nature stay near Devaramane, Mudigere with cozy rooms, Malnad food, hidden trails, waterfalls and campfire evenings.'
      );
    }
  }, []);

  useEffect(() => {
    const targetId = decodeURIComponent(location.hash.replace(/^#/, ''));
    if (!targetId) return undefined;

    const scrollToTarget = () => {
      document.getElementById(targetId)?.scrollIntoView({ block: 'start', behavior: 'auto' });
    };

    let secondFrame;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(scrollToTarget);
    });
    const settledLayoutTimer = window.setTimeout(scrollToTarget, 350);

    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
      window.clearTimeout(settledLayoutTimer);
    };
  }, [location.hash, roomsLoading, faqs.length]);

  useEffect(() => {
    let isCurrent = true;

    api.get('/content/faqs')
      .then(({ data }) => {
        if (isCurrent && Array.isArray(data.faqs)) setFaqs(data.faqs);
      })
      .catch(() => {
        // The built-in FAQ copy remains visible if content loading fails.
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    let isCurrent = true;

    const fetchRooms = async () => {
      try {
        const { data } = await api.get('/listings', {
          params: { type: 'room', limit: 8, includeBundleExtras: true },
        });
        if (!isCurrent) return;
        const sortedRooms = [...data.listings].sort(
          (a, b) => getRoomDisplayOrder(a) - getRoomDisplayOrder(b)
        );
        const standaloneRooms = sortedRooms.filter((room) => room.slug !== 'dormitory-open-loft');
        setRoomListings([...standaloneRooms, ...buildGroupBookingListings(sortedRooms)]);
      } catch {
        if (isCurrent) setRoomsError(true);
      } finally {
        if (isCurrent) setRoomsLoading(false);
      }
    };

    fetchRooms();
    return () => {
      isCurrent = false;
    };
  }, []);

  const scrollRoomCarousel = (direction) => {
    const carousel = roomCarouselRef.current;
    if (!carousel) return;

    const firstCard = carousel.querySelector('[data-room-card]');
    const cardWidth = firstCard?.getBoundingClientRect().width || carousel.clientWidth * 0.82;
    carousel.scrollBy({ left: direction * (cardWidth + 20), behavior: 'smooth' });
  };

  return (
    <div className="overflow-hidden bg-transparent pb-6 text-[#f7f2e5]">
      <section className="relative min-h-[calc(100svh-4.5rem)]">
        <img
          src={heroImage}
          alt="Bowline Nature Stay beneath the mountains and a star-filled sky"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-[#00152b]/20 to-[#07100a]/55" />
        <div className="section-shell relative flex min-h-[calc(100svh-4.5rem)] flex-col items-center pt-[9vh] text-center sm:pt-[13vh]">
          <div className="max-w-4xl">
            <h1 className="font-display text-[2.7rem] font-extrabold leading-[0.98] tracking-[-0.045em] !text-white drop-shadow-[0_4px_28px_rgba(0,0,0,0.75)] sm:text-7xl lg:text-[5.5rem]">
              Bowline<br className="sm:hidden" /> Nature Stay
            </h1>
            <p className="mt-4 text-base font-semibold tracking-[0.04em] !text-lime-200 drop-shadow-md sm:mt-5 sm:text-2xl">
              <span aria-hidden="true">📍</span> Mudigere, Chikkamagaluru
            </p>
            <div className="mt-4 flex flex-col items-center justify-center gap-2 text-sm font-medium text-white/90 drop-shadow sm:mt-5 sm:flex-row sm:flex-wrap sm:gap-x-3 sm:text-base">
              <span>🕥 5 hours from Bengaluru</span>
              <span className="hidden text-white/50 sm:inline">·</span>
              <span>🕥 3 hours from Mangaluru</span>
            </div>
          </div>
        </div>
      </section>

      <div className="px-4 py-5 text-center">
        <a
          className="inline-flex items-center justify-center gap-2 text-xs font-semibold leading-5 !text-[#dbe6d8] transition hover:!text-lime-200 sm:text-sm"
          href={inquiryWhatsappUrl}
          target="_blank"
          rel="noreferrer"
        >
          <WhatsAppIcon className="h-4 w-4 shrink-0 text-[#25D366]" />
          For any inquiries you can contact here.
        </a>
      </div>

      <section id="stay" className="section-shell py-16 sm:py-20">
        <div className="flex items-end justify-between gap-5">
          <SectionHeading
            eyebrow="The stay"
            title="Choose the room that feels right."
            copy="See each room’s photos, sleeping arrangement, guest capacity and live pricing. Compare every room and group option."
          />
          <div className="hidden shrink-0 gap-2 sm:flex" aria-label="Room carousel controls">
            <button
              type="button"
              aria-label="Previous room"
              onClick={() => scrollRoomCarousel(-1)}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-lime-100/20 bg-white/[0.06] text-lime-100 transition hover:bg-lime-100/15 focus:outline-none focus:ring-2 focus:ring-lime-200/60"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Next room"
              onClick={() => scrollRoomCarousel(1)}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-lime-100/20 bg-white/[0.06] text-lime-100 transition hover:bg-lime-100/15 focus:outline-none focus:ring-2 focus:ring-lime-200/60"
            >
              <ChevronRightIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {roomsLoading ? (
          <div className="mt-12 grid gap-5 overflow-hidden sm:flex" aria-label="Loading rooms">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-[32rem] w-full animate-pulse rounded-[1.75rem] border border-white/10 bg-white/[0.05] sm:w-[22rem] sm:max-w-[24rem] sm:shrink-0 lg:w-[24rem]" />
            ))}
          </div>
        ) : roomListings.length ? (
          <div
            ref={roomCarouselRef}
            role="region"
            aria-label="Rooms and group booking options"
            tabIndex={0}
            className="mt-12 grid items-stretch gap-5 pb-4 sm:flex sm:snap-x sm:snap-mandatory sm:overflow-x-auto sm:scroll-smooth sm:[-ms-overflow-style:none] sm:[scrollbar-width:none] sm:[&::-webkit-scrollbar]:hidden"
          >
            {roomListings.map((listing) => (
              <div
                key={listing._id}
                data-room-card
                className="w-full self-stretch sm:w-[22rem] sm:max-w-[24rem] sm:shrink-0 sm:snap-start lg:w-[24rem]"
              >
                <ListingCard listing={listing} compact showPrice />
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-12 rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-7 text-center">
            <p className="font-semibold text-white">
              {roomsError ? 'Room details could not be loaded right now.' : 'No rooms are currently listed.'}
            </p>
            <Link className="mt-5 inline-flex rounded-full bg-lime-200 px-6 py-3 font-bold !text-[#102013]" to="/stays">
              Check availability
            </Link>
          </div>
        )}

        <div className="mt-8 flex flex-col items-center justify-between gap-5 rounded-[1.75rem] border border-lime-100/15 bg-lime-100/[0.06] p-6 text-center sm:flex-row sm:text-left">
          <div>
            <p className="font-semibold text-white">Want to compare dates across every room?</p>
            <p className="mt-1 text-sm font-medium !text-[#c9d4c6]">Breakfast is included. Weekend rates may vary.</p>
          </div>
          <Link className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#dff5aa] px-6 py-3 font-bold !text-[#102013] transition hover:bg-[#e9fac2]" to="/stays">
            View all availability <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section id="about" className="section-shell py-16 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <SectionHeading
            eyebrow="About Bowline"
            title="The feeling of home, without the hurry."
            copy="Bowline is a small, offbeat homestay surrounded by mountains, native trees and fresh water. It is not designed around crowds or a packed resort schedule. Your hosts live on the property, help shape your days and share the places that only the local community knows."
          />
          <div className="grid grid-cols-2 gap-3">
            {[
              ['5 hrs', 'from Bengaluru'],
              ['3 hrs', 'from Mangaluru'],
              ['20 min', 'to Devaramane'],
              ['2 nights', 'recommended stay'],
            ].map(([value, label]) => (
              <div key={label} className="rounded-[1.75rem] border border-lime-100/15 bg-gradient-to-br from-white/[0.08] to-lime-100/[0.025] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.16)] sm:p-6">
                <p className="font-display text-3xl font-bold tracking-[-0.03em] text-lime-100 sm:text-4xl">{value}</p>
                <p className="mt-2 text-sm font-medium leading-5 !text-[#d2dccf]">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="experiences" className="border-y border-white/10 bg-transparent py-16 sm:py-20">
        <div className="section-shell">
          <SectionHeading
            eyebrow="Your days here"
            title="Nature is the itinerary."
            copy="Choose rest, adventure or a little of both. Complimentary experiences are arranged around weather, safety and the pace of the group."
          />
          <div className="mt-12 grid gap-px overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
            {experiences.map(([title, copy], index) => (
              <article key={title} className="bg-black/20 p-6 backdrop-blur-[2px] sm:p-8">
                <span className="font-display text-2xl text-lime-200/50">0{index + 1}</span>
                <h3 className="mt-8 text-xl font-semibold text-white">{title}</h3>
                <p className="mt-3 font-medium leading-7 !text-[#d2dccf]">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-shell py-16 sm:py-20">
        <div className="relative overflow-hidden rounded-[2.25rem]">
          <img src={campfireImage} alt="Guests gathered around the Bowline campfire" className="h-[34rem] w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/35 to-transparent" />
          <div className="absolute inset-0 flex max-w-2xl flex-col justify-end p-7 sm:p-12">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-lime-200">Hosted, not serviced</p>
            <h2 className="mt-4 font-display text-4xl font-bold leading-tight tracking-[-0.035em] text-white sm:text-6xl">Come as guests. Leave knowing the place.</h2>
            <p className="mt-5 max-w-lg text-base font-medium leading-7 !text-white/90">Suhan guides the trails and adventures. Pavithra brings warmth and care to the stay. Together, they help plan each day around what you actually came here for.</p>
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-transparent py-16 text-[#f7f2e5] sm:py-20">
        <div className="section-shell grid gap-12 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-lime-200/80">A two-night rhythm</p>
            <h2 className="mt-4 font-display text-4xl font-bold leading-tight tracking-[-0.035em] sm:text-5xl">Enough time to arrive, explore and slow down.</h2>
          </div>
          <ol className="space-y-7">
            {[
              ['Day 1', `Have lunch along the way, check in from ${CHECK_IN_TIME}, swim in the stream, visit Devaramane for sunset, then return for a pre-booked dinner and a campfire.`],
              ['Day 2', 'Breakfast, a guided secret-trail trek, lunch, the hidden waterfall and an optional off-road drive before another slow evening.'],
              ['Day 3', `A relaxed breakfast and check-out by ${CHECK_OUT_TIME}.`],
            ].map(([day, copy]) => (
              <li key={day} className="grid grid-cols-[4.5rem_1fr] gap-4 border-t border-white/15 pt-6">
                <span className="font-semibold text-lime-200/80">{day}</span>
                <p className="leading-7">{copy}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section-shell py-16 sm:py-20">
        <SectionHeading eyebrow="Included & available" title="Comfort where it matters." />
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [SparklesIcon, 'Home-cooked food', 'Complimentary breakfast; simple regional meals available.'],
            [FireIcon, 'Campfire nights', 'A shared campfire and projector for easy evenings together.'],
            [CheckIcon, 'Everyday essentials', 'Hot water, Wi-Fi, first aid and a shared kitchen.'],
            [ClockIcon, 'A slower pace', 'Quiet hours from 10 PM to 8 AM keep the hills peaceful.'],
          ].map(([Icon, title, copy]) => (
            <div key={title} className="rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-6">
              <Icon className="h-6 w-6 text-lime-200" />
              <h3 className="mt-7 text-lg font-semibold text-white">{title}</h3>
              <p className="mt-2 text-sm font-medium leading-6 !text-[#d2dccf]">{copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="faqs" className="scroll-mt-[4.5rem] border-t border-white/10 bg-transparent py-16 sm:py-20">
        <div className="section-shell grid gap-12 lg:grid-cols-[0.7fr_1.3fr]">
          <div>
            <SectionHeading eyebrow="Before you visit" title="Questions, answered honestly." />
            <p className="mt-6 text-sm font-medium leading-6 !text-[#c9d4c6]">Need something more specific? WhatsApp the hosts directly and they’ll help.</p>
          </div>
          <div className="divide-y divide-white/10 border-y border-white/10">
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div key={faq.id || faq.question}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-5 py-5 text-left text-base font-semibold text-white sm:text-lg"
                    onClick={() => setOpenFaq(isOpen ? -1 : index)}
                    aria-expanded={isOpen}
                  >
                    {faq.question}
                    <ChevronDownIcon className={`h-5 w-5 shrink-0 text-lime-200 transition ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        className="overflow-hidden"
                        initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
                        transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <p className="max-w-2xl whitespace-pre-line break-words pb-6 pr-4 font-medium leading-7 !text-[#d2dccf] sm:pr-8">
                          {faq.answer}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section-shell py-16 text-center sm:py-20">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-lime-200/80">Ready when you are</p>
        <h2 className="mx-auto mt-4 max-w-3xl font-display text-4xl font-bold leading-tight tracking-[-0.035em] sm:text-6xl">Your quieter corner of the Western Ghats.</h2>
        <p className="mx-auto mt-5 max-w-xl font-medium leading-7 !text-[#d2dccf]">Check live room availability online or speak directly with Pavithra and Suhan on WhatsApp.</p>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#07100a]/95 px-3 py-3 shadow-[0_-16px_50px_rgba(0,0,0,0.42)] backdrop-blur-xl sm:px-5 sm:py-4">
        <div className="mx-auto grid max-w-3xl grid-cols-2 gap-2.5 sm:gap-4">
          <a
            className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-3 text-center text-sm font-bold !text-[#05210e] shadow-[0_8px_24px_rgba(37,211,102,0.2)] transition hover:bg-[#35df73] sm:min-h-[60px] sm:gap-3 sm:rounded-full sm:text-base"
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#20b858] sm:h-9 sm:w-9">
              <WhatsAppIcon className="h-5 w-5 sm:h-6 sm:w-6" />
            </span>
            <span>Book on WhatsApp</span>
          </a>
          <Link className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-[#dff5aa] px-3 text-center text-sm font-bold !text-[#102013] shadow-[0_8px_24px_rgba(223,245,170,0.12)] transition hover:bg-[#e9fac2] sm:min-h-[60px] sm:gap-3 sm:rounded-full sm:text-base" to="/stays">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#102013] text-lg sm:h-9 sm:w-9 sm:text-xl" aria-hidden="true">📅</span>
            <span>Book on website</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
