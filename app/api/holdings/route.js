import { NextResponse } from "next/server";
import dbConnect from "../../../lib/mongodb";
import Holding from "../../../models/Holding";
import { withAuth } from "../../../lib/apiHander";
import { corsHeaders, handleOptions } from "../../../lib/cors";
import {
  formatStockForFrontend,
  fetchLiveStockData,
} from "../../../lib/stockFormatter";

export async function OPTIONS(request) {
  return handleOptions(request);
}

const getHoldingsHandler = async (req, headers) => {
  try {
    await dbConnect();

    const userId = req.userId;
    const { searchParams } = new URL(req.url);

    // Get query parameters
    const symbol = searchParams.get("symbol");
    const assetType = searchParams.get("assetType");
    const sortBy = searchParams.get("sortBy") || "updatedAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";
    const page = parseInt(searchParams.get("page")) || 1;
    const limit = parseInt(searchParams.get("limit")) || 50;
    const skip = (page - 1) * limit;
    const includeRaw = searchParams.get("includeRaw") === "true";

    // Build query
    const query = { userId };

    if (symbol) {
      query.symbol = new RegExp(symbol, "i");
    }

    if (assetType) {
      query.assetType = assetType;
    }

    // Get total count
    const total = await Holding.countDocuments(query);

    // Get holdings with pagination
    const holdings = await Holding.find(query)
      .sort({ [sortBy]: sortOrder === "desc" ? -1 : 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Fetch live data for each holding and format for frontend
    const formattedHoldings = await Promise.all(
      holdings.map(async (holding) => {
        // Fetch current stock data
        const liveData = await fetchLiveStockData(holding.symbol);

        // Merge with holding data
        const stockData = {
          ...liveData,
          symbol: holding.symbol,
          name: holding.name || liveData.name || holding.symbol,
          currency: holding.currency || "USD",
          sector: liveData.sector || holding.sector || "Technology",
          industry: liveData.industry || holding.industry || "Technology",
          exchange: liveData.exchange || holding.exchange || "N/A",
          country: liveData.country || holding.country || "US",
          logo: liveData.logo || holding.logo || "",
        };

        // Format for frontend
        return formatStockForFrontend(stockData, holding.quantity, {
          avgPurchasePrice: holding.avgPurchasePrice,
          totalInvested: holding.totalInvested,
        });
      }),
    );

    // Calculate portfolio summary
    const portfolioSummary = formattedHoldings.reduce(
      (summary, holding) => {
        // Extract numeric values from formatted strings
        const totalValue =
          parseFloat(holding.total.replace(/[^0-9.-]+/g, "")) || 0;
        const totalInvested =
          parseFloat(holding.totalInvested.replace(/[^0-9.-]+/g, "")) || 0;
        const unrealizedPL =
          parseFloat(holding.unrealizedPL.replace(/[^0-9.-]+/g, "")) || 0;

        summary.totalValue += totalValue;
        summary.totalInvested += totalInvested;
        summary.totalUnrealizedPL += unrealizedPL;
        summary.totalHoldingsValue += totalValue;

        // Group by sector
        const sector = holding.sector || "Other";
        if (!summary.bySector[sector]) {
          summary.bySector[sector] = {
            count: 0,
            value: 0,
            percentage: 0,
          };
        }
        summary.bySector[sector].count += 1;
        summary.bySector[sector].value += totalValue;

        return summary;
      },
      {
        totalValue: 0,
        totalInvested: 0,
        totalUnrealizedPL: 0,
        totalHoldingsValue: 0,
        bySector: {},
      },
    );

    // Calculate sector percentages
    Object.keys(portfolioSummary.bySector).forEach((sector) => {
      portfolioSummary.bySector[sector].percentage =
        (portfolioSummary.bySector[sector].value /
          portfolioSummary.totalValue) *
        100;
    });

    // Format portfolio summary
    const formattedSummary = {
      totalValue: `$${portfolioSummary.totalValue.toFixed(2)}`,
      totalInvested: `$${portfolioSummary.totalInvested.toFixed(2)}`,
      totalUnrealizedPL: `$${portfolioSummary.totalUnrealizedPL.toFixed(2)}`,
      totalUnrealizedPLPercent:
        portfolioSummary.totalInvested > 0
          ? `${((portfolioSummary.totalUnrealizedPL / portfolioSummary.totalInvested) * 100).toFixed(2)}%`
          : "0%",
      holdingsCount: total,
      bySector: portfolioSummary.bySector,
    };

    const response = {
      success: true,
      data: {
        holdings: formattedHoldings,
        summary: formattedSummary,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
          hasMore: page * limit < total,
        },
      },
    };

    // Include raw data if requested
    if (includeRaw) {
      response.data.rawHoldings = holdings;
    }

    return NextResponse.json(response, { status: 200, headers });
  } catch (error) {
    console.error("Get holdings error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch holdings",
        details: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500, headers },
    );
  }
};

export const GET = withAuth(getHoldingsHandler);
