import { NextResponse } from "next/server";
import dbConnect from "../../../../lib/mongodb";
import Holding from "../../../../models/Holding";
import Transaction from "../../../../models/Transaction";
import Wallet from "../../../../models/Wallet";
import { withAuth } from "../../../../lib/apiHander";
import { corsHeaders, handleOptions } from "../../../../lib/cors";
import mongoose from "mongoose";

export async function OPTIONS(request) {
  return handleOptions(request);
}

export const POST = withAuth(async (request) => {
  try {
    await dbConnect();

    const body = await request.json();
    const { symbol, quantity, price, assetName, fees = 0 } = body; // Remove holdingId

    const userId = request.userId;

    // Validate input
    if (!symbol || !quantity || !price) {
      return NextResponse.json(
        { error: "Missing required fields: symbol, quantity, price" },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    if (quantity <= 0 || price <= 0) {
      return NextResponse.json(
        { error: "Quantity and price must be greater than zero" },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    const uppercaseSymbol = symbol.toUpperCase();

    // Start MongoDB transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Find the holding by userId and symbol (NOT by holdingId)
      const holding = await Holding.findOne({
        userId,
        symbol: uppercaseSymbol,
      }).session(session);

      if (!holding) {
        throw new Error(`You don't own any ${uppercaseSymbol} shares`);
      }

      // Check if user has enough shares
      if (holding.quantity < quantity) {
        throw new Error(
          `Insufficient shares. You only have ${holding.quantity} shares of ${uppercaseSymbol}`,
        );
      }

      // Calculate amounts
      const totalAmount = quantity * price;
      const netAmount = totalAmount - fees; // Seller receives amount minus fees

      // Update holding
      holding.quantity -= quantity;

      // If all shares sold, delete the holding
      if (holding.quantity <= 0) {
        await Holding.findByIdAndDelete(holding._id).session(session);
      } else {
        // Recalculate total invested proportionally
        const originalShares = holding.quantity + quantity;
        const remainingPercentage = holding.quantity / originalShares;
        holding.totalInvested = holding.totalInvested * remainingPercentage;
        await holding.save({ session });
      }

      // Create sell transaction
      const transaction = new Transaction({
        userId,
        type: "SELL",
        symbol: uppercaseSymbol,
        assetName: assetName || holding.name || `${uppercaseSymbol} Shares`,
        quantity,
        price,
        totalAmount,
        fees,
        netAmount,
        currency: "USD",
        status: "COMPLETED",
      });

      await transaction.save({ session });

      // Add to user's wallet balance
      let wallet = await Wallet.findOne({ userId }).session(session);

      if (!wallet) {
        wallet = new Wallet({
          userId,
          balanceUSD: netAmount,
        });
        await wallet.save({ session });
      } else {
        wallet.balanceUSD += netAmount;
        await wallet.save({ session });
      }

      // Commit transaction
      await session.commitTransaction();
      session.endSession();

      // Return success response
      return NextResponse.json(
        {
          success: true,
          message: `Successfully sold ${quantity} shares of ${uppercaseSymbol}`,
          transactionId: transaction.transactionId,
          holdingId: holding._id, // Send back the holdingId if needed
          data: {
            symbol: uppercaseSymbol,
            name: assetName || holding.name,
            quantity: quantity,
            price: price,
            totalAmount: totalAmount,
            fees: fees,
            netAmount: netAmount,
            remainingShares: holding.quantity > 0 ? holding.quantity : 0,
            wallet: {
              newBalance: wallet.balanceUSD,
              amountAdded: netAmount,
            },
          },
        },
        {
          status: 200,
          headers: corsHeaders(request),
        },
      );
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error) {
    console.error("Sell stock error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to sell shares",
      },
      {
        status: 500,
        headers: corsHeaders(request),
      },
    );
  }
});
