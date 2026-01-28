import { NextResponse } from "next/server";
import dbConnect from "../../../lib/mongodb";
import { OrderService } from "../../../middleware/orderServices";
import { validateCheckout } from "../../../middleware/validateorder";
import { corsHeaders, handleOptions } from "../../../lib/cors";
import { withAuth } from "../../../lib/apiHander";

export async function OPTIONS(request) {
  return handleOptions(request);
}

// POST /api/checkout - Create new order
export const POST = withAuth(async (request) => {
  try {
    await dbConnect();

    const body = await request.json();
    const userId = request.userId;

    // Validate checkout data
    const validation = validateCheckout(body);
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

    // Create order
    const order = await OrderService.createOrder(userId, body);

    return NextResponse.json(
      {
        success: true,
        message: "Order created successfully",
        data: {
          orderId: order.orderId,
          status: order.status,
          expiresAt: order.expiresAt,
          amount: order.amount,
          paymentMethod: order.paymentMethod,
        },
      },
      { status: 201, headers: corsHeaders(request) },
    );
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to create order",
      },
      { status: 500, headers: corsHeaders(request) },
    );
  }
});
