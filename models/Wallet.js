// models/Wallet.js
import mongoose from "mongoose";

const walletSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    balanceUSD: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Track total deposits and withdrawals
    totalDeposited: {
      type: Number,
      default: 0,
    },

    totalWithdrawn: {
      type: Number,
      default: 0,
    },

    totalInvested: {
      type: Number,
      default: 0,
    },

    // Last transaction reference
    lastTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WalletTransaction",
    },

    // Currency preferences
    currency: {
      type: String,
      default: "USD",
    },

    // Status flags
    isActive: {
      type: Boolean,
      default: true,
    },

    // Security features
    withdrawalLimit: {
      type: Number,
      default: 10000, // Daily withdrawal limit
    },

    dailyWithdrawn: {
      type: Number,
      default: 0,
    },

    lastWithdrawalReset: {
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

// Auto-update timestamp on balance changes
walletSchema.pre("save", function (next) {
  if (this.isModified("balanceUSD")) {
    this.updatedAt = new Date();
  }
  next();
});

// Virtual for recent transactions
walletSchema.virtual("recentTransactions", {
  ref: "WalletTransaction",
  localField: "userId",
  foreignField: "userId",
  options: {
    sort: { createdAt: -1 },
    limit: 10,
  },
});

// Method to update balance
walletSchema.methods.updateBalance = async function (amount, type) {
  let newBalance = this.balanceUSD;

  switch (type) {
    case "DEPOSIT":
    case "REFUND":
    case "BONUS":
    case "INVESTMENT_SELL":
      newBalance += amount;
      if (type === "DEPOSIT") {
        this.totalDeposited += amount;
      }
      break;

    case "WITHDRAWAL":
    case "INVESTMENT_BUY":
    case "FEE":
      newBalance -= amount;
      if (type === "WITHDRAWAL") {
        this.totalWithdrawn += amount;
      }
      if (type === "INVESTMENT_BUY") {
        this.totalInvested += amount;
      }
      break;
  }

  // Check for negative balance
  if (newBalance < 0) {
    throw new Error("Insufficient funds");
  }

  this.balanceUSD = newBalance;
  return await this.save();
};

// Method to check withdrawal limits
walletSchema.methods.canWithdraw = function (amount) {
  // Reset daily withdrawal if it's a new day
  const now = new Date();
  const lastReset = new Date(this.lastWithdrawalReset);
  if (
    now.getDate() !== lastReset.getDate() ||
    now.getMonth() !== lastReset.getMonth() ||
    now.getFullYear() !== lastReset.getFullYear()
  ) {
    this.dailyWithdrawn = 0;
    this.lastWithdrawalReset = now;
  }

  // Check limits
  if (this.dailyWithdrawn + amount > this.withdrawalLimit) {
    return {
      canWithdraw: false,
      reason: `Daily withdrawal limit exceeded. Available: $${this.withdrawalLimit - this.dailyWithdrawn}`,
    };
  }

  if (amount > this.balanceUSD) {
    return {
      canWithdraw: false,
      reason: "Insufficient balance",
    };
  }

  return { canWithdraw: true };
};

export default mongoose.models.Wallet || mongoose.model("Wallet", walletSchema);
