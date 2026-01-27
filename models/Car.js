// models/Car.js
import mongoose from "mongoose";

const carSchema = new mongoose.Schema(
  {
    // Basic Information
    name: {
      type: String,
      required: [true, "Car name is required"],
      trim: true,
    },
    fullName: {
      type: String,
      required: [true, "Full car name is required"],
      trim: true,
    },
    year: {
      type: String,
      required: [true, "Year is required"],
    },

    // Pricing
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },
    priceDisplay: {
      type: String,
      default: "",
    },

    // Specifications
    range: {
      type: String,
      default: "",
    },
    acceleration: {
      type: String,
      default: "",
    },
    topSpeed: {
      type: String,
      default: "",
    },
    battery: {
      type: String,
      default: "",
    },
    charging: {
      type: String,
      default: "",
    },
    seating: {
      type: Number,
      default: 5,
    },

    // Images
    images: [
      {
        url: {
          type: String,
          required: true,
        },
        publicId: {
          type: String,
          default: "",
        },
        isPrimary: {
          type: Boolean,
          default: false,
        },
        caption: {
          type: String,
          default: "",
        },
      },
    ],

    // Status
    status: {
      type: String,
      enum: ["available", "sold-out", "reserved", "coming-soon"],
      default: "available",
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },

    // Additional Information
    description: {
      type: String,
      default: "",
    },
    features: [String],
    specifications: {
      type: Map,
      of: String,
      default: {},
    },

    // Links
    link: {
      type: String,
      default: "",
    },

    // Metadata
    views: {
      type: Number,
      default: 0,
    },
    clicks: {
      type: Number,
      default: 0,
    },

    // Admin
    createdBy: {
      type: String,
      required: true,
    },
    updatedBy: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes for faster queries
carSchema.index({ status: 1, isFeatured: 1 });
carSchema.index({ year: 1 });
carSchema.index({ price: 1 });
carSchema.index({ isAvailable: 1 });

// Virtual for formatted price
carSchema.virtual("formattedPrice").get(function () {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(this.price);
});

// Middleware to update priceDisplay
carSchema.pre("save", function (next) {
  if (this.isModified("price")) {
    this.priceDisplay = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(this.price);
  }
  next();
});

const Car = mongoose.models.Car || mongoose.model("Car", carSchema);
export default Car;
