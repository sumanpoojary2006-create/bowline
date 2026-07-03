import mongoose from 'mongoose';

// Permanent record of every unique phone number that has ever messaged the
// bot — unlike WhatsAppSession (which expires after 24h of inactivity) this
// never gets deleted, so it answers "how many people have used this number".
const whatsAppContactSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    profileName: {
      type: String,
      default: '',
    },
    firstSeenAt: {
      type: Date,
      default: Date.now,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
    messageCount: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('WhatsAppContact', whatsAppContactSchema);
