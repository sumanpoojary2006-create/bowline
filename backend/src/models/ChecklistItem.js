import mongoose from 'mongoose';

// An admin-managed checklist field. Each item belongs to one employee type
// (role) and is rendered/scored exactly like the built-in templates were.
const checklistItemSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['housekeeping', 'kitchen'],
      required: true,
    },
    key: {
      type: String,
      required: true,
      trim: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['boolean', 'status', 'number', 'text'],
      required: true,
    },
    maxPoints: {
      type: Number,
      default: 0,
      min: 0,
    },
    order: {
      type: Number,
      default: 0,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// key only needs to be stable/unique within a role (responses are keyed by it).
checklistItemSchema.index({ role: 1, key: 1 }, { unique: true });

const ChecklistItem = mongoose.model('ChecklistItem', checklistItemSchema);

export default ChecklistItem;
