import mongoose from 'mongoose';

const leaveSchema = new mongoose.Schema(
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
  },
  {
    timestamps: true,
  }
);

leaveSchema.index({ employee: 1, date: 1 }, { unique: true });

const Leave = mongoose.model('Leave', leaveSchema);

export default Leave;
