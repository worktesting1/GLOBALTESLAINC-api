// lib/depositToWalletTransaction.js
import dbConnect from "./mongodb";
import Deposit from "../models/Deposit";
import WalletTransaction from "../models/WalletTransaction";
import Wallet from "../models/Wallet";

export async function createWalletTransactionFromDeposit(depositId) {
  try {
    await dbConnect();

    const deposit = await Deposit.findById(depositId);
    if (!deposit) {
      throw new Error("Deposit not found");
    }

    // Get or create wallet
    let wallet = await Wallet.findOne({ userId: deposit.userId });
    if (!wallet) {
      wallet = await Wallet.create({
        userId: deposit.userId,
        balanceUSD: 0,
      });
    }

    // Create wallet transaction
    const walletTransaction = await WalletTransaction.createFromDeposit(
      deposit,
      wallet,
    );

    // Update wallet balance if deposit is approved
    if (deposit.status === "approved") {
      await wallet.updateBalance(parseFloat(deposit.amount), "DEPOSIT");
      wallet.lastTransactionId = walletTransaction._id;
      await wallet.save();
    }

    return walletTransaction;
  } catch (error) {
    console.error("Error creating wallet transaction from deposit:", error);
    throw error;
  }
}

// Add to your existing deposit endpoint (in POST handler after saving deposit):
import { createWalletTransactionFromDeposit } from "../../../lib/depositToWalletTransaction";

// ... after saving deposit ...
const savedDeposit = await newDeposit.save();
console.log("✅ Deposit created successfully with images");

// Create wallet transaction record
try {
  await createWalletTransactionFromDeposit(savedDeposit._id);
} catch (error) {
  console.error("Failed to create wallet transaction:", error);
  // Don't fail the deposit creation if this fails
}
