import mongoose from "mongoose";

const investmentPlanSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
      enum: [
        "Tesla-Focused",
        "ESG",
        "Conservative",
        "Income",
        "Growth",
        "Balanced",
      ],
    },
    riskLevel: {
      type: String,
      required: true,
      enum: ["Low", "Medium", "High"],
    },
    nav: {
      type: Number,
      required: true,
      min: 0,
    },
    oneYearReturn: {
      type: Number,
      required: true,
    },
    minInvestment: {
      type: Number,
      required: true,
      min: 0,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    performanceData: [
      {
        date: Date,
        nav: Number,
        return: Number,
      },
    ],
    features: [String],
    tags: [String],
    investmentStrategy: String,
    fundManager: String,
    inceptionDate: Date,
    totalAssets: Number,
    expenseRatio: Number,
    dividendYield: Number,
    status: {
      type: String,
      enum: ["active", "closed", "coming-soon"],
      default: "active",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes for faster queries
investmentPlanSchema.index({ category: 1, riskLevel: 1 });
investmentPlanSchema.index({ isFeatured: 1 });
investmentPlanSchema.index({ name: "text", description: "text" });

// Virtual for formatted NAV
investmentPlanSchema.virtual("formattedNav").get(function () {
  return `$${this.nav.toFixed(4)}`;
});

// Virtual for formatted return
investmentPlanSchema.virtual("formattedReturn").get(function () {
  const sign = this.oneYearReturn >= 0 ? "+" : "";
  return `${sign}${this.oneYearReturn.toFixed(2)}%`;
});

const InvestmentPlan =
  mongoose.models.InvestmentPlan ||
  mongoose.model("InvestmentPlan", investmentPlanSchema);

export default InvestmentPlan;
