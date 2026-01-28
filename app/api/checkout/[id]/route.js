// app/api/checkout/[id]/route.js - UPDATED VERSION WITH AUTH SUPPORT
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Order from "@/models/Order";
import Car from "@/models/Car";
import PaymentMethod from "@/models/PaymentMethod";
import { validateCheckout } from "@/middleware/validateorder";
import { corsHeaders, handleOptions } from "@/lib/cors";
import crypto from "crypto";
import jwt from "jsonwebtoken";

export async function OPTIONS(request) {
  return handleOptions(request);
}

// POST /api/checkout/[id] - WITH AUTH SUPPORT
export const POST = async (request, { params }) => {
  try {
    await dbConnect();

    const { id } = await params; // Car ID
    const body = await request.json();

    // Validate
    const checkoutData = { ...body, car_id: id };
    const validation = validateCheckout(checkoutData);
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

    // Get car
    const car = await Car.findById(id);
    if (!car) {
      return NextResponse.json(
        { success: false, error: "Car not found" },
        { status: 404, headers: corsHeaders(request) },
      );
    }

    // Get payment method
    const paymentMethodId = checkoutData.payment_method_id;

    if (!paymentMethodId) {
      return NextResponse.json(
        { success: false, error: "Payment method is required" },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    let paymentMethod;

    // Check if it's a valid MongoDB ObjectId (24 hex characters)
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(paymentMethodId);

    if (isObjectId) {
      // Search by ID
      paymentMethod = await PaymentMethod.findById(paymentMethodId);
    } else {
      // Search by code (uppercase for consistency)
      const code = paymentMethodId.toUpperCase();
      paymentMethod = await PaymentMethod.findOne({
        code: code,
        isActive: true,
      });

      // If not found by exact code, try case-insensitive
      if (!paymentMethod) {
        paymentMethod = await PaymentMethod.findOne({
          $or: [
            { code: { $regex: new RegExp(`^${code}$`, "i") } },
            { name: { $regex: new RegExp(`^${code}$`, "i") } },
          ],
          isActive: true,
        });
      }
    }

    if (!paymentMethod) {
      return NextResponse.json(
        {
          success: false,
          error: `Payment method "${paymentMethodId}" not available`,
        },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    if (!paymentMethod.isActive) {
      return NextResponse.json(
        {
          success: false,
          error: `Payment method "${paymentMethod.name}" is not currently available`,
        },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    // 1. Check if user is logged in
    const token = request.headers.get("token");
    let userId;
    let isGuest = true;
    let guestSessionId = null;

    if (token) {
      try {
        // Verify token and get user ID
        const decoded = jwt.verify(token, process.env.JWT_SEC);
        userId = decoded.id;
        isGuest = false; // User is logged in

        console.log(`✅ User logged in: ${userId}`);
      } catch (error) {
        console.log("⚠️ Invalid token, proceeding as guest:", error.message);
        // Token is invalid, proceed as guest
      }
    }

    // 2. Determine user ID for order
    if (!userId) {
      // User is guest - use provided guestId or generate new one
      if (body.guestId && body.guestId.startsWith("guest_")) {
        userId = body.guestId;
        guestSessionId = body.guestId;
        console.log(`👤 Using provided guest ID: ${userId}`);
      } else {
        // Generate new guest ID
        userId = `guest_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
        guestSessionId = userId;
        console.log(`👤 Generated new guest ID: ${userId}`);
      }
    }

    // Create order
    const orderId = `ORD-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    // Crypto conversion rates
    const cryptoRates = {
      BTC: 90000,
      DOGE: 0.13,
      LTC: 70,
      USDT: 1,
      USDC: 1,
    };

    const cryptoAmount = car.price / (cryptoRates[paymentMethod.code] || 1);

    const order = new Order({
      orderId,
      carId: car._id,
      status: "pending",
      paymentMethod: paymentMethod.name,
      paymentMethodCode: paymentMethod.code,
      paymentCurrency: paymentMethod.code,
      amount: car.price,
      cryptoAmount: parseFloat(cryptoAmount.toFixed(8)),
      walletAddress: paymentMethod.walletAddress,
      expiresAt,
      userId: userId, // Use determined userId
      isGuestOrder: isGuest, // True if guest, false if logged in
      guestSessionId: guestSessionId, // Store original guest ID if guest
      billingInfo: {
        name: checkoutData.billing_name,
        email: checkoutData.billing_email,
        phone: checkoutData.billing_phone,
        company: checkoutData.company_name || "",
        address: checkoutData.billing_address,
        city: checkoutData.billing_city,
        state: checkoutData.billing_state,
        postalCode: checkoutData.billing_postal_code,
        country: checkoutData.billing_country,
        taxId: checkoutData.tax_id || "",
      },
      items: [
        {
          name: car.name,
          quantity: 1,
          price: car.price,
          total: car.price,
        },
      ],
    });

    await order.save();
    console.log(
      `✅ Order created: ${orderId} for user: ${userId} (${isGuest ? "guest" : "logged-in"})`,
    );

    // Prepare response data
    const responseData = {
      success: true,
      message: "Order created successfully",
      data: {
        orderId: order.orderId,
        status: order.status,
        expiresAt: order.expiresAt,
        amount: order.amount,
        paymentMethod: order.paymentMethod,
        cryptoAmount: order.cryptoAmount,
        currency: order.paymentCurrency,
        redirectUrl: `/checkout/${order.orderId}/payment`,
        isGuest: isGuest,
        // Return guestId to frontend if it's a guest order
        ...(isGuest && { guestId: userId }),
      },
    };

    return NextResponse.json(responseData, {
      status: 201,
      headers: corsHeaders(request),
    });
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
};
