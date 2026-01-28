import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { OrderService } from "@/middleware/orderServices";
import { corsHeaders, handleOptions } from "@/lib/cors";
import { withAuth } from "@/lib/apiHander";

export async function OPTIONS(request) {
  return handleOptions(request);
}

// GET /api/orders - Get user's orders
export const GET = withAuth(async (request) => {
  try {
    await dbConnect();

    const userId = request.userId;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");

    const result = await OrderService.getUserOrders(userId, page, limit);

    return NextResponse.json(
      {
        success: true,
        data: result.orders,
        pagination: result.pagination,
      },
      { status: 200, headers: corsHeaders(request) },
    );
  } catch (error) {
    console.error("Get orders error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to get orders",
      },
      { status: 500, headers: corsHeaders(request) },
    );
  }
});
