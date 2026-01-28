// app/api/orders/track/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Order from "@/models/Order";
import { corsHeaders, handleOptions } from "@/lib/cors";

export async function OPTIONS(request) {
  return handleOptions(request);
}

export async function POST(request) {
  try {
    await dbConnect();

    const { orderId, email } = await request.json();

    if (!orderId || !email) {
      return NextResponse.json(
        { success: false, error: "Order ID and email are required" },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    const order = await Order.findOne({
      orderId,
      "billingInfo.email": email.toLowerCase().trim(),
    }).populate("carId", "name images price");

    if (!order) {
      return NextResponse.json(
        {
          success: false,
          error: "Order not found. Please check your details.",
        },
        { status: 404, headers: corsHeaders(request) },
      );
    }

    const orderData = {
      orderId: order.orderId,
      status: order.status,
      amount: order.amount,
      currency: order.paymentCurrency,
      paymentMethod: order.paymentMethod,
      createdAt: order.createdAt,
      expiresAt: order.expiresAt,
      car: order.carId,
      billingInfo: {
        name: order.billingInfo.name,
        email: order.billingInfo.email,
      },
    };

    return NextResponse.json(
      { success: true, data: orderData },
      { status: 200, headers: corsHeaders(request) },
    );
  } catch (error) {
    console.error("Track order error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to track order" },
      { status: 500, headers: corsHeaders(request) },
    );
  }
}
