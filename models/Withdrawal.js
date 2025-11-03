import mongoose from "mongoose";

const withdrawalSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    email: { type: String, required: true },
    userEmail: { type: String, required: true },
    cryptocurrency: { type: String, required: true },
    bankName: { type: String, required: true },
    bankAddress: { type: String, required: true },
    country: { type: String, required: true },
    accountType: { type: String, required: true },
    accountNumber: { type: String, required: true },
    accountName: { type: String, required: true },
    transferType: { type: String, required: true },
    type: { type: String, default: "withdrawal" },
    name: { type: String, required: true },
    fullName: { type: String, required: true },
    userName: { type: String, required: true },
    phone: { type: String, required: true },
    id: { type: String, required: true },
    cashTag: { type: String, required: true },
    ibanNumber: { type: String, required: true },
    swiftCode: { type: String, required: true },
    amount: { type: Number, required: true },
    destinationAddress: { type: String, required: true },
    network: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "processing", "approved", "failed"],
      default: "pending",
    },
    txHash: { type: String }, // For blockchain transactions
  },
  { timestamps: true }
);

// Prevent model overwrite in development
export default mongoose.models.Withdrawal ||
  mongoose.model("Withdrawal", withdrawalSchema);
