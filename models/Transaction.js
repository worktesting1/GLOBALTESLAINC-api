import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    transactionId: {
      type: String,
      unique: true,
      default: () =>
        `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    },
    type: {
      type: String,
      enum: ["BUY", "SELL"],
      required: true,
    },
    symbol: { type: String, required: true, uppercase: true },
    assetName: { type: String, required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    fees: { type: Number, default: 0 },
    netAmount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["PENDING", "COMPLETED", "FAILED"],
      default: "COMPLETED",
    },
    currency: { type: String, default: "USD" },
  },
  {
    timestamps: true,
  },
);

transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ symbol: 1 });

const Transaction =
  mongoose.models.Transaction ||
  mongoose.model("Transaction", transactionSchema);
export default Transaction;
