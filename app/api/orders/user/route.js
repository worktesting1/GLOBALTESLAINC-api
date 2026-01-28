// app/api/orders/user/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Order from "@/models/Order";
import { corsHeaders, handleOptions } from "@/lib/cors";
import { withAuth } from "@/lib/apiHander";

export async function OPTIONS(request) {
  return handleOptions(request);
}

// Use the withAuth middleware
const handler = async (request) => {
  try {
    await dbConnect();

    // Get user ID from request (set by withAuth middleware)
    const userId = request.userId;

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: "User ID not found",
        },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");
    const page = parseInt(searchParams.get("page") || "1");
    const skip = (page - 1) * limit;

    // Build query - get orders for this user
    const query = { userId };

    if (status && status !== "all") {
      query.status = status;
    }

    // Fetch orders
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("-__v")
      .lean();

    // Get total count
    const totalOrders = await Order.countDocuments(query);

    // Return response
    return NextResponse.json(
      {
        success: true,
        data: {
          orders,
          pagination: {
            total: totalOrders,
            page,
            limit,
            pages: Math.ceil(totalOrders / limit),
          },
          userId,
        },
      },
      { status: 200, headers: corsHeaders(request) },
    );
  } catch (error) {
    console.error("Get user orders error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch orders",
      },
      { status: 500, headers: corsHeaders(request) },
    );
  }
};

// Export with auth middleware
export const GET = withAuth(handler);
