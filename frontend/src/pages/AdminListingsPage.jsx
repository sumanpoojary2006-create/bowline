import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import SectionHeader from '../components/SectionHeader';
import PageLoader from '../components/PageLoader';

const emptyForm = {
  type: 'room',
  name: '',
  slug: '',
  location: '',
  description: '',
  shortDescription: '',
  price: '',
  priceUnit: 'night',
  maxOccupancy: 1,
  capacity: 1,
  amenities: '',
  facilities: '',
  difficulty: '',
  duration: '',
  availabilityStatus: 'available',
  availableDates: '',
  existingImages: '',
  featured: false,
  active: true,
  manualPriceOverride: '',
  metaTitle: '',
  metaDescription: '',
};

const typeConfig = {
  room: {
    label: 'Rooms',
    singular: 'Room',
    description: 'Keep the stay inventory clean and easy to manage. This is the default admin workflow now.',
  },
  trek: {
    label: 'Treks',
    singular: 'Trek',
    description: 'Treks live in their own lane so they support the stay business without crowding it.',
  },
  camp: {
    label: 'Camps',
    singular: 'Camp',
    description: 'Camp creation stays separate and intentional, ready for seasonal use whenever needed.',
  },
};

const parseListingToForm = (listing) => ({
  type: listing.type,
  name: listing.name,
  slug: listing.slug,
  location: listing.location,
  description: listing.description,
  shortDescription: listing.shortDescription,
  price: listing.price,
  priceUnit: listing.priceUnit,
  maxOccupancy: listing.maxOccupancy,
  capacity: listing.capacity,
  amenities: listing.amenities?.join(', '),
  facilities: listing.facilities?.join(', '),
  difficulty: listing.difficulty,
  duration: listing.duration,
  availabilityStatus: listing.availabilityStatus,
  availableDates: listing.availableDates?.map((date) => date.slice(0, 10)).join(', '),
  existingImages: listing.images?.join(', '),
  featured: listing.featured,
  active: listing.active,
  manualPriceOverride: listing.manualPriceOverride || '',
  metaTitle: listing.seo?.metaTitle || '',
  metaDescription: listing.seo?.metaDescription || '',
});

function AdminListingsPage() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [activeType, setActiveType] = useState('room');
  const [form, setForm] = useState(emptyForm);
  const [files, setFiles] = useState([]);

  const selectedListing = useMemo(
    () => listings.find((listing) => listing._id === selectedId) || null,
    [listings, selectedId]
  );

  const filteredListings = useMemo(
    () => listings.filter((listing) => listing.type === activeType),
    [listings, activeType]
  );

  const fetchListings = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/listings/admin/all');
      setListings(data.listings);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Bowline Admin | Listings';
    fetchListings();
  }, []);

  useEffect(() => {
    if (!selectedListing) {
      setForm((prev) => ({ ...emptyForm, type: prev.type || activeType }));
      return;
    }

    setActiveType(selectedListing.type);
    setForm(parseListingToForm(selectedListing));
  }, [selectedListing, activeType]);

  const resetForm = (type = activeType) => {
    setSelectedId(null);
    setFiles([]);
    setForm({ ...emptyForm, type });
  };

  const switchType = (type) => {
    setActiveType(type);
    if (selectedListing?.type === type) return;
    resetForm(type);
  };

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        payload.append(key, value);
      });
      files.forEach((file) => payload.append('images', file));

      if (selectedId) {
        await api.put(`/listings/${selectedId}`, payload);
        toast.success(`${typeConfig[form.type].singular} updated`);
      } else {
        await api.post('/listings', payload);
        toast.success(`${typeConfig[form.type].singular} created`);
      }

      resetForm(activeType);
      fetchListings();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to save listing');
    }
  };

  const archiveListing = async (id) => {
    try {
      await api.delete(`/listings/${id}`);
      toast.success('Listing archived');
      if (selectedId === id) {
        resetForm(activeType);
      }
      fetchListings();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to archive listing');
    }
  };

  if (loading) {
    return <PageLoader label="Loading listing inventory..." />;
  }

  const config = typeConfig[activeType];

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Inventory Management"
        title="Rooms first, treks and camps in their own lanes"
        description="The admin listing flow is now split by inventory type so room creation stays front and center while camp and trek setup remain available when needed."
      />

      <div className="flex flex-wrap gap-3">
        {Object.entries(typeConfig).map(([type, item]) => (
          <button
            key={type}
            className={`rounded-full px-5 py-3 text-sm font-semibold transition ${
              activeType === type ? 'bg-lime-200 text-slate-950' : 'border border-lime-100/15 bg-white/5 text-[#c3cebf]'
            }`}
            onClick={() => switchType(type)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="glass rounded-[2rem] p-6">
          <div className="rounded-[1.75rem] border border-lime-100/10 bg-[#0d1710]/80 p-5">
            <p className="text-xs uppercase tracking-[0.28em] text-lime-200/80">{config.label}</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">{config.singular} inventory</h2>
            <p className="mt-3 text-sm leading-7 text-[#c1cbbd]">{config.description}</p>
          </div>

          <div className="mb-5 mt-6 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-white">Active {config.label.toLowerCase()}</h3>
            <button className="btn-secondary" onClick={() => resetForm(activeType)} type="button">
              New {config.singular}
            </button>
          </div>

          <div className="space-y-4">
            {filteredListings.length ? (
              filteredListings.map((listing) => (
                <div key={listing._id} className="rounded-[1.5rem] bg-[#0f1912]/90 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-lime-100/45">{config.singular}</p>
                      <h3 className="mt-2 text-lg font-semibold text-white">{listing.name}</h3>
                      <p className="mt-1 text-sm text-[#b7c2b2]">{listing.location}</p>
                    </div>
                    <span className="rounded-full border border-lime-100/10 px-3 py-1 text-xs text-[#c3cebf]">
                      {listing.availabilityStatus}
                    </span>
                  </div>
                  <div className="mt-4 flex gap-3">
                    <button className="btn-secondary" onClick={() => setSelectedId(listing._id)} type="button">
                      Edit
                    </button>
                    <button
                      className="rounded-full border border-rose-400/30 px-4 py-3 text-sm font-semibold text-rose-300"
                      onClick={() => archiveListing(listing._id)}
                      type="button"
                    >
                      Archive
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-lime-100/10 bg-[#0d1710]/70 p-5 text-sm text-[#c1cbbd]">
                No {config.label.toLowerCase()} created yet.
              </div>
            )}
          </div>
        </div>

        <form className="glass rounded-[2rem] p-6" onSubmit={handleSubmit}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-lime-200/80">{config.label}</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                {selectedId ? `Edit ${config.singular}` : `Create ${config.singular}`}
              </h2>
            </div>
            <button className="btn-secondary" onClick={() => resetForm(activeType)} type="button">
              Clear form
            </button>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <input className="input" placeholder={`${config.singular} name`} value={form.name} onChange={(event) => setField('name', event.target.value)} />
            <input className="input" placeholder="Slug" value={form.slug} onChange={(event) => setField('slug', event.target.value)} />
            <input className="input" placeholder="Location" value={form.location} onChange={(event) => setField('location', event.target.value)} />
            <input className="input" placeholder="Price" type="number" value={form.price} onChange={(event) => setField('price', event.target.value)} />

            <select className="input" value={form.priceUnit} onChange={(event) => setField('priceUnit', event.target.value)}>
              <option value="night">Per night</option>
              <option value="person">Per person</option>
              <option value="package">Package</option>
            </select>

            <select className="input" value={form.availabilityStatus} onChange={(event) => setField('availabilityStatus', event.target.value)}>
              <option value="available">Available</option>
              <option value="limited">Limited</option>
              <option value="sold-out">Sold Out</option>
              <option value="inactive">Inactive</option>
            </select>

            {activeType === 'room' ? (
              <>
                <input
                  className="input"
                  placeholder="Max occupancy"
                  type="number"
                  value={form.maxOccupancy}
                  onChange={(event) => setField('maxOccupancy', event.target.value)}
                />
                <input
                  className="input"
                  placeholder="Rooms available / capacity"
                  type="number"
                  value={form.capacity}
                  onChange={(event) => setField('capacity', event.target.value)}
                />
                <input
                  className="input md:col-span-2"
                  placeholder="Amenities (comma separated)"
                  value={form.amenities}
                  onChange={(event) => setField('amenities', event.target.value)}
                />
              </>
            ) : null}

            {activeType === 'trek' ? (
              <>
                <input className="input" placeholder="Difficulty" value={form.difficulty} onChange={(event) => setField('difficulty', event.target.value)} />
                <input className="input" placeholder="Duration" value={form.duration} onChange={(event) => setField('duration', event.target.value)} />
                <input
                  className="input"
                  placeholder="Group capacity"
                  type="number"
                  value={form.capacity}
                  onChange={(event) => setField('capacity', event.target.value)}
                />
                <input
                  className="input md:col-span-2"
                  placeholder="Facilities or inclusions (comma separated)"
                  value={form.facilities}
                  onChange={(event) => setField('facilities', event.target.value)}
                />
              </>
            ) : null}

            {activeType === 'camp' ? (
              <>
                <input className="input" placeholder="Camp duration" value={form.duration} onChange={(event) => setField('duration', event.target.value)} />
                <input
                  className="input"
                  placeholder="Camp capacity"
                  type="number"
                  value={form.capacity}
                  onChange={(event) => setField('capacity', event.target.value)}
                />
                <input
                  className="input md:col-span-2"
                  placeholder="Facilities (comma separated)"
                  value={form.facilities}
                  onChange={(event) => setField('facilities', event.target.value)}
                />
              </>
            ) : null}

            <input
              className="input md:col-span-2"
              placeholder="Available dates (YYYY-MM-DD, comma separated)"
              value={form.availableDates}
              onChange={(event) => setField('availableDates', event.target.value)}
            />
            <input
              className="input"
              placeholder="Manual price override"
              type="number"
              value={form.manualPriceOverride}
              onChange={(event) => setField('manualPriceOverride', event.target.value)}
            />
            <input className="input" placeholder="SEO meta title" value={form.metaTitle} onChange={(event) => setField('metaTitle', event.target.value)} />

            <div className="md:col-span-2">
              <textarea
                className="input min-h-28"
                placeholder="Short description"
                value={form.shortDescription}
                onChange={(event) => setField('shortDescription', event.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <textarea
                className="input min-h-32"
                placeholder="Full description"
                value={form.description}
                onChange={(event) => setField('description', event.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <textarea
                className="input min-h-24"
                placeholder="Existing image URLs (comma separated)"
                value={form.existingImages}
                onChange={(event) => setField('existingImages', event.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Upload images</label>
              <input className="input" type="file" multiple onChange={(event) => setFiles(Array.from(event.target.files || []))} />
            </div>
            <div className="md:col-span-2">
              <textarea
                className="input min-h-24"
                placeholder="SEO meta description"
                value={form.metaDescription}
                onChange={(event) => setField('metaDescription', event.target.value)}
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-4">
            <label className="flex items-center gap-3 text-sm text-[#c3cebf]">
              <input type="checkbox" checked={form.featured} onChange={(event) => setField('featured', event.target.checked)} />
              Featured
            </label>
            <label className="flex items-center gap-3 text-sm text-[#c3cebf]">
              <input type="checkbox" checked={form.active} onChange={(event) => setField('active', event.target.checked)} />
              Active
            </label>
          </div>

          <button className="btn-primary mt-6" type="submit">
            {selectedId ? `Update ${config.singular}` : `Create ${config.singular}`}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AdminListingsPage;
