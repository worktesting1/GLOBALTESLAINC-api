import mongoose from "mongoose";

const loanSchema = new mongoose.Schema(
  {
    loanType: { type: String, required: true },
    amount: { type: String, required: true },
    term: { type: String, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    income: { type: String, required: true },
    employmentStatus: { type: String, required: true },
    userId: { type: String, required: true },
    type: { type: String, default: "loan" },
    dob: { type: String, required: true },
    status: { type: String, default: "pending" },
    referenceNumber: { type: String, unique: true },
    name: { type: String, required: true },
  },
  { timestamps: true }
);

// Prevent model overwrite in development
export default mongoose.models.Loan || mongoose.model("Loan", loanSchema);
