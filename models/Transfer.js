import mongoose from "mongoose";

const transferSchema = new mongoose.Schema(
  {
    bankName: { type: String, required: true },
    accountNumber: { type: String, required: true },
    accountType: { type: String, required: true },
    accountName: { type: String, required: true },
    amount: { type: String, required: true },
    transactiontype: { type: String, default: "withdraw" },
    userId: { type: String, required: true },
    status: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Prevent model overwrite in development
export default mongoose.models.Transfer ||
  mongoose.model("Transfer", transferSchema);
