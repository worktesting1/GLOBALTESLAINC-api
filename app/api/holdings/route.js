import { NextResponse } from "next/server";
import dbConnect from "../../../lib/mongodb";
import Holding from "../../../models/Holding";
import { withAuth } from "../../../lib/apiHander";
import { corsHeaders, handleOptions } from "../../../lib/cors";
import { fetchLiveStockData } from "../../../lib/stockFormatter";

export async function OPTIONS(request) {
  return handleOptions(request);
}

export const GET = withAuth(async (request) => {
  try {
    await dbConnect();

    const userId = request.userId;
    const { searchParams } = new URL(request.url);

    // Get all holdings for this user
    const holdings = await Holding.find({ userId }).lean();

    // Format holdings data for frontend
    const formattedHoldings = await Promise.all(
      holdings.map(async (holding) => {
        try {
          // Fetch current stock price from your Finnhub/Alpha Vantage API
          const liveData = await fetchLiveStockData(holding.symbol);

          // Calculate values
          const currentPrice = liveData?.price || holding.currentPrice || 0;
          const totalValue = holding.quantity * currentPrice;
          const totalInvested =
            holding.totalInvested ||
            holding.quantity * holding.avgPurchasePrice;
          const gainLoss = totalValue - totalInvested;
          const gainLossPercent =
            totalInvested > 0 ? (gainLoss / totalInvested) * 100 : 0;

          return {
            id: holding._id,
            _id: holding._id,
            symbol: holding.symbol,
            name: holding.name || `${holding.symbol} Inc.`,
            shares: holding.quantity,
            avgPrice: `$${holding.avgPurchasePrice.toFixed(2)}`,
            currentPrice: `$${currentPrice.toFixed(2)}`,
            priceChange: "+0.00%", // You can calculate this from liveData
            priceChangeColor: gainLoss >= 0 ? "text-green-600" : "text-red-600",
            totalValue: `$${totalValue.toFixed(2)}`,
            gainLoss: `${gainLoss >= 0 ? "+" : ""}$${Math.abs(gainLoss).toFixed(2)}`,
            gainLossPercent: `${gainLoss >= 0 ? "+" : ""}${Math.abs(gainLossPercent).toFixed(2)}%`,
            gainLossColor: gainLoss >= 0 ? "text-green-600" : "text-red-600",
            logo:
              holding.logo ||
              `https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/${holding.symbol}.png`,
            buyLink: `/trading/buy/${holding.symbol}`,
            sellLink: `/trading/sell/${holding.symbol}`,
          };
        } catch (error) {
          console.error(`Error fetching data for ${holding.symbol}:`, error);

          // Return fallback data if API fails
          const totalInvested =
            holding.totalInvested ||
            holding.quantity * holding.avgPurchasePrice;

          return {
            id: holding._id,
            _id: holding._id,
            symbol: holding.symbol,
            name: holding.name || `${holding.symbol} Inc.`,
            shares: holding.quantity,
            avgPrice: `$${holding.avgPurchasePrice.toFixed(2)}`,
            currentPrice: `$${(holding.currentPrice || holding.avgPurchasePrice).toFixed(2)}`,
            priceChange: "+0.00%",
            priceChangeColor: "text-gray-600",
            totalValue: `$${totalInvested.toFixed(2)}`,
            gainLoss: "+$0.00",
            gainLossPercent: "+0.00%",
            gainLossColor: "text-gray-600",
            logo:
              holding.logo ||
              `https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/${holding.symbol}.png`,
            buyLink: `/trading/${holding.symbol}/buy`,
            sellLink: `/trading/${holding.symbol}/sell`,
          };
        }
      }),
    );

    // Calculate portfolio summary
    let totalValue = 0;
    let totalInvested = 0;

    for (const holding of holdings) {
      const liveData = await fetchLiveStockData(holding.symbol).catch(
        () => null,
      );
      const currentPrice =
        liveData?.price || holding.currentPrice || holding.avgPurchasePrice;
      totalValue += holding.quantity * currentPrice;
      totalInvested +=
        holding.totalInvested || holding.quantity * holding.avgPurchasePrice;
    }

    const totalGainLoss = totalValue - totalInvested;
    const totalGainLossPercent =
      totalInvested > 0 ? (totalGainLoss / totalInvested) * 100 : 0;

    const portfolioSummary = [
      {
        title: "Total Value",
        value: `$${totalValue.toFixed(2)}`,
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
        percentage: `${totalGainLoss >= 0 ? "+" : "-"}${Math.abs(totalGainLossPercent).toFixed(2)}%`,
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

    return NextResponse.json(
      {
        success: true,
        data: {
          portfolioSummary,
          holdings: formattedHoldings,
          totalHoldings: holdings.length,
        },
      },
      {
        status: 200,
        headers: corsHeaders(request),
      },
    );
  } catch (error) {
    console.error("Get portfolio error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch portfolio",
        details: error.message,
      },
      {
        status: 500,
        headers: corsHeaders(request),
      },
    );
  }
});
