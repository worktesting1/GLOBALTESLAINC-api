import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { OrderService } from "@/middleware/orderServices";
import { corsHeaders, handleOptions } from "@/lib/cors";

export async function OPTIONS(request) {
  return handleOptions(request);
}

// GET /api/orders/[id] - Get specific order (NO AUTH REQUIRED)
export const GET = async (request, { params }) => {
  try {
    await dbConnect();

    // FIX: Add "await" here!
    const { id } = await params; // ✅ Add await

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Order ID is required" },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    // Remove userId parameter since no auth required
    const order = await OrderService.getOrderById(id); // Updated call

    // If you need to modify the OrderService to work without userId:
    // Option 1: Check if your OrderService can handle no userId
    // Option 2: Create a public version of getOrderById

    // If OrderService.getOrderById requires userId, you might need:
    // const order = await Order.findOne({ orderId: id });

    return NextResponse.json(
      {
        success: true,
        data: order,
      },
      { status: 200, headers: corsHeaders(request) },
    );
  } catch (error) {
    console.error("Get order error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to get order",
      },
      { status: 404, headers: corsHeaders(request) },
    );
  }
};

// DELETE /api/orders/[id] - Cancel order (STILL NEEDS AUTH)
// export const DELETE = async (request, { params }) => {
//   // Keep DELETE protected or remove it entirely if not needed
//   return NextResponse.json(
//     { success: false, error: "Authentication required to cancel orders" },
//     { status: 401, headers: corsHeaders(request) },
//   );
// };
