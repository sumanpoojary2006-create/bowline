import { MagnifyingGlassIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import DatePicker from 'react-datepicker';
import { addDays, ensureCheckoutDate } from '../lib/dateUtils';

function SearchHero({ filters, setFilters, onSubmit }) {
  const updateStartDate = (date) => {
    setFilters((prev) => ({
      ...prev,
      startDate: date,
      endDate: prev.endDate && prev.endDate > date ? prev.endDate : addDays(date, 1),
    }));
  };

  return (
    <form
      onSubmit={onSubmit}
      className="glass grid gap-3 rounded-[1.75rem] p-3 lg:grid-cols-[0.95fr_0.95fr_0.95fr_auto]"
    >
      <label className="rounded-[1.25rem] bg-[#f0edd8] px-4 py-3 text-sm text-slate-900">
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Check in</span>
        <DatePicker
          selected={filters.startDate}
          onChange={(date) => updateStartDate(date)}
          className="w-full bg-transparent font-medium text-slate-900 outline-none"
          minDate={new Date()}
          dateFormat="EEE, MMM d"
        />
      </label>

      <label className="rounded-[1.25rem] bg-[#f0edd8] px-4 py-3 text-sm text-slate-900">
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Check out</span>
        <DatePicker
          selected={filters.endDate}
          onChange={(date) =>
            setFilters((prev) => ({
              ...prev,
              endDate: ensureCheckoutDate(prev.startDate, date, 1),
            }))
          }
          className="w-full bg-transparent font-medium text-slate-900 outline-none"
          minDate={filters.startDate ? addDays(filters.startDate, 1) : addDays(new Date(), 1)}
          dateFormat="EEE, MMM d"
        />
      </label>

      <div className="flex gap-3">
        <label className="flex-1 rounded-[1.25rem] bg-[#f0edd8] px-4 py-3 text-sm text-slate-900">
          <span className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            <UserGroupIcon className="h-4 w-4" />
            Guests
          </span>
          <select
            className="w-full bg-transparent font-medium text-slate-900 outline-none"
            value={filters.guests}
            onChange={(event) => setFilters((prev) => ({ ...prev, guests: event.target.value }))}
          >
            <option value="1">1 guest</option>
            <option value="2">2 guests</option>
            <option value="3">3 guests</option>
            <option value="4">4 guests</option>
            <option value="5">5 guests</option>
          </select>
        </label>

        <button className="btn-primary min-h-[72px] gap-2 rounded-[1.25rem] px-6" type="submit">
          <MagnifyingGlassIcon className="h-5 w-5" />
          Search
        </button>
      </div>
    </form>
  );
}

export default SearchHero;
