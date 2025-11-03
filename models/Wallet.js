import mongoose from "mongoose";

const walletSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    balanceUSD: {
      type: Number,
      default: 0,
      min: 0, // Prevent negative balances
    },
  },
  { timestamps: true }
);

// Auto-update timestamp on balance changes
walletSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

// Prevent model overwrite in development
export default mongoose.models.Wallet || mongoose.model("Wallet", walletSchema);
