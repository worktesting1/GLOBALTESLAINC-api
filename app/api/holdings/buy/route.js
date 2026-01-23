import { NextResponse } from "next/server";
import dbConnect from "../../../../lib/mongodb";
import Holding from "../../../../models/Holding";
import Transaction from "../../../../models/Transaction";
import { withAuth } from "../../../../lib/apiHander";
import { corsHeaders, handleOptions } from "../../../../lib/cors";
import mongoose from "mongoose";

// Handle CORS preflight
export async function OPTIONS(request) {
  return handleOptions(request);
}

// Main buy endpoint
export const POST = withAuth(async (request) => {
  try {
    await dbConnect();

    const body = await request.json();
    const { symbol, quantity, price, assetName, fees = 0 } = body;

    const userId = request.userId;

    // Validate input
    if (!symbol || !quantity || !price || !assetName) {
      return NextResponse.json(
        {
          error: "Missing required fields: symbol, quantity, price, assetName",
        },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    if (quantity <= 0 || price <= 0) {
      return NextResponse.json(
        { error: "Quantity and price must be greater than zero" },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    // Calculate amounts
    const totalAmount = quantity * price;
    const netAmount = totalAmount + fees;
    const uppercaseSymbol = symbol.toUpperCase();

    // Start MongoDB transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Find existing holding
      let holding = await Holding.findOne({
        userId,
        symbol: uppercaseSymbol,
      }).session(session);

      if (holding) {
        // Calculate new average price (weighted average)
        const existingCost = holding.totalInvested;
        const newCost = totalAmount + fees;
        const newTotalQuantity = holding.quantity + quantity;
        const newAvgPrice = (existingCost + newCost) / newTotalQuantity;

        holding.quantity = newTotalQuantity;
        holding.avgPurchasePrice = newAvgPrice;
        holding.totalInvested = existingCost + newCost;

        holding.purchaseHistory.push({
          quantity,
          price,
          fees,
        });

        await holding.save({ session });
      } else {
        // Create new holding
        holding = new Holding({
          userId,
          symbol: uppercaseSymbol,
          name: assetName,
          quantity,
          avgPurchasePrice: price,
          totalInvested: totalAmount + fees,
          purchaseHistory: [
            {
              quantity,
              price,
              fees,
            },
          ],
          currency: "USD",
        });

        await holding.save({ session });
      }

      // Create transaction record
      const transaction = new Transaction({
        userId,
        type: "BUY",
        symbol: uppercaseSymbol,
        assetName,
        quantity,
        price,
        totalAmount,
        fees,
        netAmount,
        currency: "USD",
        status: "COMPLETED",
      });

      await transaction.save({ session });

      // Commit transaction
      await session.commitTransaction();
      session.endSession();

      // Return success response in your exact format
      return NextResponse.json(
        {
          success: true,
          message: `Successfully purchased ${quantity} shares of ${uppercaseSymbol}`,
          data: {
            symbol: uppercaseSymbol,
            name: assetName,
            price: price,
            change: 0, // You can get this from stock API
            changePercent: 0,
            volume: "0M",
            marketCap: "$0M",
            sector: "Technology",
            industry: "Technology",
            logo: `https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/${uppercaseSymbol}.png`,
            exchange: "NASDAQ",
            country: "US",
            currency: "USD",
            quantity: quantity,
            total: netAmount,
          },
          transaction: {
            id: transaction.transactionId,
            amount: netAmount,
            fees: fees,
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
    console.error("Buy stock error:", error);

    return NextResponse.json(
      {
        error: "Failed to process purchase",
        details: error.message,
      },
      {
        status: 500,
        headers: corsHeaders(request),
      },
    );
  }
});
