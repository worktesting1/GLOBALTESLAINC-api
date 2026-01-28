import mongoose from "mongoose";

const paymentMethodSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
    },
    type: {
      type: String,
      enum: ["crypto", "card", "bank", "other"],
      required: true,
    },
    logo: String,
    description: String,
    networkFee: String,
    isActive: {
      type: Boolean,
      default: true,
    },
    config: mongoose.Schema.Types.Mixed,
    walletAddress: String, // For crypto payments
  },
  {
    timestamps: true,
  },
);

const PaymentMethod =
  mongoose.models.PaymentMethod ||
  mongoose.model("PaymentMethod", paymentMethodSchema);
export default PaymentMethod;
