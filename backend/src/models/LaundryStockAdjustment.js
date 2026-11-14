import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  itemId: { type: String, required: true },
  itemName: { type: String, required: true },
  previousStock: { type: Number, required: true, min: 0 },
  newStock: { type: Number, required: true, min: 0 },
  quantity: { type: Number, required: true, min: 1 },
  reason: { type: String, enum: ['lost', 'damaged'], required: true },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  adminName: { type: String, required: true },
}, { timestamps: true });

schema.index({ createdAt: 1, reason: 1 });

export default mongoose.model('LaundryStockAdjustment', schema);
