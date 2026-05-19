import { MagnifyingGlassIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import DatePicker from 'react-datepicker';
import { useNavigate } from 'react-router-dom';
import { addDays, ensureCheckoutDate, formatDateParam } from '../lib/dateUtils';

function SearchHero({ filters, setFilters, onSubmit }) {
  const navigate = useNavigate();

  const updateStartDate = (date) => {
    setFilters((prev) => ({
      ...prev,
      startDate: date,
      endDate: prev.endDate && prev.endDate > date ? prev.endDate : addDays(date, 1),
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (filters.startDate && filters.endDate) {
      navigate(
        `/browse?startDate=${formatDateParam(filters.startDate)}&endDate=${formatDateParam(filters.endDate)}&guests=${filters.guests || 1}`
      );
    } else if (onSubmit) {
      onSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="glass grid gap-3 rounded-[1.75rem] p-3">
      {/* Dates side-by-side on all screen sizes */}
      <div className="grid grid-cols-2 gap-3">
        <label className="rounded-[1.25rem] bg-[#f0edd8] px-4 py-3 text-sm text-slate-900">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Check in</span>
          <DatePicker
            selected={filters.startDate}
            onChange={(date) => updateStartDate(date)}
            className="w-full bg-transparent text-base font-medium text-slate-900 outline-none"
            minDate={new Date()}
            dateFormat="MMM d"
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
            className="w-full bg-transparent text-base font-medium text-slate-900 outline-none"
            minDate={filters.startDate ? addDays(filters.startDate, 1) : addDays(new Date(), 1)}
            dateFormat="MMM d"
          />
        </label>
      </div>

      {/* Guests + Search: side-by-side on sm+, stacked on xs */}
      <div className="flex gap-3">
        <label className="flex-1 rounded-[1.25rem] bg-[#f0edd8] px-4 py-3 text-sm text-slate-900">
          <span className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            <UserGroupIcon className="h-4 w-4" />
            Guests
          </span>
          <select
            className="w-full bg-transparent text-base font-medium text-slate-900 outline-none"
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

        <button className="btn-primary gap-2 rounded-[1.25rem] px-6 lg:px-8" type="submit">
          <MagnifyingGlassIcon className="h-5 w-5" />
          <span className="hidden sm:inline">Search</span>
        </button>
      </div>
    </form>
  );
}

export default SearchHero;
