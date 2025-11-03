import mongoose from "mongoose";

const fundingRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    currency: {
      type: String,
      required: true,
      enum: ["USD", "EUR", "GBP", "JPY"],
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    transactionType: {
      type: String,
      required: true,
    },
    name: { type: String, required: true },
    filter: { type: String, default: "funding" },
    type: { type: String, default: "funding" },
    email: { type: String, required: true },
    referenceNumber: { type: String, unique: true },
    image: { type: Array, required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "reject"],
      default: "pending",
    },
  },
  { timestamps: true }
);

// Prevent model overwrite in development
export default mongoose.models.FundingRequest ||
  mongoose.model("FundingRequest", fundingRequestSchema);
