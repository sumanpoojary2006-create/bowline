import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

function SearchHero({ filters, setFilters, onSubmit }) {
  return (
    <form
      onSubmit={onSubmit}
      className="glass grid gap-4 rounded-[2rem] p-4 md:grid-cols-[1.3fr_1fr_1fr_auto] md:p-5"
    >
      <div>
        <label className="label">Where or what are you looking for?</label>
        <input
          className="input"
          placeholder="Mudigere, trek, camp..."
          value={filters.search}
          onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
        />
      </div>
      <div>
        <label className="label">Experience type</label>
        <select
          className="input"
          value={filters.type}
          onChange={(event) => setFilters((prev) => ({ ...prev, type: event.target.value }))}
        >
          <option value="">All</option>
          <option value="room">Stays</option>
          <option value="trek">Treks</option>
          <option value="camp">Camps</option>
        </select>
      </div>
      <div>
        <label className="label">Location</label>
        <input
          className="input"
          placeholder="Chikkamagaluru"
          value={filters.location}
          onChange={(event) => setFilters((prev) => ({ ...prev, location: event.target.value }))}
        />
      </div>
      <button className="btn-primary mt-auto gap-2" type="submit">
        <MagnifyingGlassIcon className="h-5 w-5" />
        Search
      </button>
    </form>
  );
}

export default SearchHero;
