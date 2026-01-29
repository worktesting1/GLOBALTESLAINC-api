import mongoose from "mongoose";

const investmentTransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true, // ✅ Keep single field index
    },
    transactionId: {
      type: String,
      unique: true,
      default: () =>
        `INVTXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    },
    type: {
      type: String,
      enum: ["INVESTMENT_BUY", "INVESTMENT_SELL"],
      required: true,
    },
    planId: {
      type: String,
      required: true,
      // ❌ Remove index: true if you have schema.index() below
    },
    planName: {
      type: String,
      required: true,
    },
    units: {
      type: Number,
      required: true,
    },
    nav: {
      type: Number,
      required: true,
    },
    investmentAmount: {
      type: Number,
      required: true,
    },
    processingFee: {
      type: Number,
      default: 0,
    },
    totalCost: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "COMPLETED", "FAILED"],
      default: "COMPLETED",
    },
    currency: {
      type: String,
      default: "USD",
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for faster queries - remove duplicate field-level indexes
investmentTransactionSchema.index({ userId: 1, createdAt: -1 });
investmentTransactionSchema.index({ planId: 1 }); // ✅ Schema-level only
investmentTransactionSchema.index({ type: 1 });

const InvestmentTransaction =
  mongoose.models.InvestmentTransaction ||
  mongoose.model("InvestmentTransaction", investmentTransactionSchema);

export default InvestmentTransaction;
