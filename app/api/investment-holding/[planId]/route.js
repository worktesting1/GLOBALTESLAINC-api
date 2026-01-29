import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import InvestmentHolding from "@/models/InvestmentHolding";
import InvestmentPlan from "@/models/InvestmentPlan";
import { withAuth } from "@/lib/apiHander";
import { corsHeaders, handleOptions } from "@/lib/cors";

export async function OPTIONS(request) {
  return handleOptions(request);
}

export const GET = withAuth(async (request, { params }) => {
  try {
    await dbConnect();

    const userId = request.userId;
    const { planId } = await params;

    if (!planId) {
      return NextResponse.json(
        {
          success: false,
          error: "Plan ID is required",
        },
        {
          status: 400,
          headers: corsHeaders(request),
        },
      );
    }

    // Get the investment plan for current NAV
    const plan = await InvestmentPlan.findById(planId).lean();
    if (!plan) {
      return NextResponse.json(
        {
          success: false,
          error: "Investment plan not found",
        },
        {
          status: 404,
          headers: corsHeaders(request),
        },
      );
    }

    // Get user's holding for this plan
    const holding = await InvestmentHolding.findOne({
      userId,
      planId,
    }).lean();

    if (!holding) {
      // Return empty holding data if no holdings exist
      return NextResponse.json(
        {
          success: true,
          data: {
            planId,
            planName: plan.name,
            currentUnits: 0,
            currentValue: 0,
            averageCost: 0,
            totalInvested: 0,
            totalGainLoss: 0,
            totalGainLossPercentage: 0,
            currentNav: plan.nav,
            oneYearReturn: plan.oneYearReturn,
          },
        },
        {
          status: 200,
          headers: corsHeaders(request),
        },
      );
    }

    // Calculate current values
    const currentUnits = holding.units;
    const currentValue = currentUnits * plan.nav;
    const totalGainLoss = currentValue - holding.totalInvested;
    const totalGainLossPercentage =
      holding.totalInvested > 0
        ? (totalGainLoss / holding.totalInvested) * 100
        : 0;

    return NextResponse.json(
      {
        success: true,
        data: {
          planId,
          planName: plan.name,
          currentUnits,
          currentValue,
          averageCost: holding.avgPurchasePrice,
          totalInvested: holding.totalInvested,
          totalGainLoss,
          totalGainLossPercentage: totalGainLossPercentage.toFixed(2),
          currentNav: plan.nav,
          oneYearReturn: plan.oneYearReturn,
          purchaseHistory: holding.purchaseHistory || [],
        },
      },
      {
        status: 200,
        headers: corsHeaders(request),
      },
    );
  } catch (error) {
    console.error("Get investment holdings error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch investment holdings",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      },
      {
        status: 500,
        headers: corsHeaders(request),
      },
    );
  }
});
