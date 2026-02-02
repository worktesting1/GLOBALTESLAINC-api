// app/api/user/transaction-history/route.js
import { NextResponse } from "next/server";
import dbConnect from "../../../../lib/mongodb";
import Deposit from "../../../../models/Deposit";
import Transaction from "../../../../models/Transaction"; // Stock BUY/SELL
import Holding from "../../../../models/Holding"; // Current holdings
import InvestmentHolding from "../../../../models/InvestmentHolding"; // Investment holdings (plans)
import InvestmentTransaction from "../../../../models/InvestmentTransaction"; // Investment transactions
import { withAuth } from "../../../../lib/apiHander";
import { corsHeaders, handleOptions } from "../../../../lib/cors";

// Handle CORS preflight
export async function OPTIONS(request) {
  return handleOptions(request);
}

export const GET = withAuth(async (request) => {
  try {
    await dbConnect();

    const userId = request.userId;

    // Fetch ALL data in parallel - ADDED investment models
    const [
      deposits,
      stockTransactions,
      stockHoldings,
      investmentHoldings,
      investmentTransactions,
    ] = await Promise.all([
      // Get deposits
      Deposit.find({ userId }).sort({ createdAt: -1 }).limit(100).lean(),
      // Get stock BUY/SELL transactions
      Transaction.find({ userId }).sort({ createdAt: -1 }).limit(100).lean(),
      // Get current stock holdings for total investment calculation
      Holding.find({ userId }).lean(),
      // Get investment plan holdings
      InvestmentHolding.find({ userId }).lean(),
      // Get investment plan transactions
      InvestmentTransaction.find({ userId })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
    ]);

    // Calculate stats
    const totalDeposits = deposits
      .filter((d) => d.status === "approved")
      .reduce((sum, d) => sum + parseFloat(d.amount || 0), 0);

    // Calculate total invested in stocks
    const totalStockInvested = stockHoldings.reduce(
      (sum, h) => sum + (h.totalInvested || 0),
      0,
    );

    // Calculate total invested in investment plans
    const totalPlanInvested = investmentHoldings.reduce(
      (sum, h) => sum + (h.totalInvested || 0),
      0,
    );

    // Combined total investment
    const totalInvested = totalStockInvested + totalPlanInvested;

    // Calculate total withdrawals (you'll need a Withdrawal model)
    const totalWithdrawals = 0; // Placeholder

    // Format transactions to match your frontend structure
    const formattedTransactions = [];

    // 1. Add deposits
    deposits.forEach((deposit) => {
      formattedTransactions.push({
        id: `deposit_${deposit._id}`,
        type: "deposit",
        title: "Deposit",
        description: deposit.transactionType || "Bitcoin",
        amount: parseFloat(deposit.amount) || 0,
        status: deposit.status === "approved" ? "completed" : "pending",
        date: formatDate(deposit.createdAt),
        sign: "+",
        color: "green",
        icon: "plus",
        rawDate: deposit.createdAt,
        referenceNumber: deposit.referenceNumber,
      });
    });

    // 2. Add stock investment transactions (BUY/SELL)
    stockTransactions.forEach((transaction) => {
      const isBuy = transaction.type === "BUY";

      formattedTransactions.push({
        id: `stock_${transaction._id}`,
        type: "stock",
        title: isBuy ? "Stock Purchase" : "Stock Sale",
        description: `${transaction.symbol} ${isBuy ? "Purchase" : "Sale"}`,
        amount: transaction.totalAmount || 0,
        status: transaction.status?.toLowerCase() || "completed",
        date: formatDate(transaction.createdAt),
        sign: isBuy ? "-" : "+",
        color: isBuy ? "blue" : "green",
        icon: "arrow-right-left",
        rawDate: transaction.createdAt,
        symbol: transaction.symbol,
        quantity: transaction.quantity,
        price: transaction.price,
      });
    });

    // 3. Add investment plan transactions (NEW)
    investmentTransactions.forEach((transaction) => {
      const isBuy = transaction.type === "INVESTMENT_BUY";
      const isSell = transaction.type === "INVESTMENT_SELL";

      let title, description, sign, color;

      if (isBuy) {
        title = "Plan Investment";
        description = `${transaction.planName} Purchase`;
        sign = "-";
        color = "purple";
      } else if (isSell) {
        title = "Plan Withdrawal";
        description = `${transaction.planName} Withdrawal`;
        sign = "+";
        color = "orange";
      }

      formattedTransactions.push({
        id: `investment_${transaction._id || transaction.transactionId}`,
        type: "investment",
        title: title,
        description: description,
        amount: transaction.totalCost || transaction.investmentAmount || 0,
        status: transaction.status?.toLowerCase() || "completed",
        date: formatDate(transaction.createdAt),
        sign: sign,
        color: color,
        icon: "trending-up", // Different icon for plan investments
        rawDate: transaction.createdAt,
        planId: transaction.planId,
        planName: transaction.planName,
        units: transaction.units,
        nav: transaction.nav,
        processingFee: transaction.processingFee,
        transactionId: transaction.transactionId,
      });
    });

    // 4. Sort by date (newest first)
    formattedTransactions.sort(
      (a, b) => new Date(b.rawDate) - new Date(a.rawDate),
    );

    // 5. Add sequential IDs after sorting
    formattedTransactions.forEach((t, i) => {
      t.displayId = i + 1;
    });

    // 6. Get recent transactions (last 20)
    const recentTransactions = formattedTransactions.slice(0, 20);

    // 7. Calculate current portfolio value
    // Stock holdings value (simplified - you might want real-time prices)
    const currentStockValue = stockHoldings.reduce((sum, holding) => {
      // For demo, use purchase value. In real app, fetch current price
      return sum + (holding.totalInvested || 0);
    }, 0);

    // Investment plan holdings value (using NAV if available, otherwise invested amount)
    const currentPlanValue = investmentHoldings.reduce((sum, holding) => {
      // Use current NAV calculation or invested amount
      const currentNav = holding.currentNav || holding.avgPurchasePrice || 0;
      const value = holding.units * currentNav;
      return sum + (value || holding.totalInvested || 0);
    }, 0);

    const currentPortfolioValue = currentStockValue + currentPlanValue;

    // Return the EXACT format your frontend expects
    return NextResponse.json(
      {
        transactions: recentTransactions,
        stats: {
          totalDeposits: totalDeposits.toFixed(2),
          totalWithdrawals: totalWithdrawals.toFixed(2),
          totalInvested: totalInvested.toFixed(2),
          totalStockInvested: totalStockInvested.toFixed(2),
          totalPlanInvested: totalPlanInvested.toFixed(2),
          currentPortfolioValue: currentPortfolioValue.toFixed(2),
          currentStockValue: currentStockValue.toFixed(2),
          currentPlanValue: currentPlanValue.toFixed(2),
        },
        // Stock holdings (separate property)
        holdings: stockHoldings.map((h) => ({
          symbol: h.symbol,
          name: h.name,
          quantity: h.quantity,
          avgPurchasePrice: h.avgPurchasePrice,
          totalInvested: h.totalInvested,
          currentValue: h.totalInvested, // Placeholder - should be quantity * currentPrice
          logo: `https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/${h.symbol}.png`,
        })),
        // Investment holdings (separate property)
        investmentHoldings: investmentHoldings.map((h) => ({
          planId: h.planId,
          planName: h.planName,
          units: h.units,
          avgPurchasePrice: h.avgPurchasePrice,
          totalInvested: h.totalInvested,
          currentValue: h.totalInvested, // Placeholder - should be units * currentNAV
          logo: "📊", // Default icon or custom plan logo
          currency: h.currency,
          purchaseHistory: h.purchaseHistory || [],
          createdAt: h.createdAt,
          updatedAt: h.updatedAt,
        })),
        summary: {
          totalTransactions: formattedTransactions.length,
          depositCount: deposits.length,
          stockTransactionCount: stockTransactions.length,
          investmentTransactionCount: investmentTransactions.length,
          stockHoldingCount: stockHoldings.length,
          planHoldingCount: investmentHoldings.length,
        },
      },
      {
        status: 200,
        headers: corsHeaders(request),
      },
    );
  } catch (error) {
    console.error("Transaction history error:", error);

    // Return sample data if there's an error (for development)
    return NextResponse.json(getSampleData(), {
      status: 200,
      headers: corsHeaders(request),
    });
  }
});

// Helper function to format dates like "Jan 07, 2026 • 09:01 PM"
function formatDate(dateString) {
  const date = new Date(dateString);

  const month = date.toLocaleDateString("en-US", { month: "short" });
  const day = date.getDate();
  const year = date.getFullYear();
  const time = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return `${month} ${day}, ${year} • ${time}`;
}

// Sample data for development/fallback
function getSampleData() {
  return {
    transactions: [
      {
        id: "deposit_1",
        displayId: 1,
        type: "deposit",
        title: "Deposit",
        description: "Bitcoin",
        amount: 60000.0,
        status: "pending",
        date: "Jan 07, 2026 • 09:01 PM",
        sign: "+",
        color: "green",
        icon: "plus",
      },
      {
        id: "investment_1",
        displayId: 2,
        type: "investment",
        title: "Plan Investment",
        description: "Retirement Plan Purchase",
        amount: 1000.0,
        status: "completed",
        date: "Jan 07, 2026 • 08:50 PM",
        sign: "-",
        color: "purple",
        icon: "trending-up",
      },
      {
        id: "stock_1",
        displayId: 3,
        type: "stock",
        title: "Stock Purchase",
        description: "NVDA Purchase",
        amount: 200.0,
        status: "completed",
        date: "Jan 07, 2026 • 08:42 PM",
        sign: "-",
        color: "blue",
        icon: "arrow-right-left",
      },
      {
        id: "deposit_2",
        displayId: 4,
        type: "deposit",
        title: "Deposit",
        description: "Bitcoin",
        amount: 3000.0,
        status: "pending",
        date: "Jan 04, 2026 • 01:53 PM",
        sign: "+",
        color: "green",
        icon: "plus",
      },
      {
        id: "stock_2",
        displayId: 5,
        type: "stock",
        title: "Stock Sale",
        description: "AAPL Sale",
        amount: 500.0,
        status: "completed",
        date: "Dec 24, 2025 • 08:24 AM",
        sign: "+",
        color: "green",
        icon: "arrow-right-left",
      },
      {
        id: "stock_3",
        displayId: 6,
        type: "stock",
        title: "Stock Purchase",
        description: "TSLA Purchase",
        amount: 100.0,
        status: "completed",
        date: "Dec 24, 2025 • 08:01 AM",
        sign: "-",
        color: "blue",
        icon: "arrow-right-left",
      },
    ],
    stats: {
      totalDeposits: "11100.00",
      totalWithdrawals: "500.00",
      totalInvested: "33618.38",
      totalStockInvested: "23618.38",
      totalPlanInvested: "10000.00",
      currentPortfolioValue: "35000.00",
      currentStockValue: "25000.00",
      currentPlanValue: "10000.00",
    },
    // Stock holdings only
    holdings: [
      {
        symbol: "NVDA",
        name: "NVIDIA Corporation",
        quantity: 5,
        avgPurchasePrice: 450.0,
        totalInvested: 2250.0,
        currentValue: 2500.0,
        logo: `https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/NVDA.png`,
      },
      {
        symbol: "TSLA",
        name: "Tesla Inc",
        quantity: 10,
        avgPurchasePrice: 200.0,
        totalInvested: 2000.0,
        currentValue: 2200.0,
        logo: `https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/TSLA.png`,
      },
    ],
    // Investment holdings in separate property
    investmentHoldings: [
      {
        planId: "retirement_plan_2024",
        planName: "Retirement Growth Plan",
        units: 100,
        avgPurchasePrice: 100.0,
        totalInvested: 10000.0,
        currentValue: 10500.0,
        logo: "📊",
        currency: "USD",
        purchaseHistory: [
          {
            date: "2024-01-15T00:00:00.000Z",
            units: 50,
            nav: 95.0,
            fees: 25.0,
          },
          {
            date: "2024-02-20T00:00:00.000Z",
            units: 50,
            nav: 105.0,
            fees: 25.0,
          },
        ],
      },
      {
        planId: "education_fund",
        planName: "Education Savings Plan",
        units: 50,
        avgPurchasePrice: 150.0,
        totalInvested: 7500.0,
        currentValue: 8000.0,
        logo: "📊",
        currency: "USD",
        purchaseHistory: [
          {
            date: "2024-03-10T00:00:00.000Z",
            units: 50,
            nav: 150.0,
            fees: 25.0,
          },
        ],
      },
    ],
    summary: {
      totalTransactions: 25,
      depositCount: 8,
      stockTransactionCount: 7,
      investmentTransactionCount: 10,
      stockHoldingCount: 2,
      planHoldingCount: 2,
    },
  };
}
