// app/api/orders/[id]/payment/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Order from "@/models/Order";
import { corsHeaders, handleOptions } from "@/lib/cors";

export async function OPTIONS(request) {
  return handleOptions(request);
}

// GET /api/orders/[id]/payment - Get payment details
export async function GET(request, { params }) {
  try {
    await dbConnect();

    // AWAIT THE PARAMS
    const { id } = await params; // Order ID - await the params!

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Order ID is required" },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    // Find order
    const order = await Order.findOne({ orderId: id }).populate(
      "carId",
      "name price images",
    );

    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404, headers: corsHeaders(request) },
      );
    }

    if (order.status !== "pending") {
      return NextResponse.json(
        {
          success: false,
          error: "Order is not in pending state",
        },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    if (order.expiresAt < new Date()) {
      await Order.findByIdAndUpdate(order._id, { status: "expired" });
      return NextResponse.json(
        {
          success: false,
          error: "Payment session has expired",
        },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    // Calculate time remaining
    const timeLeft = Math.floor((order.expiresAt - new Date()) / 1000);
    const progressPercentage = Math.max(
      0,
      Math.min(100, (timeLeft / (30 * 60)) * 100),
    );

    // Generate QR code URL if crypto payment
    let qrCodeUrl = null;
    if (
      order.paymentCurrency === "USDT" &&
      order.walletAddress &&
      order.cryptoAmount
    ) {
      qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&format=png&data=${encodeURIComponent(`usdt:${order.walletAddress}?amount=${order.cryptoAmount}`)}`;
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          orderId: order.orderId,
          amount: order.amount,
          cryptoAmount: order.cryptoAmount,
          currency: order.paymentCurrency,
          walletAddress: order.walletAddress,
          expiresAt: order.expiresAt,
          paymentMethod: order.paymentMethod,
          timeLeft: timeLeft,
          progressPercentage: progressPercentage,
          qrCodeUrl: qrCodeUrl,
          car: order.carId,
        },
      },
      { status: 200, headers: corsHeaders(request) },
    );
  } catch (error) {
    console.error("Payment details error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to get payment details",
      },
      { status: 500, headers: corsHeaders(request) },
    );
  }
}
