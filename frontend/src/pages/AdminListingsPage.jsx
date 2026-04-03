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

function AdminListingsPage() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [files, setFiles] = useState([]);

  const selectedListing = useMemo(
    () => listings.find((listing) => listing._id === selectedId) || null,
    [listings, selectedId]
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
      setForm(emptyForm);
      return;
    }

    setForm({
      type: selectedListing.type,
      name: selectedListing.name,
      slug: selectedListing.slug,
      location: selectedListing.location,
      description: selectedListing.description,
      shortDescription: selectedListing.shortDescription,
      price: selectedListing.price,
      priceUnit: selectedListing.priceUnit,
      maxOccupancy: selectedListing.maxOccupancy,
      capacity: selectedListing.capacity,
      amenities: selectedListing.amenities?.join(', '),
      facilities: selectedListing.facilities?.join(', '),
      difficulty: selectedListing.difficulty,
      duration: selectedListing.duration,
      availabilityStatus: selectedListing.availabilityStatus,
      availableDates: selectedListing.availableDates?.map((date) => date.slice(0, 10)).join(', '),
      existingImages: selectedListing.images?.join(', '),
      featured: selectedListing.featured,
      active: selectedListing.active,
      manualPriceOverride: selectedListing.manualPriceOverride || '',
      metaTitle: selectedListing.seo?.metaTitle || '',
      metaDescription: selectedListing.seo?.metaDescription || '',
    });
  }, [selectedListing]);

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
        toast.success('Listing updated');
      } else {
        await api.post('/listings', payload);
        toast.success('Listing created');
      }

      setSelectedId(null);
      setFiles([]);
      setForm(emptyForm);
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
        setSelectedId(null);
        setForm(emptyForm);
      }
      fetchListings();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to archive listing');
    }
  };

  if (loading) {
    return <PageLoader label="Loading listing inventory..." />;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Inventory Management"
        title="Rooms, treks, and camps in one editor"
        description="Create and update listings with pricing, imagery, facilities, SEO metadata, and date availability."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        <div className="glass rounded-[2rem] p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-white">Active listings</h2>
            <button className="btn-secondary" onClick={() => setSelectedId(null)}>
              New Listing
            </button>
          </div>
          <div className="space-y-4">
            {listings.map((listing) => (
              <div key={listing._id} className="rounded-[1.5rem] bg-slate-900/70 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{listing.type}</p>
                    <h3 className="mt-2 text-lg font-semibold text-white">{listing.name}</h3>
                    <p className="mt-1 text-sm text-slate-400">{listing.location}</p>
                  </div>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                    {listing.availabilityStatus}
                  </span>
                </div>
                <div className="mt-4 flex gap-3">
                  <button className="btn-secondary" onClick={() => setSelectedId(listing._id)}>
                    Edit
                  </button>
                  <button className="rounded-full border border-rose-400/30 px-4 py-3 text-sm font-semibold text-rose-300" onClick={() => archiveListing(listing._id)}>
                    Archive
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <form className="glass rounded-[2rem] p-6" onSubmit={handleSubmit}>
          <h2 className="text-2xl font-semibold text-white">{selectedId ? 'Edit listing' : 'Create listing'}</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <select className="input" value={form.type} onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}>
              <option value="room">Room</option>
              <option value="trek">Trek</option>
              <option value="camp">Camp</option>
            </select>
            <input className="input" placeholder="Name" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
            <input className="input" placeholder="Slug" value={form.slug} onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))} />
            <input className="input" placeholder="Location" value={form.location} onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))} />
            <input className="input" placeholder="Price" type="number" value={form.price} onChange={(event) => setForm((prev) => ({ ...prev, price: event.target.value }))} />
            <select className="input" value={form.priceUnit} onChange={(event) => setForm((prev) => ({ ...prev, priceUnit: event.target.value }))}>
              <option value="night">Per night</option>
              <option value="person">Per person</option>
              <option value="package">Package</option>
            </select>
            <input className="input" placeholder="Max occupancy" type="number" value={form.maxOccupancy} onChange={(event) => setForm((prev) => ({ ...prev, maxOccupancy: event.target.value }))} />
            <input className="input" placeholder="Capacity" type="number" value={form.capacity} onChange={(event) => setForm((prev) => ({ ...prev, capacity: event.target.value }))} />
            <input className="input" placeholder="Difficulty" value={form.difficulty} onChange={(event) => setForm((prev) => ({ ...prev, difficulty: event.target.value }))} />
            <input className="input" placeholder="Duration" value={form.duration} onChange={(event) => setForm((prev) => ({ ...prev, duration: event.target.value }))} />
            <input className="input" placeholder="Amenities (comma separated)" value={form.amenities} onChange={(event) => setForm((prev) => ({ ...prev, amenities: event.target.value }))} />
            <input className="input" placeholder="Facilities (comma separated)" value={form.facilities} onChange={(event) => setForm((prev) => ({ ...prev, facilities: event.target.value }))} />
            <input className="input" placeholder="Available dates (YYYY-MM-DD, comma separated)" value={form.availableDates} onChange={(event) => setForm((prev) => ({ ...prev, availableDates: event.target.value }))} />
            <select className="input" value={form.availabilityStatus} onChange={(event) => setForm((prev) => ({ ...prev, availabilityStatus: event.target.value }))}>
              <option value="available">Available</option>
              <option value="limited">Limited</option>
              <option value="sold-out">Sold Out</option>
              <option value="inactive">Inactive</option>
            </select>
            <input className="input" placeholder="Manual price override" type="number" value={form.manualPriceOverride} onChange={(event) => setForm((prev) => ({ ...prev, manualPriceOverride: event.target.value }))} />
            <input className="input" placeholder="SEO meta title" value={form.metaTitle} onChange={(event) => setForm((prev) => ({ ...prev, metaTitle: event.target.value }))} />
            <div className="md:col-span-2">
              <textarea className="input min-h-28" placeholder="Short description" value={form.shortDescription} onChange={(event) => setForm((prev) => ({ ...prev, shortDescription: event.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <textarea className="input min-h-32" placeholder="Full description" value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <textarea className="input min-h-24" placeholder="Existing image URLs (comma separated)" value={form.existingImages} onChange={(event) => setForm((prev) => ({ ...prev, existingImages: event.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <label className="label">Upload images</label>
              <input className="input" type="file" multiple onChange={(event) => setFiles(Array.from(event.target.files || []))} />
            </div>
            <div className="md:col-span-2">
              <textarea className="input min-h-24" placeholder="SEO meta description" value={form.metaDescription} onChange={(event) => setForm((prev) => ({ ...prev, metaDescription: event.target.value }))} />
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-4">
            <label className="flex items-center gap-3 text-sm text-slate-300">
              <input type="checkbox" checked={form.featured} onChange={(event) => setForm((prev) => ({ ...prev, featured: event.target.checked }))} />
              Featured
            </label>
            <label className="flex items-center gap-3 text-sm text-slate-300">
              <input type="checkbox" checked={form.active} onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.checked }))} />
              Active
            </label>
          </div>
          <button className="btn-primary mt-6" type="submit">
            {selectedId ? 'Update Listing' : 'Create Listing'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AdminListingsPage;
