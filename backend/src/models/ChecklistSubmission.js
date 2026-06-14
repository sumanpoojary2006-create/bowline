import mongoose from 'mongoose';

const responseSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    value: { type: mongoose.Schema.Types.Mixed, default: null },
    points: { type: Number, default: 0 },
    maxPoints: { type: Number, default: 0 },
  },
  { _id: false }
);

const checklistSubmissionSchema = new mongoose.Schema(
  {
    attendance: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Attendance',
      required: true,
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    type: {
      type: String,
      enum: ['housekeeping', 'kitchen'],
      required: true,
    },
    responses: {
      type: [responseSchema],
      default: [],
    },
    totalScore: {
      type: Number,
      default: 0,
    },
    adminReviewed: {
      type: Boolean,
      default: false,
    },
    adminNotes: {
      type: String,
      default: '',
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const ChecklistSubmission = mongoose.model('ChecklistSubmission', checklistSubmissionSchema);

export default ChecklistSubmission;
