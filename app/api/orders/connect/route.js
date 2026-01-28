// app/api/orders/connect/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Order from "@/models/Order";
import { corsHeaders, handleOptions } from "@/lib/cors";
import jwt from "jsonwebtoken";

export async function OPTIONS(request) {
  return handleOptions(request);
}

export async function POST(request) {
  try {
    await dbConnect();

    // 1. Get token from headers
    const token = request.headers.get("token");

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required. Please login first.",
        },
        { status: 401, headers: corsHeaders(request) },
      );
    }

    // 2. Verify JWT token and get user ID
    let userId;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SEC);
      userId = decoded.id; // This should match your JWT payload structure

      if (!userId) {
        throw new Error("User ID not found in token");
      }
    } catch (error) {
      console.error("Token verification error:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Invalid or expired token. Please login again.",
        },
        { status: 401, headers: corsHeaders(request) },
      );
    }

    // 3. Get guestId from request body
    const { guestId } = await request.json();

    if (!guestId) {
      return NextResponse.json(
        {
          success: false,
          error: "guestId is required",
        },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    // 4. Validate guestId format
    if (!guestId.startsWith("guest_")) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid guestId format",
        },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    console.log(`🔗 Connecting orders from guest:${guestId} to user:${userId}`);

    // 5. Find all orders with this guestId
    const guestOrders = await Order.find({
      userId: guestId,
    }).select("orderId status amount carId createdAt");

    console.log(`📊 Found ${guestOrders.length} guest orders`);

    if (guestOrders.length === 0) {
      return NextResponse.json(
        {
          success: true,
          message: "No guest orders found to connect",
          data: {
            connectedCount: 0,
            userId,
            guestId,
            connectedOrders: [],
          },
        },
        { status: 200, headers: corsHeaders(request) },
      );
    }

    // 6. Update all guest orders to user's ID
    const result = await Order.updateMany(
      {
        userId: guestId,
      },
      {
        $set: {
          userId: userId,
          isGuestOrder: false,
          connectedAt: new Date(),
        },
      },
    );

    console.log(
      `✅ Connected ${result.modifiedCount} orders to user ${userId}`,
    );

    // 7. Get the updated orders
    const connectedOrders = await Order.find({
      userId: userId,
      connectedAt: { $exists: true },
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .select("orderId status amount carId createdAt")
      .lean();

    return NextResponse.json(
      {
        success: true,
        message: "Orders connected successfully",
        data: {
          connectedCount: result.modifiedCount,
          userId,
          guestId,
          connectedOrders,
          note: "These orders are now permanently associated with your account",
        },
      },
      { status: 200, headers: corsHeaders(request) },
    );
  } catch (error) {
    console.error("❌ Connect orders error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to connect orders",
      },
      { status: 500, headers: corsHeaders(request) },
    );
  }
}
