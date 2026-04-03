import Listing from '../models/Listing.js';
import { slugify } from '../utils/slugify.js';
import { calculateBookingPrice } from '../utils/pricing.js';
import { validateListingAvailability } from '../utils/availability.js';
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
    seo: {
      metaTitle: body.metaTitle || '',
      metaDescription: body.metaDescription || '',
    },
  };
};

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
    } = req.query;

    const query = { active: true };

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
      query.$or = [
        { name: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') },
        { location: new RegExp(search, 'i') },
      ];
    }

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

export const createListing = async (req, res, next) => {
  try {
    const listing = await Listing.create(await buildListingPayload(req.body, req.files));
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

    Object.assign(listing, await buildListingPayload(req.body, req.files));
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

export const checkAvailability = async (req, res, next) => {
  try {
    const listing = await Listing.findById(req.params.id);

    if (!listing) {
      res.status(404);
      throw new Error('Listing not found');
    }

    const { startDate, endDate, guests = 1 } = req.body;

    const { available, reason } = await validateListingAvailability({
      listing,
      startDate,
      endDate,
      guests,
    });

    const pricing = await calculateBookingPrice({
      listing,
      bookingType: listing.type,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      guests: Number(guests),
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
