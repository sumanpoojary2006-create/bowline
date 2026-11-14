import roomImage from '../assets/marketing/room.jpg';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import api from '../lib/api';
import SectionHeader from '../components/SectionHeader';
import PageLoader from '../components/PageLoader';

const PRICE_UNIT_LABELS = { night: 'per night', person: 'per person', package: 'package price' };
const AVAILABILITY_LABELS = { available: 'Available', limited: 'Limited availability', 'sold-out': 'Sold out', inactive: 'Inactive' };

const emptyForm = {
  type: 'room',
  name: '',
  slug: '',
  location: '',
  description: '',
  shortDescription: '',
  price: '',
  priceUnit: 'night',
  weekendPrice: '',
  maxOccupancy: 1,
  capacity: 1,
  amenities: '',
  facilities: '',
  difficulty: '',
  duration: '',
  availabilityStatus: 'available',
  availableDates: '',
  existingImages: [],
  featured: false,
  active: true,
  manualPriceOverride: '',
  airbnbIcalUrl: '',
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
  weekendPrice: listing.weekendPrice || '',
  maxOccupancy: listing.maxOccupancy,
  capacity: listing.capacity,
  amenities: listing.amenities?.join(', '),
  facilities: listing.facilities?.join(', '),
  difficulty: listing.difficulty,
  duration: listing.duration,
  availabilityStatus: listing.availabilityStatus,
  availableDates: listing.availableDates?.map((date) => date.slice(0, 10)).join(', '),
  existingImages: listing.images || [],
  featured: listing.featured,
  active: listing.active,
  manualPriceOverride: listing.manualPriceOverride || '',
  airbnbIcalUrl: listing.airbnbIcalUrl || '',
  metaTitle: listing.seo?.metaTitle || '',
  metaDescription: listing.seo?.metaDescription || '',
});

function AdminListingsPage() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [activeSection, setActiveSection] = useState(null);
  const [search, setSearch] = useState('');
  const [activeType, setActiveType] = useState('room');
  const [form, setForm] = useState(emptyForm);
  const [files, setFiles] = useState([]);
  const [imageUrlDraft, setImageUrlDraft] = useState('');

  const selectedListing = useMemo(
    () => listings.find((listing) => listing._id === selectedId) || null,
    [listings, selectedId]
  );

  const filteredListings = useMemo(
    () => listings.filter((listing) => listing.type === activeType && listing.name.toLowerCase().includes(search.toLowerCase())),
    [listings, activeType, search]
  );

  const exportFeedUrl = useMemo(() => {
    if (!selectedId) return '';
    const base = api.defaults.baseURL.startsWith('http')
      ? api.defaults.baseURL
      : `${window.location.origin}${api.defaults.baseURL}`;
    return `${base}/sync/calendar/${selectedId}.ics`;
  }, [selectedId]);

  const syncAirbnbNow = async (listingId) => {
    try {
      const { data } = await api.post('/sync/airbnb', { listingId });
      const result = data.results?.[0];
      if (!result) {
        toast.error('No sync result returned');
        return;
      }
      if (result.errors?.length) {
        toast.error(result.errors[0]);
        return;
      }
      toast.success(`Synced: ${result.created} new, ${result.updated} updated, ${result.cancelled} cancelled`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to sync Airbnb calendar');
    }
  };

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
      setImageUrlDraft('');
      return;
    }

    setActiveType(selectedListing.type);
    setForm(parseListingToForm(selectedListing));
    setImageUrlDraft('');
  }, [selectedListing, activeType]);

  const resetForm = (type = activeType) => {
    setSelectedId(null);
    setFiles([]);
    setImageUrlDraft('');
    setActiveSection(null);
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

  const addImageUrl = () => {
    const value = imageUrlDraft.trim();
    if (!value) return;

    setForm((prev) => ({
      ...prev,
      existingImages: prev.existingImages.includes(value)
        ? prev.existingImages
        : [...prev.existingImages, value],
    }));
    setImageUrlDraft('');
  };

  const removeExistingImage = (targetImage) => {
    setForm((prev) => ({
      ...prev,
      existingImages: prev.existingImages.filter((image) => image !== targetImage),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (key === 'existingImages') {
          payload.append(key, JSON.stringify(value));
          return;
        }
        payload.append(key, value);
      });
      files.forEach((file) => payload.append('images', file));

      if (selectedId) {
        const { data } = await api.put(`/listings/${selectedId}`, payload);
        toast.success(`${typeConfig[form.type].singular} updated`);
        setForm(parseListingToForm(data.listing));
        setFiles([]);
      } else {
        await api.post('/listings', payload);
        toast.success(`${typeConfig[form.type].singular} created`);
        resetForm(activeType);
      }

      setEditorOpen(false);
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

  const editorSections = [
    {
      key: 'photos',
      title: 'Photo tour',
      subtitle: `${form.existingImages.length} photo${form.existingImages.length === 1 ? '' : 's'}${
        files.length ? ` · ${files.length} new pending` : ''
      }`,
    },
    {
      key: 'title',
      title: 'Title & location',
      subtitle: form.name ? `${form.name}${form.location ? ` · ${form.location}` : ''}` : 'Add a title',
    },
    {
      key: 'description',
      title: 'Description',
      subtitle: form.shortDescription
        ? form.shortDescription.slice(0, 60) + (form.shortDescription.length > 60 ? '…' : '')
        : 'Add a description',
    },
    {
      key: 'pricing',
      title: 'Pricing',
      subtitle: form.price
        ? `₹${Number(form.manualPriceOverride || form.price).toLocaleString('en-IN')} ${PRICE_UNIT_LABELS[form.priceUnit] || ''}${
            form.weekendPrice ? ` · ₹${Number(form.weekendPrice).toLocaleString('en-IN')} weekend` : ''
          }`
        : 'Set a price',
    },
    {
      key: 'availability',
      title: 'Availability & status',
      subtitle: AVAILABILITY_LABELS[form.availabilityStatus] || form.availabilityStatus,
    },
    activeType === 'room' && {
      key: 'details',
      title: 'Guests & amenities',
      subtitle: `${form.maxOccupancy || 0} guests · ${form.amenities ? form.amenities.split(',').filter(Boolean).length : 0} amenities`,
    },
    activeType === 'trek' && {
      key: 'details',
      title: 'Trek details',
      subtitle: [form.difficulty, form.duration].filter(Boolean).join(' · ') || 'Add details',
    },
    activeType === 'camp' && {
      key: 'details',
      title: 'Camp details',
      subtitle: form.duration || 'Add details',
    },
    { key: 'seo', title: 'SEO', subtitle: form.metaTitle || 'Not set' },
    {
      key: 'visibility',
      title: 'Visibility',
      subtitle: `${form.featured ? 'Featured · ' : ''}${form.active ? 'Active' : 'Inactive'}`,
    },
    selectedId &&
      activeType === 'room' && {
        key: 'airbnb',
        title: 'Airbnb sync',
        subtitle: 'Export feed & manual sync',
      },
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Inventory Management"
        title="Your listings"
        description="Beautiful stays. Memorable experiences. All in one place."
        action={<button className="btn-primary" onClick={() => { resetForm(activeType); setActiveSection(null); setEditorOpen(true); }}>+ Create listing</button>}
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

      <input className="input" aria-label="Search listings" placeholder="Search your listings" value={search} onChange={e => setSearch(e.target.value)} />
      <div className="host-listing-grid">
        {filteredListings.map(listing => <button key={listing._id} className="host-listing-card" onClick={() => { setSelectedId(listing._id); setActiveSection(null); setEditorOpen(true); setTimeout(() => document.getElementById('listing-editor')?.scrollIntoView({ behavior: 'smooth' }), 0); }}>
          <div className="host-listing-photo"><img src={listing.images?.[0] || roomImage} alt={listing.name} /><span className={`host-listing-status ${listing.active ? '' : 'off'}`}><i />{listing.active ? 'Listed' : 'Unlisted'}</span></div>
          <h3>{listing.name}</h3><p>{listing.location}</p><div className="host-listing-meta"><span>₹{Number(listing.manualPriceOverride || listing.price).toLocaleString('en-IN')} / {listing.priceUnit || 'night'}</span><span>Edit listing ↗</span></div>
        </button>)}
      </div>
      {!filteredListings.length && <div className="host-empty">No listings match. Try another search or create a listing.</div>}
      {editorOpen && <div id="listing-editor" className="host-editor">
        <form onSubmit={handleSubmit}>
          <div className="host-editor-top">
            <button
              type="button"
              className="host-icon-button"
              aria-label={activeSection ? 'Back to listing editor' : 'Close editor'}
              onClick={() => (activeSection ? setActiveSection(null) : setEditorOpen(false))}
            >
              <ArrowLeftIcon />
            </button>
            <div>
              <p className="host-eyebrow">{config.label.toUpperCase()}</p>
              <h2>
                {activeSection
                  ? editorSections.find((section) => section.key === activeSection)?.title
                  : form.name || (selectedId ? `Edit ${config.singular}` : `Create ${config.singular}`)}
              </h2>
            </div>
          </div>

          {!activeSection ? (
            <div className="host-editor-list">
              {editorSections.map((section) => (
                <button key={section.key} type="button" className="host-editor-row" onClick={() => setActiveSection(section.key)}>
                  <div className="host-editor-row-text">
                    <p>{section.title}</p>
                    <p>{section.subtitle}</p>
                  </div>
                  <ChevronRightIcon />
                </button>
              ))}

              <div className="host-editor-actions">
                <button className="btn-primary" type="submit">
                  {selectedId ? 'Save changes' : `Create ${config.singular}`}
                </button>
                {selectedId && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      if (window.confirm('Archive this listing? It will no longer be available to book.')) {
                        archiveListing(selectedId);
                        setEditorOpen(false);
                      }
                    }}
                  >
                    Archive listing
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="host-editor-panel">
              {activeSection === 'photos' && (
                <div className="host-editor-fields">
                  {form.existingImages.length ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {form.existingImages.map((image) => (
                        <div key={image} className="rounded-2xl border border-[#e5e5e5] p-2">
                          <img src={image} alt="Listing preview" className="h-24 w-full rounded-xl object-cover" />
                          <button type="button" className="btn-secondary mt-2 w-full" onClick={() => removeExistingImage(image)}>
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="host-editor-hint">No images added yet.</p>
                  )}
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                      className="input flex-1"
                      placeholder="Paste image URL and click Add"
                      value={imageUrlDraft}
                      onChange={(event) => setImageUrlDraft(event.target.value)}
                    />
                    <button type="button" className="btn-secondary" onClick={addImageUrl}>
                      Add URL
                    </button>
                  </div>
                  <div>
                    <label className="label">Upload images</label>
                    <input className="input" type="file" multiple onChange={(event) => setFiles(Array.from(event.target.files || []))} />
                  </div>
                </div>
              )}

              {activeSection === 'title' && (
                <div className="host-editor-fields">
                  <input className="input" placeholder={`${config.singular} name`} value={form.name} onChange={(event) => setField('name', event.target.value)} />
                  <input className="input" placeholder="Location" value={form.location} onChange={(event) => setField('location', event.target.value)} />
                  <input className="input" placeholder="Slug" value={form.slug} onChange={(event) => setField('slug', event.target.value)} />
                  <p className="host-editor-hint">Used in the listing's public URL.</p>
                </div>
              )}

              {activeSection === 'description' && (
                <div className="host-editor-fields">
                  <div>
                    <label className="label">Short description</label>
                    <textarea className="input min-h-24 mt-2" value={form.shortDescription} onChange={(event) => setField('shortDescription', event.target.value)} />
                  </div>
                  <div>
                    <label className="label">Full description</label>
                    <textarea className="input min-h-32 mt-2" value={form.description} onChange={(event) => setField('description', event.target.value)} />
                  </div>
                </div>
              )}

              {activeSection === 'pricing' && (
                <div className="host-editor-fields">
                  <div className="host-editor-card">
                    <label className="label">Base price</label>
                    <input className="input mt-2" placeholder="Base price" type="number" value={form.price} onChange={(event) => setField('price', event.target.value)} />
                  </div>

                  {activeType === 'room' && (
                    <div className="host-editor-card">
                      <div className="host-editor-card-top">
                        <label className="label">Custom weekend price</label>
                        {form.weekendPrice ? (
                          <button type="button" className="host-editor-link" onClick={() => setField('weekendPrice', '')}>
                            Remove
                          </button>
                        ) : null}
                      </div>
                      {form.weekendPrice ? (
                        <input
                          className="input mt-2"
                          placeholder="Weekend price"
                          type="number"
                          value={form.weekendPrice}
                          onChange={(event) => setField('weekendPrice', event.target.value)}
                        />
                      ) : (
                        <button
                          type="button"
                          className="btn-secondary mt-2"
                          onClick={() => setField('weekendPrice', form.price || '')}
                        >
                          + Add a custom weekend price
                        </button>
                      )}
                      <p className="host-editor-hint mt-2">Applies to Saturday and Sunday nights.</p>
                    </div>
                  )}

                  <select className="input" value={form.priceUnit} onChange={(event) => setField('priceUnit', event.target.value)}>
                    <option value="night">Per night</option>
                    <option value="person">Per person</option>
                    <option value="package">Package</option>
                  </select>
                  <input
                    className="input"
                    placeholder="Manual price override"
                    type="number"
                    value={form.manualPriceOverride}
                    onChange={(event) => setField('manualPriceOverride', event.target.value)}
                  />
                  <p className="host-editor-hint">Overrides the calculated price (including the weekend price) on the public site when set.</p>
                </div>
              )}

              {activeSection === 'availability' && (
                <div className="host-editor-fields">
                  <select className="input" value={form.availabilityStatus} onChange={(event) => setField('availabilityStatus', event.target.value)}>
                    <option value="available">Available</option>
                    <option value="limited">Limited</option>
                    <option value="sold-out">Sold Out</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  <input
                    className="input"
                    placeholder="Available dates (YYYY-MM-DD, comma separated)"
                    value={form.availableDates}
                    onChange={(event) => setField('availableDates', event.target.value)}
                  />
                </div>
              )}

              {activeSection === 'details' && activeType === 'room' && (
                <div className="host-editor-fields">
                  <div className="host-editor-fields two-col">
                    <input className="input" placeholder="Max occupancy" type="number" value={form.maxOccupancy} onChange={(event) => setField('maxOccupancy', event.target.value)} />
                    <input className="input" placeholder="Rooms available / capacity" type="number" value={form.capacity} onChange={(event) => setField('capacity', event.target.value)} />
                  </div>
                  <input className="input" placeholder="Amenities (comma separated)" value={form.amenities} onChange={(event) => setField('amenities', event.target.value)} />
                  <input className="input" placeholder="Import availability from Airbnb (iCal URL)" value={form.airbnbIcalUrl} onChange={(event) => setField('airbnbIcalUrl', event.target.value)} />
                </div>
              )}

              {activeSection === 'details' && activeType === 'trek' && (
                <div className="host-editor-fields">
                  <div className="host-editor-fields two-col">
                    <input className="input" placeholder="Difficulty" value={form.difficulty} onChange={(event) => setField('difficulty', event.target.value)} />
                    <input className="input" placeholder="Duration" value={form.duration} onChange={(event) => setField('duration', event.target.value)} />
                  </div>
                  <input className="input" placeholder="Group capacity" type="number" value={form.capacity} onChange={(event) => setField('capacity', event.target.value)} />
                  <input className="input" placeholder="Facilities or inclusions (comma separated)" value={form.facilities} onChange={(event) => setField('facilities', event.target.value)} />
                </div>
              )}

              {activeSection === 'details' && activeType === 'camp' && (
                <div className="host-editor-fields">
                  <div className="host-editor-fields two-col">
                    <input className="input" placeholder="Camp duration" value={form.duration} onChange={(event) => setField('duration', event.target.value)} />
                    <input className="input" placeholder="Camp capacity" type="number" value={form.capacity} onChange={(event) => setField('capacity', event.target.value)} />
                  </div>
                  <input className="input" placeholder="Facilities (comma separated)" value={form.facilities} onChange={(event) => setField('facilities', event.target.value)} />
                </div>
              )}

              {activeSection === 'seo' && (
                <div className="host-editor-fields">
                  <input className="input" placeholder="SEO meta title" value={form.metaTitle} onChange={(event) => setField('metaTitle', event.target.value)} />
                  <textarea className="input min-h-24" placeholder="SEO meta description" value={form.metaDescription} onChange={(event) => setField('metaDescription', event.target.value)} />
                </div>
              )}

              {activeSection === 'visibility' && (
                <div className="host-editor-fields">
                  <label className="flex items-center gap-3 text-sm">
                    <input type="checkbox" checked={form.featured} onChange={(event) => setField('featured', event.target.checked)} />
                    Featured on the homepage
                  </label>
                  <label className="flex items-center gap-3 text-sm">
                    <input type="checkbox" checked={form.active} onChange={(event) => setField('active', event.target.checked)} />
                    Active &amp; bookable
                  </label>
                </div>
              )}

              {activeSection === 'airbnb' && (
                <div className="host-editor-fields">
                  <div>
                    <label className="label">Export feed (paste into Airbnb &rarr; Import calendar)</label>
                    <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                      <input className="input flex-1" readOnly value={exportFeedUrl} onClick={(event) => event.target.select()} />
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                          navigator.clipboard.writeText(exportFeedUrl);
                          toast.success('Feed URL copied');
                        }}
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                  <button type="button" className="btn-secondary" onClick={() => syncAirbnbNow(selectedId)}>
                    Sync Airbnb now
                  </button>
                </div>
              )}

              <div className="host-editor-actions">
                <button type="button" className="btn-primary" onClick={() => setActiveSection(null)}>
                  Done
                </button>
              </div>
            </div>
          )}
        </form>
      </div>}
    </div>
  );
}

export default AdminListingsPage;
