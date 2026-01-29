import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import InvestmentTransaction from "@/models/InvestmentTransaction";
import { withAuth } from "@/lib/apiHander";
import { corsHeaders, handleOptions } from "@/lib/cors";

// Handle CORS preflight
export async function OPTIONS(request) {
  return handleOptions(request);
}

export const GET = withAuth(async (request) => {
  try {
    await dbConnect();

    const userId = request.userId;

    // Get query parameters
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit")) || 10;
    const page = parseInt(url.searchParams.get("page")) || 1;
    const type = url.searchParams.get("type"); // INVESTMENT_BUY or INVESTMENT_SELL
    const planId = url.searchParams.get("planId"); // Filter by specific plan

    // Build query
    const query = { userId };

    if (type) {
      query.type = type;
    }

    if (planId) {
      query.planId = planId;
    }

    // Calculate skip for pagination
    const skip = (page - 1) * limit;

    // Get total count for pagination
    const totalCount = await InvestmentTransaction.countDocuments(query);

    // Get transactions with pagination and sorting (newest first)
    const transactions = await InvestmentTransaction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Format the transactions for frontend
    const formattedTransactions = transactions.map((transaction, index) => {
      const isBuy = transaction.type === "INVESTMENT_BUY";

      return {
        id: transaction._id.toString(),
        transactionId: transaction.transactionId,
        type: transaction.type,
        planId: transaction.planId,
        planName: transaction.planName,
        units: transaction.units,
        nav: transaction.nav,
        investmentAmount: transaction.investmentAmount,
        processingFee: transaction.processingFee,
        totalCost: transaction.totalCost,
        status: transaction.status.toLowerCase(),
        currency: transaction.currency,
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt,
        formatted: {
          nav: `$${transaction.nav.toFixed(4)}`,
          investmentAmount: `$${transaction.investmentAmount.toFixed(2)}`,
          processingFee: `$${transaction.processingFee.toFixed(2)}`,
          totalCost: `$${transaction.totalCost.toFixed(2)}`,
          units: transaction.units.toFixed(4),
          date: formatDate(transaction.createdAt),
          time: formatTime(transaction.createdAt),
          fullDate: formatFullDate(transaction.createdAt),
          typeText: isBuy ? "Buy" : "Sell",
          icon: isBuy ? "plus" : "minus",
          color: isBuy ? "green" : "red",
          sign: isBuy ? "-" : "+",
        },
      };
    });

    // Calculate summary stats
    const summary = {
      totalBuyAmount: 0,
      totalSellAmount: 0,
      totalFees: 0,
      totalUnitsBought: 0,
      totalUnitsSold: 0,
      totalTransactions: totalCount,
    };

    transactions.forEach((transaction) => {
      if (transaction.type === "INVESTMENT_BUY") {
        summary.totalBuyAmount += transaction.investmentAmount;
        summary.totalUnitsBought += transaction.units;
      } else if (transaction.type === "INVESTMENT_SELL") {
        summary.totalSellAmount += transaction.investmentAmount;
        summary.totalUnitsSold += transaction.units;
      }
      summary.totalFees += transaction.processingFee || 0;
    });

    // Group by plan for insights
    const planStats = {};
    transactions.forEach((transaction) => {
      if (!planStats[transaction.planId]) {
        planStats[transaction.planId] = {
          planName: transaction.planName,
          buyCount: 0,
          sellCount: 0,
          totalInvestment: 0,
          totalUnits: 0,
        };
      }

      const stat = planStats[transaction.planId];
      if (transaction.type === "INVESTMENT_BUY") {
        stat.buyCount++;
        stat.totalInvestment += transaction.investmentAmount;
        stat.totalUnits += transaction.units;
      } else {
        stat.sellCount++;
      }
    });

    const plans = Object.values(planStats).map((plan) => ({
      ...plan,
      formattedTotalInvestment: `$${plan.totalInvestment.toFixed(2)}`,
      formattedTotalUnits: plan.totalUnits.toFixed(4),
    }));

    return NextResponse.json(
      {
        success: true,
        data: {
          transactions: formattedTransactions,
          pagination: {
            total: totalCount,
            page,
            limit,
            pages: Math.ceil(totalCount / limit),
            hasNext: skip + limit < totalCount,
            hasPrev: page > 1,
          },
          summary: {
            ...summary,
            formattedTotalBuyAmount: `$${summary.totalBuyAmount.toFixed(2)}`,
            formattedTotalSellAmount: `$${summary.totalSellAmount.toFixed(2)}`,
            formattedTotalFees: `$${summary.totalFees.toFixed(2)}`,
            formattedTotalUnitsBought: summary.totalUnitsBought.toFixed(4),
            formattedTotalUnitsSold: summary.totalUnitsSold.toFixed(4),
            netInvestment: summary.totalBuyAmount - summary.totalSellAmount,
            formattedNetInvestment: `$${(summary.totalBuyAmount - summary.totalSellAmount).toFixed(2)}`,
          },
          insights: {
            plans,
            mostActivePlan:
              plans.length > 0
                ? plans.reduce((max, plan) =>
                    plan.buyCount + plan.sellCount >
                    max.buyCount + max.sellCount
                      ? plan
                      : plans[0],
                  )
                : null,
            recentActivity:
              transactions.length > 0
                ? {
                    lastTransaction: formattedTransactions[0],
                    daysSinceLast: Math.floor(
                      (new Date() - new Date(transactions[0].createdAt)) /
                        (1000 * 60 * 60 * 24),
                    ),
                  }
                : null,
          },
        },
      },
      {
        status: 200,
        headers: corsHeaders(request),
      },
    );
  } catch (error) {
    console.error("Get recent investment transactions error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch investment transactions",
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

// Helper function to format date like "Jan 07, 2026"
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Helper function to format time like "09:01 PM"
function formatTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// Helper function to format full date like "Jan 07, 2026 • 09:01 PM"
function formatFullDate(dateString) {
  return `${formatDate(dateString)} • ${formatTime(dateString)}`;
}
