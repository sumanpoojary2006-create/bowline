import Listing from '../models/Listing.js';
import { slugify } from '../utils/slugify.js';
import { calculateBookingPrice } from '../utils/pricing.js';
import { validateListingAvailability, getBookedDateRanges, getNextAvailableWindow, getNextAvailableWindowMulti, getBlockingListingIds } from '../utils/availability.js';
import { persistUploadedFiles } from '../utils/upload.js';

const parseArray = (value) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return String(value)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
};

const normalizeDates = (value) =>
  parseArray(value).map((dateValue) => new Date(dateValue));

const buildListingPayload = async (body, files = []) => {
  const uploadedImages = await persistUploadedFiles(files);
  const existingImages = parseArray(body.existingImages);

  return {
    type: body.type,
    name: body.name,
    slug: body.slug || slugify(body.name),
    location: body.location,
    description: body.description,
    shortDescription: body.shortDescription,
    price: Number(body.price),
    priceUnit: body.priceUnit,
    maxOccupancy: Number(body.maxOccupancy || 1),
    capacity: Number(body.capacity || body.maxOccupancy || 1),
    amenities: parseArray(body.amenities),
    facilities: parseArray(body.facilities),
    difficulty: body.difficulty || '',
    duration: body.duration || '',
    availabilityStatus: body.availabilityStatus,
    availableDates: normalizeDates(body.availableDates),
    images: [...existingImages, ...uploadedImages],
    featured: body.featured === 'true' || body.featured === true,
    active: body.active !== 'false',
    manualPriceOverride: body.manualPriceOverride ? Number(body.manualPriceOverride) : null,
    airbnbIcalUrl: body.airbnbIcalUrl || '',
    seo: {
      metaTitle: body.metaTitle || '',
      metaDescription: body.metaDescription || '',
    },
  };
};

// Dormitory is inactive (not offered as a standalone bookable room) but is
// still overflow space for the Group Booking / Full House bundles — callers
// building those bundles pass includeBundleExtras=true to get it included.
const BUNDLE_ALWAYS_INCLUDE_SLUGS = ['dormitory-open-loft'];

export const getListings = async (req, res, next) => {
  try {
    const {
      type,
      featured,
      search,
      minPrice,
      maxPrice,
      capacity,
      difficulty,
      location,
      limit,
      includeBundleExtras,
    } = req.query;

    const query = {};
    const andClauses = [];

    if (includeBundleExtras === 'true') {
      andClauses.push({ $or: [{ active: true }, { slug: { $in: BUNDLE_ALWAYS_INCLUDE_SLUGS } }] });
    } else {
      query.active = true;
    }

    if (type) query.type = type;
    if (featured === 'true') query.featured = true;
    if (difficulty) query.difficulty = difficulty;
    if (location) query.location = new RegExp(location, 'i');
    if (capacity) query.capacity = { $gte: Number(capacity) };
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }
    if (search) {
      andClauses.push({
        $or: [
          { name: new RegExp(search, 'i') },
          { description: new RegExp(search, 'i') },
          { location: new RegExp(search, 'i') },
        ],
      });
    }

    if (andClauses.length) query.$and = andClauses;

    const listings = await Listing.find(query)
      .sort({ featured: -1, createdAt: -1 })
      .limit(limit ? Number(limit) : 100);

    res.json({ listings });
  } catch (error) {
    next(error);
  }
};

export const getAdminListings = async (req, res, next) => {
  try {
    const listings = await Listing.find().sort({ createdAt: -1 });
    res.json({ listings });
  } catch (error) {
    next(error);
  }
};

export const getListingBySlug = async (req, res, next) => {
  try {
    const listing = await Listing.findOne({ slug: req.params.slug, active: true });

    if (!listing) {
      res.status(404);
      throw new Error('Listing not found');
    }

    const related = await Listing.find({
      _id: { $ne: listing._id },
      type: listing.type,
      active: true,
    }).limit(3);

    res.json({ listing, related });
  } catch (error) {
    next(error);
  }
};

// Two listings pointed at the same Airbnb calendar means every real
// reservation on one room silently blocks the other too — this caused a real
// incident (Cozy 2 was wrongly synced to Pent House's feed). Reject it early.
const findAirbnbUrlConflict = (icalUrl, excludeId = null) => {
  if (!icalUrl) return Promise.resolve(null);

  return Listing.findOne({
    airbnbIcalUrl: icalUrl,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  }).select('name');
};

export const createListing = async (req, res, next) => {
  try {
    const payload = await buildListingPayload(req.body, req.files);

    const conflict = await findAirbnbUrlConflict(payload.airbnbIcalUrl);
    if (conflict) {
      res.status(400);
      throw new Error(`This Airbnb calendar URL is already assigned to "${conflict.name}"`);
    }

    const listing = await Listing.create(payload);
    res.status(201).json({ listing });
  } catch (error) {
    next(error);
  }
};

export const updateListing = async (req, res, next) => {
  try {
    const listing = await Listing.findById(req.params.id);

    if (!listing) {
      res.status(404);
      throw new Error('Listing not found');
    }

    const payload = await buildListingPayload(req.body, req.files);

    const conflict = await findAirbnbUrlConflict(payload.airbnbIcalUrl, listing._id);
    if (conflict) {
      res.status(400);
      throw new Error(`This Airbnb calendar URL is already assigned to "${conflict.name}"`);
    }

    Object.assign(listing, payload);
    await listing.save();

    res.json({ listing });
  } catch (error) {
    next(error);
  }
};

export const deleteListing = async (req, res, next) => {
  try {
    const listing = await Listing.findById(req.params.id);

    if (!listing) {
      res.status(404);
      throw new Error('Listing not found');
    }

    listing.active = false;
    listing.availabilityStatus = 'inactive';
    await listing.save();

    res.json({ message: 'Listing archived successfully' });
  } catch (error) {
    next(error);
  }
};

export const getRoomsWithAvailability = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      res.status(400);
      throw new Error('startDate and endDate are required');
    }

    const rooms = await Listing.find({ type: 'room', active: true }).sort({ featured: -1 });

    const start = new Date(startDate);
    const end = new Date(endDate);

    const results = await Promise.all(
      rooms.map(async (room) => {
        const { available, reason } = await validateListingAvailability({
          listing: room,
          startDate: start,
          endDate: end,
          guests: 1,
        });
        return { ...room.toObject(), isAvailable: available, unavailableReason: available ? null : reason };
      })
    );

    res.json({ rooms: results });
  } catch (error) {
    next(error);
  }
};

export const getBookedDatesForListing = async (req, res, next) => {
  try {
    const listing = await Listing.findById(req.params.id);

    if (!listing) {
      res.status(404);
      throw new Error('Listing not found');
    }

    const months = Math.min(Number(req.query.months) || 3, 12);
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setMonth(to.getMonth() + months);

    const ranges = await getBookedDateRanges(listing._id, from, to);

    res.json({ bookedRanges: ranges });
  } catch (error) {
    next(error);
  }
};

export const getNextAvailableForListing = async (req, res, next) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      res.status(404);
      throw new Error('Listing not found');
    }

    const nights = Math.max(Number(req.query.nights) || 1, 1);
    const from = req.query.from ? new Date(req.query.from) : new Date();

    const result = await getNextAvailableWindow(listing._id, nights, from);
    res.json(result || {});
  } catch (error) {
    next(error);
  }
};

// Group bookings span several listings at once - a date is "booked" for the
// bundle if any one of its rooms has a booking on that date.
export const getBookedDatesForListings = async (req, res, next) => {
  try {
    const ids = String(req.query.ids || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    if (!ids.length) {
      return res.json({ bookedRanges: [] });
    }

    const months = Math.min(Number(req.query.months) || 3, 12);
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setMonth(to.getMonth() + months);

    const rangesPerListing = await Promise.all(ids.map((id) => getBookedDateRanges(id, from, to)));
    res.json({ bookedRanges: rangesPerListing.flat() });
  } catch (error) {
    next(error);
  }
};

export const getNextAvailableForListings = async (req, res, next) => {
  try {
    const ids = String(req.query.ids || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    if (!ids.length) {
      return res.json({});
    }

    const nights = Math.max(Number(req.query.nights) || 1, 1);
    const from = req.query.from ? new Date(req.query.from) : new Date();
    const to = new Date(from);
    to.setDate(to.getDate() + nights);

    const [result, blockingIds] = await Promise.all([
      getNextAvailableWindowMulti(ids, nights, from),
      getBlockingListingIds(ids, from, to),
    ]);

    let blockingRooms = [];
    if (blockingIds.length) {
      const blockingListings = await Listing.find({ _id: { $in: blockingIds } }).select('name');
      blockingRooms = blockingListings.map((listing) => listing.name);
    }

    res.json({ ...(result || {}), blockingRooms });
  } catch (error) {
    next(error);
  }
};

export const checkAvailability = async (req, res, next) => {
  try {
    const listing = await Listing.findById(req.params.id);

    if (!listing) {
      res.status(404);
      throw new Error('Listing not found');
    }

    const { startDate, endDate, guests = 1, adultGuests, childGuests = 0, pets = 0 } = req.body;
    const normalizedAdults = Number(adultGuests ?? guests);
    const normalizedChildren = Number(childGuests || 0);
    const normalizedGuests = Number(guests ?? normalizedAdults + normalizedChildren);

    const { available, reason } = await validateListingAvailability({
      listing,
      startDate,
      endDate,
      guests: normalizedGuests,
    });

    const pricing = await calculateBookingPrice({
      listing,
      bookingType: listing.type,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      guests: normalizedGuests,
      adultGuests: normalizedAdults,
      childGuests: normalizedChildren,
      pets: Number(pets || 0),
    });

    res.json({
      available,
      reason,
      pricing,
    });
  } catch (error) {
    next(error);
  }
};
