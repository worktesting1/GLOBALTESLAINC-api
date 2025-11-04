import { NextResponse } from "next/server";
import dbConnect from "../../../../../../lib/mongodb";
import Kyc from "../../../../../../models/Kyc";
import { withAuth } from "../../../../../../lib/apiHander";
import { corsHeaders, handleOptions } from "../../../../../lib/cors";

export async function OPTIONS(request) {
  return handleOptions(request);
}

export async function GET(request, { params }) {
  try {
    const { userId } = await params;
    await dbConnect();
    return await withAuth(handleGetMyKyc)(
      request,
      corsHeaders(request),
      userId
    );
  } catch (error) {
    console.error("MyKYC GET API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders(request) }
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
