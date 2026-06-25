import mongoose from 'mongoose';

const appSettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
    },
    allowedIps: {
      type: [String],
      default: [],
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const AppSetting = mongoose.model('AppSetting', appSettingSchema);

export default AppSetting;
