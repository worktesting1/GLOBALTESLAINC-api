import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import PaymentMethod from "@/models/PaymentMethod";
import { corsHeaders, handleOptions } from "@/lib/cors";

export async function OPTIONS(request) {
  return handleOptions(request);
}

// GET /api/payment-methods - Get all active payment methods
export async function GET(request) {
  try {
    await dbConnect();

    const paymentMethods = await PaymentMethod.find({ isActive: true }).lean();

    return NextResponse.json(
      {
        success: true,
        data: paymentMethods,
      },
      { status: 200, headers: corsHeaders(request) },
    );
  } catch (error) {
    console.error("Get payment methods error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to get payment methods",
      },
      { status: 500, headers: corsHeaders(request) },
    );
  }
}
