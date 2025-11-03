import { NextResponse } from "next/server";
import dbConnect from "../../../../lib/mongodb";
import Withdrawal from "../../../../models/Withdrawal";
import { withAdmin } from "../../../../lib/apiHander";

// CORS headers helper
function getCorsHeaders(request) {
  const origin = request.headers.get("origin") || "";
  const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
  ];

  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, token, x-requested-with",
  };

  if (allowedOrigins.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  } else {
    headers["Access-Control-Allow-Origin"] = "*";
  }

  return headers;
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS(request) {
  const headers = getCorsHeaders(request);
  return new NextResponse(null, {
    status: 200,
    headers: {
      ...headers,
      "Access-Control-Max-Age": "86400",
    },
  });
}

// GET handler - Get all withdrawals
export async function GET(request, { params }) {
  try {
    const { route } = await params;
    const headers = getCorsHeaders(request);
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
    const headers = getCorsHeaders(request);
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
