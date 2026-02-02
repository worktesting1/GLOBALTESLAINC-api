import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import InvestmentHolding from "@/models/InvestmentHolding";
import InvestmentTransaction from "@/models/InvestmentTransaction";
import Wallet from "@/models/Wallet";
import InvestmentPlan from "@/models/InvestmentPlan";
import { withAuth } from "@/lib/apiHander";
import { corsHeaders, handleOptions } from "@/lib/cors";
import mongoose from "mongoose";

export async function OPTIONS(request) {
  return handleOptions(request);
}

export const POST = withAuth(async (request) => {
  try {
    await dbConnect();

    const body = await request.json();
    const { planId, units, price, fees = 0 } = body;

    const userId = request.userId;

    // Validate input
    if (!planId || !units || !price) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: planId, units, price",
        },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    if (units <= 0 || price <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Units and price must be greater than zero",
        },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    // Start MongoDB transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Find the holding by userId and planId
      const holding = await InvestmentHolding.findOne({
        userId,
        planId,
      }).session(session);

      if (!holding) {
        throw new Error(`You don't own any shares of this investment plan`);
      }

      // Check if user has enough units
      if (holding.units < units) {
        throw new Error(
          `Insufficient units. You only have ${holding.units.toFixed(4)} units`,
        );
      }

      // Get current plan to validate price
      const plan = await InvestmentPlan.findById(planId).session(session);

      if (!plan) {
        throw new Error("Investment plan not found");
      }

      // Validate price is reasonable (within 10% of current NAV)
      const currentNav = plan.nav;
      const priceDifference = Math.abs(price - currentNav);
      const allowedDifference = currentNav * 0.1; // 10% tolerance

      if (priceDifference > allowedDifference) {
        throw new Error(
          `Price is too far from current NAV. Current NAV: $${currentNav.toFixed(4)}, Your price: $${price.toFixed(4)}`,
        );
      }

      // Calculate amounts
      const totalAmount = units * price;
      const netAmount = totalAmount - fees;

      // Calculate gain/loss for this sale
      const totalInvestedInSoldUnits =
        (holding.totalInvested / holding.units) * units;
      const gainLoss = netAmount - totalInvestedInSoldUnits;
      const gainLossPercentage = (gainLoss / totalInvestedInSoldUnits) * 100;

      // Update holding
      holding.units -= units;

      // If all units sold, delete the holding
      if (holding.units <= 0) {
        await InvestmentHolding.findByIdAndDelete(holding._id).session(session);
      } else {
        // Recalculate total invested proportionally
        const originalUnits = holding.units + units;
        const remainingPercentage = holding.units / originalUnits;
        holding.totalInvested = holding.totalInvested * remainingPercentage;

        // Recalculate average purchase price
        holding.avgPurchasePrice = holding.totalInvested / holding.units;

        // Add sell record to history if you have a sellHistory field
        if (holding.sellHistory) {
          holding.sellHistory.push({
            date: new Date(),
            units: units,
            sellPrice: price,
            amount: netAmount,
          });
        }

        await holding.save({ session });
      }

      // Create sell transaction
      const transaction = new InvestmentTransaction({
        userId,
        type: "INVESTMENT_SELL",
        planId,
        planName: holding.planName,
        units,
        nav: price, // Using the sell price as NAV for this transaction
        investmentAmount: totalAmount,
        processingFee: fees,
        totalCost: netAmount,
        currency: "USD",
        status: "COMPLETED",
        gainLoss: gainLoss,
        gainLossPercentage: gainLossPercentage,
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
          message: `Successfully sold ${units.toFixed(4)} units of ${holding.planName}`,
          transactionId: transaction.transactionId,
          data: {
            planId: planId,
            planName: holding.planName,
            units: units,
            price: price,
            totalAmount: totalAmount,
            fees: fees,
            netAmount: netAmount,
            remainingUnits: holding.units > 0 ? holding.units : 0,
            gainLoss: gainLoss,
            gainLossPercentage: gainLossPercentage,
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
    console.error("Sell investment error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to sell investment units",
      },
      {
        status: 500,
        headers: corsHeaders(request),
      },
    );
  }
});
