import { NextResponse } from "next/server";
import dbConnect from "../../../../lib/mongodb";
import Holding from "../../../../models/Holding";
import { withAdmin } from "../../../../lib/apiHander";
import { corsHeaders, handleOptions } from "../../../../lib/cors";

export async function OPTIONS(request) {
  return handleOptions(request);
}

export const GET = withAdmin(async (request) => {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);

    // Get query parameters
    const userId = searchParams.get("userId");
    const symbol = searchParams.get("symbol");

    // Build simple query
    const query = {};
    if (userId) query.userId = userId;
    if (symbol) query.symbol = symbol.toUpperCase();

    // Get holdings
    const holdings = await Holding.find(query).sort({ updatedAt: -1 }).lean();

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
    console.error("Admin get holdings error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch holdings",
      },
      {
        status: 500,
        headers: corsHeaders(request),
      },
    );
  }
});
