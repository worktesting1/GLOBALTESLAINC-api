import { NextResponse } from "next/server";
import { withAuth } from "@/lib/apiHander";
import Holding from "@/models/Holding";
import Transaction from "@/models/Transaction";
import { corsHeaders, handleOptions } from "@/lib/cors"; // Import CORS utilities
import dbConnect from "@/lib/mongodb";

// Handle CORS preflight
export async function OPTIONS(request) {
  return handleOptions(request);
}

// GET portfolio performance
async function handler(req) {
  try {
    await dbConnect();
    const userId = req.userId; // Set by withAuth middleware

    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "1m";

    // Get user's holdings
    const holdings = await Holding.find({ userId });

    if (!holdings || holdings.length === 0) {
      return NextResponse.json(
        {
          labels: [],
          datasets: [],
          summary: {
            totalValue: 0,
            totalInvested: 0,
            totalReturn: 0,
            returnPercentage: 0,
          },
        },
        {
          headers: corsHeaders(req),
        },
      );
    }

    // Calculate date range based on period
    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
      case "1d":
        startDate.setDate(endDate.getDate() - 1);
        break;
      case "1w":
        startDate.setDate(endDate.getDate() - 7);
        break;
      case "1m":
        startDate.setMonth(endDate.getMonth() - 1);
        break;
      case "1y":
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      default:
        startDate.setMonth(endDate.getMonth() - 1);
    }

    // Fetch transactions within period
    const transactions = await Transaction.find({
      userId,
      createdAt: { $gte: startDate, $lte: endDate },
      status: "COMPLETED",
    }).sort({ createdAt: 1 });

    // Process chart data
    const { chartData, summary } = await processChartData(
      holdings,
      transactions,
      period,
    );

    return NextResponse.json(
      {
        ...chartData,
        summary,
      },
      {
        headers: corsHeaders(req),
      },
    );
  } catch (error) {
    console.error("Error fetching portfolio performance:", error);
    return NextResponse.json(
      { error: "Failed to fetch portfolio performance" },
      {
        status: 500,
        headers: corsHeaders(req),
      },
    );
  }
}

// Export with auth middleware
export const GET = withAuth(handler);

// Helper functions
async function processChartData(holdings, transactions, period) {
  // Group transactions by symbol
  const symbolTransactions = {};
  transactions.forEach((txn) => {
    if (!symbolTransactions[txn.symbol]) {
      symbolTransactions[txn.symbol] = [];
    }
    symbolTransactions[txn.symbol].push(txn);
  });

  // Calculate portfolio summary
  let totalValue = 0;
  let totalInvested = 0;

  // Calculate performance for each holding
  const datasets = holdings
    .map((holding, index) => {
      const symbol = holding.symbol;
      const holdingTransactions = symbolTransactions[symbol] || [];

      const dataset = createDatasetForHolding(
        holding,
        holdingTransactions,
        period,
        index,
      );

      if (dataset) {
        totalValue += dataset.currentValue;
        totalInvested += holding.totalInvested;
      }

      return dataset;
    })
    .filter((dataset) => dataset !== null);

  // Sort by performance (top performers)
  const topStocks = datasets
    .sort((a, b) => (b.performance || 0) - (a.performance || 0))
    .slice(0, 7);

  // Create labels based on period
  const labels = generateLabels(period);

  const totalReturn = totalValue - totalInvested;
  const returnPercentage =
    totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;

  const chartData = {
    labels,
    datasets: topStocks,
  };

  const summary = {
    totalValue: Math.round(totalValue * 100) / 100,
    totalInvested: Math.round(totalInvested * 100) / 100,
    totalReturn: Math.round(totalReturn * 100) / 100,
    returnPercentage: Math.round(returnPercentage * 100) / 100,
  };

  return { chartData, summary };
}

function createDatasetForHolding(holding, transactions, period, index) {
  // Calculate based on transactions in period
  let periodInvested = 0;
  let periodQuantity = 0;

  transactions.forEach((txn) => {
    if (txn.type === "BUY") {
      periodInvested += txn.totalAmount;
      periodQuantity += txn.quantity;
    } else if (txn.type === "SELL") {
      periodInvested -= txn.totalAmount;
      periodQuantity -= txn.quantity;
    }
  });

  // Use holding data if no transactions in period
  const effectiveInvested =
    periodQuantity > 0 ? periodInvested : holding.totalInvested;
  const effectiveQuantity =
    periodQuantity > 0 ? periodQuantity : holding.quantity;

  // Calculate average price and simulate current price
  const avgPrice =
    effectiveQuantity > 0
      ? effectiveInvested / effectiveQuantity
      : holding.avgPurchasePrice;

  // Simulate realistic price movement (±15% from average)
  const priceVariation = 0.15;
  const randomMultiplier =
    1 + (Math.random() * priceVariation * 2 - priceVariation);
  const currentPrice = avgPrice * randomMultiplier;

  const currentValue = currentPrice * holding.quantity;
  const performance =
    holding.totalInvested > 0
      ? ((currentValue - holding.totalInvested) / holding.totalInvested) * 100
      : 0;

  // Generate historical data points
  const data = generateHistoricalData(period, avgPrice, currentPrice);

  return {
    label: holding.symbol,
    name: holding.name,
    data: data,
    borderColor: getColorForIndex(index),
    backgroundColor: getColorForIndex(index, 0.1),
    tension: 0.4,
    pointRadius: 0,
    pointHoverRadius: 5,
    performance: Math.round(performance * 100) / 100,
    currentValue: Math.round(currentValue * 100) / 100,
    totalInvested: Math.round(holding.totalInvested * 100) / 100,
    quantity: holding.quantity,
    avgPrice: Math.round(avgPrice * 100) / 100,
    currentPrice: Math.round(currentPrice * 100) / 100,
  };
}

function generateHistoricalData(period, startPrice, endPrice) {
  const points = period === "1d" ? 24 : 20;
  const data = [];

  let currentPrice = startPrice;
  const priceChangePerStep = (endPrice - startPrice) / points;
  const volatility = 0.01; // 1% volatility

  for (let i = 0; i <= points; i++) {
    // Add trend plus random volatility
    const randomChange = (Math.random() * 2 - 1) * volatility;
    currentPrice = currentPrice * (1 + randomChange) + priceChangePerStep;

    // Ensure positive price
    currentPrice = Math.max(currentPrice, 0.01);
    data.push(Math.round(currentPrice * 100) / 100);
  }

  // Adjust last point to match end price
  data[points] = Math.round(endPrice * 100) / 100;

  return data;
}

function generateLabels(period) {
  const labels = [];
  const now = new Date();
  const points = period === "1d" ? 24 : 20;

  for (let i = points; i >= 0; i--) {
    const date = new Date(now);

    switch (period) {
      case "1d":
        date.setHours(date.getHours() - i);
        labels.push(
          date.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          }),
        );
        break;
      case "1w":
        date.setDate(date.getDate() - i);
        labels.push(
          date.toLocaleDateString("en-US", {
            weekday: "short",
          }),
        );
        break;
      case "1m":
        date.setDate(date.getDate() - i);
        labels.push(`${date.getMonth() + 1}/${date.getDate()}`);
        break;
      case "1y":
        date.setMonth(date.getMonth() - i);
        labels.push(
          date.toLocaleDateString("en-US", {
            month: "short",
          }),
        );
        break;
      default:
        date.setDate(date.getDate() - i);
        labels.push(`${date.getMonth() + 1}/${date.getDate()}`);
    }
  }

  return labels;
}

function getColorForIndex(index, opacity = 1) {
  const colors = [
    `rgba(59, 130, 246, ${opacity})`, // Blue
    `rgba(16, 185, 129, ${opacity})`, // Green
    `rgba(245, 158, 11, ${opacity})`, // Orange
    `rgba(239, 68, 68, ${opacity})`, // Red
    `rgba(139, 92, 246, ${opacity})`, // Purple
    `rgba(236, 72, 153, ${opacity})`, // Pink
    `rgba(6, 182, 212, ${opacity})`, // Cyan
  ];

  return colors[index % colors.length];
}
