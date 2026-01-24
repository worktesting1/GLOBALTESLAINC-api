import { NextResponse } from "next/server";
import dbConnect from "../../../../../lib/mongodb";
import Holding from "../../../../../models/Holding";
import { withAdmin } from "../../../../../lib/apiHander";
import { corsHeaders, handleOptions } from "../../../../../lib/cors";

export async function OPTIONS(request) {
  return handleOptions(request);
}

export const POST = withAdmin(async (request) => {
  try {
    await dbConnect();

    const body = await request.json();
    const { holdingId, quantity, price } = body;

    // Validate input
    if (!holdingId) {
      return NextResponse.json(
        { error: "holdingId is required" },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    // Find the holding
    const holding = await Holding.findById(holdingId);
    if (!holding) {
      return NextResponse.json(
        { error: "Holding not found" },
        { status: 404, headers: corsHeaders(request) },
      );
    }

    // Update fields if provided
    if (quantity !== undefined) {
      holding.quantity = quantity;
      holding.totalInvested = quantity * holding.avgPurchasePrice;
    }

    if (price !== undefined) {
      // Update average purchase price
      holding.avgPurchasePrice = price;
      holding.totalInvested = holding.quantity * price;
    }

    await holding.save();

    return NextResponse.json(
      {
        success: true,
        message: "Holding updated successfully",
        data: holding,
      },
      {
        status: 200,
        headers: corsHeaders(request),
      },
    );
  } catch (error) {
    console.error("Admin update holding error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update holding",
      },
      {
        status: 500,
        headers: corsHeaders(request),
      },
    );
  }
});
