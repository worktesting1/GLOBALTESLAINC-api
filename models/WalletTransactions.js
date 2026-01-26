// models/WalletTransaction.js
import mongoose from "mongoose";

const walletTransactionSchema = new mongoose.Schema(
  {
    // Required fields
    userId: {
      type: String,
      required: true,
      index: true,
    },

    transactionId: {
      type: String,
      unique: true,
      required: true,
      default: () =>
        `WTX${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
    },

    // Link to existing Deposit (if applicable)
    depositId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Deposit",
      index: true,
    },

    // Link to existing Stock Transaction (if applicable)
    stockTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
      index: true,
    },

    type: {
      type: String,
      enum: [
        "DEPOSIT",
        "WITHDRAWAL",
        "INVESTMENT_BUY",
        "INVESTMENT_SELL",
        "INTERNAL_TRANSFER",
        "REFUND",
        "FEE",
        "BONUS",
        "ADJUSTMENT",
      ],
      required: true,
    },

    // For deposits, connect to your existing deposit types
    depositType: {
      type: String,
      enum: [
        "CRYPTO",
        "BANK_TRANSFER",
        "CREDIT_CARD",
        "DEBIT_CARD",
        "PAYPAL",
        "WIRE",
        "CHECK",
      ],
    },

    // For investments
    investmentType: {
      type: String,
      enum: ["STOCK", "CRYPTO", "ETF", "BOND", "MUTUAL_FUND"],
    },

    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },

    currency: {
      type: String,
      default: "USD",
    },

    fees: {
      type: Number,
      default: 0,
    },

    netAmount: {
      type: Number,
      required: true,
    },

    // Wallet balance tracking
    previousBalance: {
      type: Number,
      required: true,
    },

    newBalance: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      enum: [
        "PENDING",
        "COMPLETED",
        "FAILED",
        "CANCELLED",
        "UNDER_REVIEW",
        "REFUNDED",
      ],
      default: "PENDING",
    },

    // Description for UI display
    description: {
      type: String,
      required: true,
    },

    // Metadata
    metadata: {
      symbol: String, // For investment transactions
      quantity: Number,
      price: Number,
      transactionHash: String, // For crypto deposits/withdrawals
      bankName: String,
      accountNumber: String,
      paymentProof: String, // URL
      notes: String,
    },

    // Auto-expiry for pending transactions
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      index: { expireAfterSeconds: 0 },
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
walletTransactionSchema.index({ userId: 1, createdAt: -1 });
walletTransactionSchema.index({ status: 1 });
walletTransactionSchema.index({ type: 1 });
walletTransactionSchema.index({ "metadata.transactionHash": 1 });

// Pre-save middleware to calculate net amount
walletTransactionSchema.pre("save", function (next) {
  if (this.isModified("amount") || this.isModified("fees")) {
    if (["DEPOSIT", "REFUND", "BONUS"].includes(this.type)) {
      this.netAmount = this.amount - this.fees;
    } else if (["WITHDRAWAL", "INVESTMENT_BUY", "FEE"].includes(this.type)) {
      this.netAmount = this.amount + this.fees;
    } else {
      this.netAmount = this.amount;
    }
  }
  next();
});

// Static method to create transaction from deposit
walletTransactionSchema.statics.createFromDeposit = async function (
  deposit,
  wallet,
) {
  const WalletTransaction = this;

  return await WalletTransaction.create({
    userId: deposit.userId,
    depositId: deposit._id,
    type: "DEPOSIT",
    depositType: deposit.transactionType || "CRYPTO",
    amount: parseFloat(deposit.amount),
    currency: "USD",
    fees: 0, // You can add fee logic here
    previousBalance: wallet.balanceUSD,
    newBalance: wallet.balanceUSD + parseFloat(deposit.amount),
    status: deposit.status === "approved" ? "COMPLETED" : "PENDING",
    description: `Deposit via ${deposit.transactionType}`,
    metadata: {
      transactionHash: deposit.transactionHash,
      paymentProof: deposit.image?.[0]?.url,
      notes: `Reference: ${deposit.referenceNumber}`,
    },
  });
};

// Static method to create transaction from stock purchase
walletTransactionSchema.statics.createFromStockTransaction = async function (
  stockTransaction,
  wallet,
) {
  const WalletTransaction = this;

  const type =
    stockTransaction.type === "BUY" ? "INVESTMENT_BUY" : "INVESTMENT_SELL";

  return await WalletTransaction.create({
    userId: stockTransaction.userId,
    stockTransactionId: stockTransaction._id,
    type: type,
    investmentType: "STOCK",
    amount: stockTransaction.netAmount,
    currency: stockTransaction.currency || "USD",
    fees: stockTransaction.fees || 0,
    previousBalance: wallet.balanceUSD,
    newBalance:
      type === "INVESTMENT_BUY"
        ? wallet.balanceUSD - stockTransaction.netAmount
        : wallet.balanceUSD + stockTransaction.netAmount,
    status: "COMPLETED",
    description: `${stockTransaction.type} ${stockTransaction.quantity} shares of ${stockTransaction.symbol}`,
    metadata: {
      symbol: stockTransaction.symbol,
      quantity: stockTransaction.quantity,
      price: stockTransaction.price,
      assetName: stockTransaction.assetName,
    },
  });
};

const WalletTransaction =
  mongoose.models.WalletTransaction ||
  mongoose.model("WalletTransaction", walletTransactionSchema);

export default WalletTransaction;
