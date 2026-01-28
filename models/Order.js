import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true, // This already creates an index
    },
    userId: {
      type: String,
      required: true,
    },
    carId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Car",
      required: true,
    },
    status: {
      type: String,
      enum: [
        "pending",
        "paid",
        "processing",
        "completed",
        "cancelled",
        "expired",
      ],
      default: "pending",
    },

    // Payment Information
    paymentMethod: {
      type: String,
      required: true,
    },
    paymentMethodCode: {
      // Add this field
      type: String,
      required: true,
    },
    paymentCurrency: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    cryptoAmount: {
      type: Number,
      required: function () {
        return this.paymentMethod.includes("crypto");
      },
    },
    walletAddress: String,
    transactionHash: String,

    // Timers
    expiresAt: {
      type: Date,
      required: true,
    },
    paidAt: Date,
    confirmedAt: Date,

    // Billing Information
    billingInfo: {
      name: String,
      email: String,
      phone: String,
      company: String,
      address: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
      taxId: String,
    },

    // Order Details
    items: [
      {
        name: String,
        quantity: Number,
        price: Number,
        total: Number,
      },
    ],

    // Tracking
    trackingNumber: String,
    shippingAddress: {
      address: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
    },

    // Metadata
    metadata: mongoose.Schema.Types.Mixed,
    notes: String,
  },
  {
    timestamps: true,
  },
);

const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);
export default Order;
