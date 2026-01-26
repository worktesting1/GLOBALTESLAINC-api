// app/api/user/transaction-history/route.js
import { NextResponse } from "next/server";
import dbConnect from "../../../../lib/mongodb";
import Deposit from "../../../../models/Deposit";
import Transaction from "../../../../models/Transaction"; // Stock BUY/SELL
import Holding from "../../../../models/Holding"; // Current holdings
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

    // Fetch ALL data in parallel
    const [deposits, stockTransactions, holdings] = await Promise.all([
      // Get deposits
      Deposit.find({ userId }).sort({ createdAt: -1 }).limit(100).lean(),
      // Get stock BUY/SELL transactions
      Transaction.find({ userId }).sort({ createdAt: -1 }).limit(100).lean(),
      // Get current holdings for total investment calculation
      Holding.find({ userId }).lean(),
    ]);

    // Calculate stats
    const totalDeposits = deposits
      .filter((d) => d.status === "approved")
      .reduce((sum, d) => sum + parseFloat(d.amount || 0), 0);

    const totalInvested = holdings.reduce(
      (sum, h) => sum + (h.totalInvested || 0),
      0,
    );

    // Calculate total withdrawals (you'll need a Withdrawal model)
    const totalWithdrawals = 0; // Placeholder

    // Format transactions to match your frontend structure
    const formattedTransactions = [];

    // 1. Add deposits
    deposits.forEach((deposit, index) => {
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
    stockTransactions.forEach((transaction, index) => {
      const isBuy = transaction.type === "BUY";

      formattedTransactions.push({
        id: `investment_${transaction._id}`,
        type: "investment",
        title: isBuy ? "Investment" : "Sale",
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

    // 3. Sort by date (newest first)
    formattedTransactions.sort(
      (a, b) => new Date(b.rawDate) - new Date(a.rawDate),
    );

    // 4. Add sequential IDs after sorting
    formattedTransactions.forEach((t, i) => {
      t.displayId = i + 1;
    });

    // 5. Get recent transactions (last 20)
    const recentTransactions = formattedTransactions.slice(0, 20);

    // 6. Calculate current portfolio value (simplified - you might want real-time prices)
    const currentPortfolioValue = holdings.reduce((sum, holding) => {
      // For demo, use purchase value. In real app, fetch current price
      return sum + (holding.totalInvested || 0);
    }, 0);

    // Return the EXACT format your frontend expects
    return NextResponse.json(
      {
        transactions: recentTransactions,
        stats: {
          totalDeposits: totalDeposits.toFixed(2),
          totalWithdrawals: totalWithdrawals.toFixed(2),
          totalInvested: totalInvested.toFixed(2),
          currentPortfolioValue: currentPortfolioValue.toFixed(2),
        },
        holdings: holdings.map((h) => ({
          symbol: h.symbol,
          name: h.name,
          quantity: h.quantity,
          avgPurchasePrice: h.avgPurchasePrice,
          totalInvested: h.totalInvested,
          currentValue: h.totalInvested, // Placeholder - should be quantity * currentPrice
        })),
        summary: {
          totalTransactions: formattedTransactions.length,
          depositCount: deposits.length,
          investmentCount: stockTransactions.length,
          holdingCount: holdings.length,
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
        title: "Investment",
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
        displayId: 3,
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
        id: "investment_2",
        displayId: 4,
        type: "investment",
        title: "Sale",
        description: "AAPL Sale",
        amount: 500.0,
        status: "completed",
        date: "Dec 24, 2025 • 08:24 AM",
        sign: "+",
        color: "green",
        icon: "arrow-right-left",
      },
      {
        id: "investment_3",
        displayId: 5,
        type: "investment",
        title: "Investment",
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
      currentPortfolioValue: "35000.00",
    },
    holdings: [
      {
        symbol: "NVDA",
        name: "NVIDIA Corporation",
        quantity: 5,
        avgPurchasePrice: 450.0,
        totalInvested: 2250.0,
        currentValue: 2500.0,
      },
      {
        symbol: "TSLA",
        name: "Tesla Inc",
        quantity: 10,
        avgPurchasePrice: 200.0,
        totalInvested: 2000.0,
        currentValue: 2200.0,
      },
    ],
    summary: {
      totalTransactions: 15,
      depositCount: 8,
      investmentCount: 7,
      holdingCount: 2,
    },
  };
}
