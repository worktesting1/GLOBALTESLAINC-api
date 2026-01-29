import mongoose from "mongoose";

const investmentHoldingSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true, // ✅ Keep this for single field index on userId
    },
    planId: {
      type: String,
      required: true,
      // ❌ Remove index: true from here since we're creating compound index below
    },
    planName: {
      type: String,
      required: true,
    },
    units: {
      type: Number,
      required: true,
      min: 0.00000001,
    },
    avgPurchasePrice: {
      type: Number,
      required: true,
      min: 0.01,
    },
    totalInvested: {
      type: Number,
      required: true,
    },
    purchaseHistory: [
      {
        date: { type: Date, default: Date.now },
        units: Number,
        nav: Number,
        fees: { type: Number, default: 0 },
      },
    ],
    currency: {
      type: String,
      default: "USD",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// Remove duplicate index - keep only one definition
// Either remove this line OR remove index: true from planId field above
investmentHoldingSchema.index({ userId: 1, planId: 1 }, { unique: true });

const InvestmentHolding =
  mongoose.models.InvestmentHolding ||
  mongoose.model("InvestmentHolding", investmentHoldingSchema);

export default InvestmentHolding;
