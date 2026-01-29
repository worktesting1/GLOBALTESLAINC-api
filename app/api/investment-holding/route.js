import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import InvestmentHolding from "@/models/InvestmentHolding";
import InvestmentPlan from "@/models/InvestmentPlan";
import { withAuth } from "@/lib/apiHander"; // Assuming you have withAuth middleware
import { corsHeaders, handleOptions } from "@/lib/cors";

// Handle CORS preflight
export async function OPTIONS(request) {
  return handleOptions(request);
}

export const GET = withAuth(async (request) => {
  try {
    await dbConnect();

    const userId = request.userId;

    // Get all investment holdings for this user
    const holdings = await InvestmentHolding.find({ userId }).lean();

    if (holdings.length === 0) {
      return NextResponse.json(
        {
          success: true,
          data: {
            holdings: [],
            summary: {
              totalHoldings: 0,
              totalInvested: 0,
              currentValue: 0,
              totalGainLoss: 0,
              totalGainLossPercentage: 0,
            },
          },
          message: "No investment holdings found",
        },
        {
          status: 200,
          headers: corsHeaders(request),
        },
      );
    }

    // Get current NAV for each plan
    const holdingsWithCurrentData = await Promise.all(
      holdings.map(async (holding) => {
        try {
          // Get current plan data
          const plan = await InvestmentPlan.findById(holding.planId).lean();

          if (!plan) {
            return {
              ...holding,
              planName: holding.planName || "Unknown Plan",
              currentNav: holding.avgPurchasePrice || 0,
              oneYearReturn: 0,
              status: "inactive",
              currentValue: holding.totalInvested || 0,
              gainLoss: 0,
              gainLossPercentage: 0,
            };
          }

          // Calculate current value and gain/loss
          const currentNav = plan.nav || holding.avgPurchasePrice;
          const currentValue = (holding.units || 0) * currentNav;
          const totalInvested = holding.totalInvested || 0;
          const gainLoss = currentValue - totalInvested;
          const gainLossPercentage =
            totalInvested > 0 ? (gainLoss / totalInvested) * 100 : 0;

          return {
            id: holding._id.toString(),
            userId: holding.userId,
            planId: holding.planId,
            planName: plan.name || holding.planName,
            planCategory: plan.category,
            units: holding.units || 0,
            avgPurchasePrice: holding.avgPurchasePrice || 0,
            totalInvested,
            currency: holding.currency || "USD",
            createdAt: holding.createdAt,
            updatedAt: holding.updatedAt,
            purchaseHistory: holding.purchaseHistory || [],
            // Current data
            currentNav,
            oneYearReturn: plan.oneYearReturn || 0,
            planStatus: plan.status || "active",
            riskLevel: plan.riskLevel,
            // Calculated values
            currentValue,
            gainLoss,
            gainLossPercentage,
            formatted: {
              units: (holding.units || 0).toFixed(4),
              avgPurchasePrice: `$${(holding.avgPurchasePrice || 0).toFixed(4)}`,
              totalInvested: `$${totalInvested.toFixed(2)}`,
              currentValue: `$${currentValue.toFixed(2)}`,
              currentNav: `$${currentNav.toFixed(4)}`,
              gainLoss: `${gainLoss >= 0 ? "+" : ""}$${Math.abs(gainLoss).toFixed(2)}`,
              gainLossPercentage: `${gainLoss >= 0 ? "+" : ""}${Math.abs(gainLossPercentage).toFixed(2)}%`,
              oneYearReturn: `${plan.oneYearReturn >= 0 ? "+" : ""}${(plan.oneYearReturn || 0).toFixed(2)}%`,
            },
          };
        } catch (error) {
          console.error(`Error processing holding ${holding._id}:`, error);
          // Return basic data if plan fetch fails
          return {
            ...holding,
            id: holding._id.toString(),
            planName: holding.planName || "Unknown Plan",
            currentValue: holding.totalInvested || 0,
            gainLoss: 0,
            gainLossPercentage: 0,
            formatted: {
              units: (holding.units || 0).toFixed(4),
              avgPurchasePrice: `$${(holding.avgPurchasePrice || 0).toFixed(4)}`,
              totalInvested: `$${(holding.totalInvested || 0).toFixed(2)}`,
              currentValue: `$${(holding.totalInvested || 0).toFixed(2)}`,
              currentNav: `$${(holding.avgPurchasePrice || 0).toFixed(4)}`,
              gainLoss: "+$0.00",
              gainLossPercentage: "+0.00%",
              oneYearReturn: "+0.00%",
            },
          };
        }
      }),
    );

    // Calculate portfolio summary
    const totalInvested = holdingsWithCurrentData.reduce(
      (sum, h) => sum + (h.totalInvested || 0),
      0,
    );
    const currentValue = holdingsWithCurrentData.reduce(
      (sum, h) => sum + (h.currentValue || 0),
      0,
    );
    const totalGainLoss = currentValue - totalInvested;
    const totalGainLossPercentage =
      totalInvested > 0 ? (totalGainLoss / totalInvested) * 100 : 0;

    // Create portfolio summary array similar to the other route
    const portfolioSummary = [
      {
        title: "Total Value",
        value: `$${currentValue.toFixed(2)}`,
        icon: "dollar-sign",
        gradient: "from-blue-500 to-blue-600",
        color: "text-gray-900",
      },
      {
        title: "Total Invested",
        value: `$${totalInvested.toFixed(2)}`,
        icon: "trending-up",
        gradient: "from-green-500 to-green-600",
        color: "text-gray-900",
      },
      {
        title: "Total Gain/Loss",
        value: `${totalGainLoss >= 0 ? "+" : "-"}$${Math.abs(totalGainLoss).toFixed(2)}`,
        percentage: `${totalGainLoss >= 0 ? "+" : "-"}${Math.abs(totalGainLossPercentage).toFixed(2)}%`,
        icon: "trending-up",
        gradient:
          totalGainLoss >= 0
            ? "from-green-500 to-green-600"
            : "from-red-500 to-red-600",
        color: totalGainLoss >= 0 ? "text-green-600" : "text-red-600",
      },
      {
        title: "Holdings",
        value: holdings.length.toString(),
        icon: "pie-chart",
        gradient: "from-purple-500 to-purple-600",
        color: "text-gray-900",
      },
    ];

    // Create summary object as well for compatibility
    const summary = {
      totalHoldings: holdingsWithCurrentData.length,
      totalInvested,
      currentValue,
      totalGainLoss,
      totalGainLossPercentage,
      formattedTotalInvested: `$${totalInvested.toFixed(2)}`,
      formattedCurrentValue: `$${currentValue.toFixed(2)}`,
      formattedTotalGainLoss: `${totalGainLoss >= 0 ? "+" : "-"}$${Math.abs(totalGainLoss).toFixed(2)}`,
      formattedTotalGainLossPercentage: `${totalGainLoss >= 0 ? "+" : "-"}${Math.abs(totalGainLossPercentage).toFixed(2)}%`,
    };

    return NextResponse.json(
      {
        success: true,
        data: {
          portfolioSummary,
          holdings: holdingsWithCurrentData,
          summary,
          totalHoldings: holdings.length,
          breakdown: {
            byCategory: holdingsWithCurrentData.reduce((acc, holding) => {
              const category = holding.planCategory || "Uncategorized";
              if (!acc[category]) {
                acc[category] = {
                  count: 0,
                  totalInvested: 0,
                  currentValue: 0,
                };
              }
              acc[category].count++;
              acc[category].totalInvested += holding.totalInvested || 0;
              acc[category].currentValue += holding.currentValue || 0;
              return acc;
            }, {}),
            byRiskLevel: holdingsWithCurrentData.reduce((acc, holding) => {
              const riskLevel = holding.riskLevel || "Unknown";
              if (!acc[riskLevel]) {
                acc[riskLevel] = {
                  count: 0,
                  totalInvested: 0,
                  currentValue: 0,
                };
              }
              acc[riskLevel].count++;
              acc[riskLevel].totalInvested += holding.totalInvested || 0;
              acc[riskLevel].currentValue += holding.currentValue || 0;
              return acc;
            }, {}),
          },
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
