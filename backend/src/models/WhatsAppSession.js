import mongoose from 'mongoose';

const whatsAppSessionSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    step: {
      type: String,
      default: 'MENU',
    },
    flow: {
      type: String,
      enum: ['single', 'group'],
      default: 'single',
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    cart: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    lastBookingIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'Booking',
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

whatsAppSessionSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 });

export default mongoose.model('WhatsAppSession', whatsAppSessionSchema);
