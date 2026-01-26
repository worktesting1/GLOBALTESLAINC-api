import mongoose from "mongoose";

const depositSchema = new mongoose.Schema(
  {
    amount: { type: String, required: true },
    status: { type: String, default: "pending" },
    transactionHash: { type: String, required: true },
    userId: { type: String, required: true },
    type: { type: String, default: "deposit" },
    transactionType: { type: String, default: "Crypto" },
    name: { type: String, required: true },
    referenceNumber: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    image: { type: Array, required: true },
  },
  { timestamps: true },
);

// Prevent model overwrite in development
export default mongoose.models.Deposit ||
  mongoose.model("Deposit", depositSchema);
