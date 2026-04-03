import mongoose from 'mongoose';

const pricingRuleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Listing',
      default: null,
    },
    listingType: {
      type: String,
      enum: ['room', 'trek', 'camp', 'all'],
      default: 'all',
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    adjustmentType: {
      type: String,
      enum: ['flat', 'percentage'],
      required: true,
    },
    adjustmentValue: {
      type: Number,
      required: true,
    },
    priority: {
      type: Number,
      default: 1,
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

const PricingRule = mongoose.model('PricingRule', pricingRuleSchema);

export default PricingRule;
