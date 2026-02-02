import { NextResponse } from "next/server";
import dbConnect from "../../../../../lib/mongodb";
import Kyc from "../../../../../models/Kyc";
import { withAuth } from "../../../../../lib/apiHander";
import { corsHeaders, handleOptions } from "../../../../../lib/cors";

export async function OPTIONS(request) {
  return handleOptions(request);
}

// ❌ Remove any console.log statements like this:
// console.log(params);  // BAD - causes error
// const { userId } = params;  // BAD - causes error

export async function GET(request, { params }) {
  try {
    // ✅ CORRECT - Await params first
    const { userId } = await params;
    console.log("API Route - UserId extracted:", userId);

    if (!userId) {
      const headers = corsHeaders(request);
      return NextResponse.json(
        { error: "User ID parameter is missing" },
        { status: 400, headers },
      );
    }

    const headers = corsHeaders(request);
    await dbConnect();

    return await withAuth(handleGetMyKyc)(request, headers, userId);
  } catch (error) {
    console.error("My KYC GET API Error:", error);
    const headers = corsHeaders(request);
    return NextResponse.json(
      { error: "Internal server error: " + error.message },
      { status: 500, headers },
    );
  }
}

async function handleGetMyKyc(req, headers, userId) {
  try {
    const kyc = await Kyc.findOne({ userId });

    if (!kyc) {
      return NextResponse.json(
        { error: "No KYC Documents found" },
        { status: 404, headers },
      );
    }

    return NextResponse.json(
      {
        success: true,
        kyc,
      },
      { status: 200, headers },
    );
  } catch (error) {
    console.error("Get my KYC error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch KYC details",
        details: error.message,
      },
      { status: 500, headers },
    );
  }
}
