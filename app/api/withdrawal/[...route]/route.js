import { NextResponse } from "next/server";
import dbConnect from "../../../../lib/mongodb";
import Withdrawal from "../../../../models/Withdrawal";
import { withAdmin } from "../../../../lib/apiHander";

import { corsHeaders, handleOptions } from "../../../../lib/cors";

export async function OPTIONS(request) {
  return handleOptions(request);
}

// GET handler - Get all withdrawals
export async function GET(request, { params }) {
  try {
    const { route } = await params;
    const headers = corsHeaders(request);
    await dbConnect();

    // Handle /api/withdrawal (get all withdrawals)
    if (!route || route.length === 0) {
      return await withAdmin(handleGetAllWithdrawals)(request, headers);
    }

    return NextResponse.json(
      { error: "Endpoint not found" },
      { status: 404, headers }
    );
  } catch (error) {
    console.error("Withdrawal GET API Error:", error);
    const headers = corsHeaders(request);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers }
    );
  }
}

// Handler function
async function handleGetAllWithdrawals(req, headers) {
  try {
    const withdrawals = await Withdrawal.find();

    return NextResponse.json({ withdrawals }, { status: 200, headers });
  } catch (error) {
    console.error("Get all withdrawals error:", error);
    return NextResponse.json(
      { error: "Failed to fetch withdrawals" },
      { status: 500, headers }
    );
  }
}
