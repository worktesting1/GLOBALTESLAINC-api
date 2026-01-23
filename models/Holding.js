import mongoose from "mongoose";

const holdingSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    symbol: { type: String, required: true, uppercase: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0.00000001 },
    avgPurchasePrice: { type: Number, required: true, min: 0.01 },
    totalInvested: { type: Number, required: true },
    purchaseHistory: [
      {
        date: { type: Date, default: Date.now },
        quantity: Number,
        price: Number,
        fees: { type: Number, default: 0 },
      },
    ],
    currency: { type: String, default: "USD" },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  },
);

// Ensure one holding per user per symbol
holdingSchema.index({ userId: 1, symbol: 1 }, { unique: true });

const Holding =
  mongoose.models.Holding || mongoose.model("Holding", holdingSchema);
export default Holding;
