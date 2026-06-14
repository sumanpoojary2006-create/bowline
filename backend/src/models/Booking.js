import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema(
  {
    bookingType: {
      type: String,
      enum: ['room', 'trek', 'camp'],
      required: true,
      index: true,
    },
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Listing',
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    guests: {
      type: Number,
      required: true,
      min: 1,
    },
    adultGuests: {
      type: Number,
      default: 1,
      min: 0,
    },
    childGuests: {
      type: Number,
      default: 0,
      min: 0,
    },
    pets: {
      type: Number,
      default: 0,
      min: 0,
    },
    unitPrice: {
      type: Number,
      required: true,
    },
    totalPrice: {
      type: Number,
      required: true,
    },
    pricingBreakdown: {
      basePrice: {
        type: Number,
        default: 0,
      },
      adjustments: {
        type: [String],
        default: [],
      },
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled'],
      default: 'pending',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
    },
    paymentMethod: {
      type: String,
      default: 'manual',
    },
    contactName: {
      type: String,
      required: true,
    },
    contactEmail: {
      type: String,
      required: true,
    },
    contactPhone: {
      type: String,
      default: '',
    },
    specialRequests: {
      type: String,
      default: '',
    },
    groupId: {
      type: String,
      default: null,
      index: true,
    },
    groupName: {
      type: String,
      default: '',
    },
    isGroupBooking: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const Booking = mongoose.model('Booking', bookingSchema);

export default Booking;
