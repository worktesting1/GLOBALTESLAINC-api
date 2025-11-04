import { NextResponse } from "next/server";
import dbConnect from "../../../../../../lib/mongodb";
import Kyc from "../../../../../../models/Kyc";
import { withAuth } from "../../../../../../lib/apiHander";

function getCorsHeaders() {
  return {
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, token, x-requested-with",
    "Access-Control-Allow-Origin": "http://localhost:3001",
    "Access-Control-Allow-Credentials": "true",
    "Content-Type": "application/json",
  };
}

export async function OPTIONS() {
  const headers = getCorsHeaders();
  return new NextResponse(null, {
    status: 200,
    headers: {
      ...headers,
      "Access-Control-Max-Age": "86400",
    },
  });
}

export async function GET(request, { params }) {
  try {
    const { userId } = await params;
    await dbConnect();
    return await withAuth(handleGetMyKyc)(request, getCorsHeaders(), userId);
  } catch (error) {
    console.error("MyKYC GET API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

async function handleGetMyKyc(req, headers, userId) {
  try {
    const kyc = await Kyc.findOne({ userId });

    if (!kyc) {
      return NextResponse.json(
        { error: "No KYC Documents found" },
        { status: 404, headers }
      );
    }

    return NextResponse.json(
      {
        success: true,
        kyc,
      },
      { status: 200, headers }
    );
  } catch (error) {
    console.error("Get my KYC error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch KYC details",
        details: error.message,
      },
      { status: 500, headers }
    );
  }
}
