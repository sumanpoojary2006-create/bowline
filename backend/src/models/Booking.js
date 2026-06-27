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
      default: null,
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
    vegCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    nonVegCount: {
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
      coupon: {
        code: {
          type: String,
          default: '',
        },
        title: {
          type: String,
          default: '',
        },
        discount: {
          type: Number,
          default: 0,
        },
      },
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'blocked'],
      default: 'pending',
    },
    blockNote: {
      type: String,
      default: null,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'partially_paid', 'paid', 'failed', 'refunded', 'partially_refunded'],
      default: 'pending',
    },
    // Set when the guest opts to pay the full amount upfront instead of the
    // default 50% deposit. Read by verifyPayment, then cleared.
    payInFullRequested: {
      type: Boolean,
      default: false,
    },
    paymentMethod: {
      type: String,
      default: 'manual',
    },
    razorpayOrderId: {
      type: String,
      default: null,
      index: true,
    },
    razorpayPaymentId: {
      type: String,
      default: null,
    },
    razorpayPaymentLinkId: {
      type: String,
      default: null,
      index: true,
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
    rescheduled: {
      type: Boolean,
      default: false,
    },
    refundAmount: {
      type: Number,
      default: 0,
    },
    refundPercentage: {
      type: Number,
      default: 0,
    },
    razorpayRefundId: {
      type: String,
      default: null,
    },
    rescheduleFeeAmount: {
      type: Number,
      default: 0,
    },
    rescheduleFeeOrderId: {
      type: String,
      default: null,
    },
    rescheduleFeePaymentId: {
      type: String,
      default: null,
    },
    source: {
      type: String,
      enum: ['website', 'admin', 'sheet', 'airbnb', 'whatsapp'],
      default: 'website',
    },
    externalId: {
      type: String,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const Booking = mongoose.model('Booking', bookingSchema);

export default Booking;
