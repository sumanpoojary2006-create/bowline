import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    date: {
      type: String,
      required: true,
    },
    checkInAt: {
      type: Date,
      required: true,
    },
    checkInIp: {
      type: String,
      default: '',
    },
    checkOutAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['checked-in', 'checked-out'],
      default: 'checked-in',
    },
    checklist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChecklistSubmission',
      default: null,
    },
    score: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });

const Attendance = mongoose.model('Attendance', attendanceSchema);

export default Attendance;
