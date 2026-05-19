import { ChevronLeftIcon, ChevronRightIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useEffect, useRef, useState } from 'react';
import api from '../lib/api';
import { formatCurrency, formatDate } from '../lib/formatters';
import PageLoader from '../components/PageLoader';
import SectionHeader from '../components/SectionHeader';

const STATUS_STYLES = {
  confirmed: {
    bar: 'bg-lime-500/80 border-lime-400/60 text-slate-900',
    dot: 'bg-lime-400',
    label: 'Confirmed',
  },
  pending: {
    bar: 'bg-amber-500/80 border-amber-400/60 text-slate-900',
    dot: 'bg-amber-400',
    label: 'Pending',
  },
  cancelled: {
    bar: 'bg-slate-600/60 border-slate-500/40 text-slate-300 line-through',
    dot: 'bg-slate-500',
    label: 'Cancelled',
  },
};

function toYearMonth(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function parseYearMonth(str) {
  const [y, m] = str.split('-').map(Number);
  return new Date(y, m - 1, 1);
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function dayKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function BookingDetail({ booking, onClose, anchorRef }) {
  const nights = Math.max(
    Math.round((new Date(booking.endDate) - new Date(booking.startDate)) / 86400000),
    1
  );
  const style = STATUS_STYLES[booking.status] || STATUS_STYLES.pending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-sm rounded-[2rem] border border-white/10 bg-[#0d1710] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:text-white"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>

        <div className="mb-1 flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} />
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {style.label}
          </span>
        </div>

        <h3 className="mt-2 text-xl font-bold text-white">{booking.listing?.name}</h3>

        <div className="mt-4 space-y-2 text-sm text-slate-300">
          <div className="flex justify-between">
            <span className="text-slate-500">Guest</span>
            <span>{booking.contactName || booking.user?.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Email</span>
            <span className="truncate ml-4 text-right">{booking.contactEmail || booking.user?.email}</span>
          </div>
          {booking.contactPhone && (
            <div className="flex justify-between">
              <span className="text-slate-500">Phone</span>
              <span>{booking.contactPhone}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-slate-500">Check-in</span>
            <span>{formatDate(booking.startDate)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Check-out</span>
            <span>{formatDate(booking.endDate)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Duration</span>
            <span>{nights} night{nights > 1 ? 's' : ''}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Guests</span>
            <span>{booking.guests}</span>
          </div>
          {booking.isGroupBooking && (
            <div className="flex justify-between">
              <span className="text-slate-500">Group</span>
              <span>{booking.groupName || 'Yes'}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-white/10 pt-2">
            <span className="text-slate-500">Value</span>
            <span className="font-bold text-lime-300">{formatCurrency(booking.totalPrice)}</span>
          </div>
          {booking.specialRequests && (
            <div className="pt-1">
              <p className="text-slate-500">Notes</p>
              <p className="mt-1 rounded-xl bg-white/5 px-3 py-2 text-xs text-slate-300">
                {booking.specialRequests}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminCalendarPage() {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(toYearMonth(today));
  const [bookings, setBookings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const anchorRef = useRef(null);

  const monthDate = parseYearMonth(currentMonth);
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const totalDays = daysInMonth(year, month);
  const days = Array.from({ length: totalDays }, (_, i) => new Date(year, month, i + 1));

  useEffect(() => {
    document.title = 'Bowline Admin | Calendar';
    const fetchRooms = async () => {
      const { data } = await api.get('/listings/admin/all');
      setRooms(data.listings.filter((l) => l.type === 'room' && l.active));
    };
    fetchRooms();
  }, []);

  useEffect(() => {
    const fetchCalendar = async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/bookings/admin/calendar', {
          params: { month: currentMonth },
        });
        setBookings(data.bookings);
      } finally {
        setLoading(false);
      }
    };
    fetchCalendar();
  }, [currentMonth]);

  const prevMonth = () => {
    const d = parseYearMonth(currentMonth);
    d.setMonth(d.getMonth() - 1);
    setCurrentMonth(toYearMonth(d));
  };

  const nextMonth = () => {
    const d = parseYearMonth(currentMonth);
    d.setMonth(d.getMonth() + 1);
    setCurrentMonth(toYearMonth(d));
  };

  const monthLabel = monthDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  // Build a lookup: roomId → bookings sorted by start
  const bookingsByRoom = {};
  for (const b of bookings) {
    const rid = b.listing?._id;
    if (!rid) continue;
    if (!bookingsByRoom[rid]) bookingsByRoom[rid] = [];
    bookingsByRoom[rid].push(b);
  }

  // Summary counts
  const confirmedCount = bookings.filter((b) => b.status === 'confirmed').length;
  const pendingCount = bookings.filter((b) => b.status === 'pending').length;

  // Today's column index (0-based within current month view)
  const todayIdx =
    today.getFullYear() === year && today.getMonth() === month ? today.getDate() - 1 : -1;

  if (loading && rooms.length === 0) {
    return <PageLoader label="Loading calendar..." />;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Room Calendar"
        title="Occupancy overview"
        description={`${confirmedCount} confirmed · ${pendingCount} pending this month`}
      />

      {/* Month nav + legend */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={prevMonth}
            className="rounded-full border border-white/10 p-2 text-slate-400 hover:text-white"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <h2 className="min-w-[180px] text-center text-lg font-semibold text-white">{monthLabel}</h2>
          <button
            onClick={nextMonth}
            className="rounded-full border border-white/10 p-2 text-slate-400 hover:text-white"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCurrentMonth(toYearMonth(today))}
            className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-400 hover:text-white"
          >
            Today
          </button>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-400">
          {Object.entries(STATUS_STYLES).map(([key, s]) => (
            <span key={key} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
              {s.label}
            </span>
          ))}
        </div>
      </div>

      {/* Calendar grid */}
      <div className="overflow-x-auto rounded-[2rem] border border-white/10 bg-[#0d1710]/70">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-sm text-slate-400">Loading bookings...</p>
          </div>
        ) : (
          <table className="w-full border-collapse" style={{ minWidth: `${Math.max(totalDays * 36 + 160, 800)}px` }}>
            <thead>
              <tr className="border-b border-white/10">
                {/* Room name header */}
                <th className="sticky left-0 z-10 w-40 min-w-[160px] bg-[#0d1710] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Room
                </th>
                {days.map((day, idx) => {
                  const isToday = idx === todayIdx;
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                  return (
                    <th
                      key={idx}
                      className={`w-9 min-w-[36px] px-0.5 py-2 text-center text-xs ${
                        isToday
                          ? 'font-bold text-lime-300'
                          : isWeekend
                          ? 'text-slate-400'
                          : 'text-slate-500'
                      }`}
                    >
                      <div>{day.getDate()}</div>
                      <div className="text-[9px] uppercase opacity-60">
                        {day.toLocaleDateString('en-IN', { weekday: 'short' }).slice(0, 2)}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {rooms.length === 0 && (
                <tr>
                  <td colSpan={totalDays + 1} className="py-12 text-center text-sm text-slate-500">
                    No active rooms found.
                  </td>
                </tr>
              )}
              {rooms.map((room, roomIdx) => {
                const roomBookings = bookingsByRoom[room._id] || [];

                // Build a day-indexed map for this room: dayKey → booking
                const dayMap = {};
                for (const b of roomBookings) {
                  const start = new Date(b.startDate);
                  const end = new Date(b.endDate);
                  const cur = new Date(start);
                  while (cur < end) {
                    dayMap[dayKey(cur)] = b;
                    cur.setDate(cur.getDate() + 1);
                  }
                }

                return (
                  <tr
                    key={room._id}
                    className={`border-b border-white/5 ${roomIdx % 2 === 0 ? '' : 'bg-white/[0.02]'}`}
                  >
                    {/* Room name cell */}
                    <td className="sticky left-0 z-10 bg-[#0d1710] px-4 py-2">
                      <p className="max-w-[140px] truncate text-sm font-medium text-slate-200">
                        {room.name}
                      </p>
                      <p className="text-[10px] text-slate-500">max {room.capacity}</p>
                    </td>

                    {/* Day cells */}
                    {days.map((day, idx) => {
                      const dk = dayKey(day);
                      const booking = dayMap[dk];
                      const isToday = idx === todayIdx;

                      if (!booking) {
                        return (
                          <td
                            key={idx}
                            className={`h-12 w-9 px-0 py-1 ${isToday ? 'bg-lime-900/20' : ''}`}
                          />
                        );
                      }

                      const style = STATUS_STYLES[booking.status] || STATUS_STYLES.pending;
                      const bStart = new Date(booking.startDate);
                      // Clamp to month view
                      const viewStart = new Date(year, month, 1);
                      const isFirstDayOfBookingInView =
                        isSameDayLocal(day, bStart) || isSameDayLocal(day, viewStart);
                      const isActualStart = isSameDayLocal(day, bStart);

                      const bEnd = new Date(booking.endDate);
                      bEnd.setDate(bEnd.getDate() - 1); // last night
                      const isLastDay = isSameDayLocal(day, bEnd);

                      const showLabel = isActualStart || (day.getDate() === 1);

                      return (
                        <td
                          key={idx}
                          className={`h-12 w-9 cursor-pointer px-0 py-1 ${isToday ? 'bg-lime-900/20' : ''}`}
                          onClick={() => setSelectedBooking(booking)}
                          ref={showLabel ? anchorRef : undefined}
                        >
                          <div
                            className={`flex h-8 items-center border-y px-1 text-[10px] font-semibold leading-none transition-opacity hover:opacity-80 ${style.bar} ${
                              isActualStart ? 'rounded-l-full border-l pl-2' : 'border-l-0'
                            } ${isLastDay ? 'rounded-r-full border-r pr-2' : 'border-r-0'}`}
                          >
                            {showLabel && (
                              <span className="truncate max-w-[100px]">
                                {booking.contactName || booking.user?.name || ''}
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Occupancy summary strip */}
      {!loading && rooms.length > 0 && (
        <div className="rounded-[2rem] border border-white/10 bg-[#0d1710]/70 p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Daily occupancy — {monthLabel}
          </h3>
          <div className="overflow-x-auto">
            <div
              className="flex gap-px"
              style={{ minWidth: `${Math.max(totalDays * 36, 600)}px` }}
            >
              {days.map((day, idx) => {
                const dk = dayKey(day);
                const occupied = rooms.filter((room) => {
                  const roomBookings = bookingsByRoom[room._id] || [];
                  return roomBookings.some((b) => {
                    const start = new Date(b.startDate);
                    const end = new Date(b.endDate);
                    return b.status !== 'cancelled' && day >= start && day < end;
                  });
                }).length;
                const pct = rooms.length ? (occupied / rooms.length) * 100 : 0;
                const isToday = idx === todayIdx;

                return (
                  <div
                    key={idx}
                    className="flex flex-1 flex-col items-center gap-1"
                    title={`${day.getDate()} ${monthDate.toLocaleDateString('en-IN', { month: 'short' })}: ${occupied}/${rooms.length} rooms`}
                  >
                    <div className="relative h-16 w-full min-w-[28px] overflow-hidden rounded-t-lg bg-white/5">
                      <div
                        className={`absolute bottom-0 w-full rounded-t-md transition-all ${
                          pct > 75 ? 'bg-rose-500/70' : pct > 40 ? 'bg-amber-500/70' : 'bg-lime-500/70'
                        }`}
                        style={{ height: `${pct}%` }}
                      />
                      {isToday && (
                        <div className="absolute inset-x-0 top-0 h-full border-2 border-lime-400/60 rounded-t-md" />
                      )}
                    </div>
                    <span className={`text-[9px] ${isToday ? 'text-lime-300 font-bold' : 'text-slate-600'}`}>
                      {day.getDate()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-lime-500/70" /> Low (&lt;40%)</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-amber-500/70" /> Moderate (40–75%)</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-rose-500/70" /> High (&gt;75%)</span>
          </div>
        </div>
      )}

      {selectedBooking && (
        <BookingDetail
          booking={selectedBooking}
          anchorRef={anchorRef}
          onClose={() => setSelectedBooking(null)}
        />
      )}
    </div>
  );
}

function isSameDayLocal(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default AdminCalendarPage;
