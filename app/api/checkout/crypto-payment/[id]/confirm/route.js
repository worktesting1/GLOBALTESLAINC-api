// app/api/checkout/crypto-payment/[id]/confirm/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Order from "@/models/Order";
import { validatePaymentConfirmation } from "@/middleware/validateorder";
import { corsHeaders, handleOptions } from "@/lib/cors";

export async function OPTIONS(request) {
  return handleOptions(request);
}

export const POST = async (request, { params }) => {
  try {
    await dbConnect();

    // ✅ AWAIT params
    const { id } = await params;
    const body = await request.json();

    // Validate
    const validation = validatePaymentConfirmation(body);
    if (!validation.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          errors: validation.errors,
        },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    // Find order by orderId (not _id)
    const order = await Order.findOne({ orderId: id });

    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404, headers: corsHeaders(request) },
      );
    }

    // Check if order can be confirmed
    if (order.status !== "pending") {
      return NextResponse.json(
        {
          success: false,
          error: `Order is ${order.status}. Cannot confirm payment.`,
        },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    if (order.expiresAt < new Date()) {
      order.status = "expired";
      await order.save();
      return NextResponse.json(
        { success: false, error: "Payment session has expired" },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    // Update order
    order.status = "paid";
    order.transactionHash = body.transaction_hash;
    order.paidAt = new Date();
    order.confirmedAt = new Date();
    await order.save();

    return NextResponse.json(
      {
        success: true,
        message: "Payment confirmed successfully",
        data: {
          orderId: order.orderId,
          status: order.status,
          confirmedAt: order.confirmedAt,
          redirectUrl: `/checkout/${order.orderId}/confirmation`,
        },
      },
      { status: 200, headers: corsHeaders(request) },
    );
  } catch (error) {
    console.error("Payment confirmation error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to confirm payment",
      },
      { status: 500, headers: corsHeaders(request) },
    );
  }
};
