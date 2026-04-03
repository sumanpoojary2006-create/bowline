import mongoose from 'mongoose';

const listingSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['room', 'trek', 'camp'],
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    location: {
      type: String,
      default: '',
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    shortDescription: {
      type: String,
      default: '',
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    priceUnit: {
      type: String,
      enum: ['night', 'person', 'package'],
      default: 'package',
    },
    maxOccupancy: {
      type: Number,
      default: 1,
    },
    capacity: {
      type: Number,
      default: 10,
    },
    amenities: {
      type: [String],
      default: [],
    },
    facilities: {
      type: [String],
      default: [],
    },
    difficulty: {
      type: String,
      enum: ['Easy', 'Moderate', 'Challenging', ''],
      default: '',
    },
    duration: {
      type: String,
      default: '',
    },
    availabilityStatus: {
      type: String,
      enum: ['available', 'limited', 'sold-out', 'inactive'],
      default: 'available',
    },
    availableDates: {
      type: [Date],
      default: [],
    },
    images: {
      type: [String],
      default: [],
    },
    featured: {
      type: Boolean,
      default: false,
    },
    active: {
      type: Boolean,
      default: true,
    },
    manualPriceOverride: {
      type: Number,
      default: null,
    },
    seo: {
      metaTitle: {
        type: String,
        default: '',
      },
      metaDescription: {
        type: String,
        default: '',
      },
    },
  },
  {
    timestamps: true,
  }
);

const Listing = mongoose.model('Listing', listingSchema);

export default Listing;
