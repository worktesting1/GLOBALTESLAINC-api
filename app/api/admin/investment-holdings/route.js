// app/api/admin/investment-holdings/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import InvestmentHolding from "@/models/InvestmentHolding";
import { withAdmin } from "@/lib/apiHander";
import { corsHeaders, handleOptions } from "@/lib/cors";

export async function OPTIONS(request) {
  return handleOptions(request);
}

export const GET = withAdmin(async (request) => {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);

    // Get query parameters
    const userId = searchParams.get("userId");
    const planId = searchParams.get("planId");

    // Build simple query
    const query = {};
    if (userId) query.userId = userId;
    if (planId) query.planId = planId;

    // Get investment holdings
    const holdings = await InvestmentHolding.find(query)
      .sort({ updatedAt: -1 })
      .lean();

    // Return simple response
    return NextResponse.json(
      {
        success: true,
        data: holdings,
        count: holdings.length,
      },
      {
        status: 200,
        headers: corsHeaders(request),
      },
    );
  } catch (error) {
    console.error("Admin get investment holdings error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch investment holdings",
      },
      {
        status: 500,
        headers: corsHeaders(request),
      },
    );
  }
});

export const POST = withAdmin(async (request) => {
  try {
    await dbConnect();

    const body = await request.json();
    const { holdingId, units, avgPurchasePrice } = body;

    // Validate input
    if (!holdingId) {
      return NextResponse.json(
        { error: "holdingId is required" },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    // Find the holding
    const holding = await InvestmentHolding.findById(holdingId);
    if (!holding) {
      return NextResponse.json(
        { error: "Investment holding not found" },
        { status: 404, headers: corsHeaders(request) },
      );
    }

    // Update fields if provided
    if (units !== undefined) {
      holding.units = units;
      holding.totalInvested = units * holding.avgPurchasePrice;
    }

    if (avgPurchasePrice !== undefined) {
      // Update average purchase price
      holding.avgPurchasePrice = avgPurchasePrice;
      holding.totalInvested = holding.units * avgPurchasePrice;
    }

    await holding.save();

    return NextResponse.json(
      {
        success: true,
        message: "Investment holding updated successfully",
        data: holding,
      },
      {
        status: 200,
        headers: corsHeaders(request),
      },
    );
  } catch (error) {
    console.error("Admin update investment holding error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update investment holding",
      },
      {
        status: 500,
        headers: corsHeaders(request),
      },
    );
  }
});
