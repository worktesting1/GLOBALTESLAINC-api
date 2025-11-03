import { NextResponse } from "next/server";
import dbConnect from "../../../../lib/mongodb";
import FundingRequest from "../../../../models/FundingRequest";
import Wallet from "../../../../models/Wallet";
import { withAuth, withAdmin } from "../../../../lib/apiHander";

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

// POST handler - Submit and manage funding requests
export async function POST(request, { params }) {
  try {
    const { route } = await params;
    const headers = getCorsHeaders(request);
    await dbConnect();

    if (!route || route.length === 0) {
      return NextResponse.json(
        { error: "Endpoint not found" },
        { status: 404, headers }
      );
    }

    const [action, requestId] = route;
    const body = await request.json();

    switch (action) {
      case "request":
        return await withAuth(handleSubmitFundingRequest)(
          request,
          headers,
          body
        );
      case "approve":
        return await withAdmin(handleApproveFundingRequest)(
          request,
          headers,
          requestId
        );
      case "reject":
        return await withAdmin(handleRejectFundingRequest)(
          request,
          headers,
          requestId
        );
      default:
        return NextResponse.json(
          { error: "Endpoint not found" },
          { status: 404, headers }
        );
    }
  } catch (error) {
    console.error("Funding POST API Error:", error);
    const headers = getCorsHeaders(request);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers }
    );
  }
}

// GET handler - Get funding requests
export async function GET(request, { params }) {
  try {
    const { route } = await params;
    const headers = getCorsHeaders(request);
    await dbConnect();

    if (!route || route.length === 0) {
      return NextResponse.json(
        { error: "Endpoint not found" },
        { status: 404, headers }
      );
    }

    const [action] = route;

    switch (action) {
      case "pending":
        return await withAdmin(handleGetPendingRequests)(request, headers);
      default:
        return NextResponse.json(
          { error: "Endpoint not found" },
          { status: 404, headers }
        );
    }
  } catch (error) {
    console.error("Funding GET API Error:", error);
    const headers = getCorsHeaders(request);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers }
    );
  }
}

// Handler functions
async function handleSubmitFundingRequest(req, headers, body) {
  try {
    const { userId, currency, amount, transactionType, name, email, image } =
      body;

    // Validate required fields
    if (
      !userId ||
      !currency ||
      !amount ||
      !transactionType ||
      !name ||
      !email
    ) {
      return NextResponse.json(
        {
          error: "Missing required fields",
        },
        { status: 400, headers }
      );
    }

    // Generate reference number
    const referenceNumber = generateReferenceNumber();

    // Create funding request
    const request = new FundingRequest({
      userId,
      currency,
      amount,
      transactionType,
      name,
      email,
      image: image || [],
      referenceNumber,
    });

    await request.save();

    return NextResponse.json(
      {
        success: true,
        message: "Funding request submitted for admin approval",
        requestId: request._id,
        status: "pending",
      },
      { status: 201, headers }
    );
  } catch (error) {
    console.error("Submit funding request error:", error);
    return NextResponse.json(
      {
        error: "Failed to submit funding request",
        details: error.message,
      },
      { status: 500, headers }
    );
  }
}

async function handleApproveFundingRequest(req, headers, requestId) {
  try {
    const request = await FundingRequest.findById(requestId);

    if (!request) {
      return NextResponse.json(
        { error: "Request not found" },
        { status: 404, headers }
      );
    }

    if (request.status !== "pending") {
      return NextResponse.json(
        { error: "Request already processed" },
        { status: 400, headers }
      );
    }

    // Update wallet balance
    const wallet = await Wallet.findOne({ userId: request.userId });
    if (!wallet) {
      return NextResponse.json(
        { error: "Wallet not found" },
        { status: 404, headers }
      );
    }

    // Add amount to wallet balance
    wallet.balanceUSD += request.amount;
    await wallet.save();

    // Update request status
    request.status = "approved";
    request.approvedAt = new Date();
    // Note: You might want to store admin ID from req.userId if available
    await request.save();

    return NextResponse.json(
      {
        success: true,
        message: "Funding request approved",
        newBalance: wallet.balanceUSD,
      },
      { status: 200, headers }
    );
  } catch (error) {
    console.error("Approve funding request error:", error);
    return NextResponse.json(
      {
        error: "Failed to approve funding",
        details: error.message,
      },
      { status: 500, headers }
    );
  }
}

async function handleRejectFundingRequest(req, headers, requestId) {
  try {
    const request = await FundingRequest.findByIdAndUpdate(
      requestId,
      {
        status: "reject", // Note: Your schema uses "reject" not "rejected"
        approvedAt: new Date(),
        // Note: You might want to store admin ID from req.userId if available
      },
      { new: true }
    );

    if (!request) {
      return NextResponse.json(
        { error: "Request not found" },
        { status: 404, headers }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Funding request rejected",
      },
      { status: 200, headers }
    );
  } catch (error) {
    console.error("Reject funding request error:", error);
    return NextResponse.json(
      {
        error: "Failed to reject funding",
        details: error.message,
      },
      { status: 500, headers }
    );
  }
}

async function handleGetPendingRequests(req, headers) {
  try {
    const requests = await FundingRequest.find({ status: "pending" });
    // Note: If you want to populate user data, you'll need to adjust based on your User model

    return NextResponse.json(
      {
        success: true,
        requests,
      },
      { status: 200, headers }
    );
  } catch (error) {
    console.error("Get pending requests error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch pending requests",
        details: error.message,
      },
      { status: 500, headers }
    );
  }
}

// Helper function to generate reference number
function generateReferenceNumber() {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let referenceNumber = "";
  for (let i = 0; i < 20; i++) {
    referenceNumber += characters.charAt(
      Math.floor(Math.random() * characters.length)
    );
  }
  return referenceNumber;
}
