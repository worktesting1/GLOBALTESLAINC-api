import mongoose from "mongoose";

const kycSchema = new mongoose.Schema(
  {
    idNumber: { type: String, required: true, unique: true },
    idName: { type: String, required: true, unique: true },
    name: { type: String, required: true, unique: true },
    front: { type: Array, required: true, unique: true },
    back: { type: Array, required: true, unique: true },
    userId: { type: String, default: null },
    email: { type: String, required: true },
    status: { type: String, default: "pending" },
  },
  { timestamps: true },
);

// Prevent model overwrite in development
export default mongoose.models.Kyc || mongoose.model("Kyc", kycSchema);
