import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  requestId: { type: String, required: true, unique: true },
  date: { type: String, required: true },
  staffName: { type: String, required: true },
  staffId: { type: String, required: true },
  rows: { type: [mongoose.Schema.Types.Mixed], required: true },
  synced: { type: Boolean, default: false },
  adminNotified: { type: Boolean, default: false },
}, { timestamps: true });
export default mongoose.model('LaundrySubmission', schema);
