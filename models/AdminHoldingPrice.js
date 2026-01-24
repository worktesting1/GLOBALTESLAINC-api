import mongoose from 'mongoose';

const adminHoldingPriceSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    uppercase: true,
    index: true
  },
  adminPrice: {
    type: Number,
    required: true,
    min: 0.01
  },
  reason: {
    type: String,
    trim: true
  },
  effectiveFrom: {
    type: Date,
    default: Date.now
  },
  effectiveTo: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: String,
    required: true
  },
  updatedBy: {
    type: String
  }
}, {
  timestamps: true
});

// Compound index for active prices
adminHoldingPriceSchema.index({ symbol: 1, isActive: 1 });

const AdminHoldingPrice = mongoose.models.AdminHoldingPrice || 
  mongoose.model('AdminHoldingPrice', adminHoldingPriceSchema);

export default AdminHoldingPrice;