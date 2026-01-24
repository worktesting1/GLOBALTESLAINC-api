import { NextResponse } from "next/server";
import dbConnect from "../../../../../lib/mongodb";
import AdminHoldingPrice from "../../../../../models/AdminHoldingPrice";
import { withAdmin } from "../../../../../lib/apiHandler";
import { corsHeaders, handleOptions } from "../../../../../lib/cors";

export async function OPTIONS(request) {
  return handleOptions(request);
}

export const GET = withAdmin(async (request) => {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol");
    const page = parseInt(searchParams.get("page")) || 1;
    const limit = parseInt(searchParams.get("limit")) || 50;
    const skip = (page - 1) * limit;

    // Build query
    const query = {};
    if (symbol) {
      query.symbol = new RegExp(symbol, "i");
    }

    // Get price history
    const [priceHistory, total] = await Promise.all([
      AdminHoldingPrice.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AdminHoldingPrice.countDocuments(query),
    ]);

    // Group by symbol for summary
    const symbolSummary = {};
    priceHistory.forEach((price) => {
      if (!symbolSummary[price.symbol]) {
        symbolSummary[price.symbol] = {
          symbol: price.symbol,
          currentPrice: null,
          priceChanges: 0,
          firstSet: null,
          lastSet: null,
        };
      }

      symbolSummary[price.symbol].priceChanges++;

      if (price.isActive) {
        symbolSummary[price.symbol].currentPrice = price.adminPrice;
      }

      if (
        !symbolSummary[price.symbol].firstSet ||
        price.createdAt < symbolSummary[price.symbol].firstSet
      ) {
        symbolSummary[price.symbol].firstSet = price.createdAt;
      }

      if (
        !symbolSummary[price.symbol].lastSet ||
        price.createdAt > symbolSummary[price.symbol].lastSet
      ) {
        symbolSummary[price.symbol].lastSet = price.createdAt;
      }
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          priceHistory,
          symbolSummary: Object.values(symbolSummary),
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
            hasNext: page * limit < total,
            hasPrev: page > 1,
          },
        },
      },
      {
        status: 200,
        headers: corsHeaders(request),
      },
    );
  } catch (error) {
    console.error("Get price history error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch price history",
        details: error.message,
      },
      {
        status: 500,
        headers: corsHeaders(request),
      },
    );
  }
});
