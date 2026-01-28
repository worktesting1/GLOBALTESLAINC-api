// app/api/checkout/[id]/route.js - FINAL FIXED VERSION
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Order from "@/models/Order";
import Car from "@/models/Car";
import PaymentMethod from "@/models/PaymentMethod";
import { validateCheckout } from "@/middleware/validateorder";
import { corsHeaders, handleOptions } from "@/lib/cors";
import crypto from "crypto";

export async function OPTIONS(request) {
  return handleOptions(request);
}

// POST /api/checkout/[id] - SIMPLE NO-AUTH CHECKOUT
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

    // Get payment method - FIXED VERSION
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

    // Create order
    const orderId = `ORD-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    // Crypto conversion rates (simplified - use real API in production)
    const cryptoRates = {
      BTC: 90000, // Current BTC price
      DOGE: 0.13, // Current DOGE price
      LTC: 70, // Current LTC price
      USDT: 1, // 1:1 with USD
      USDC: 1, // 1:1 with USD
    };

    const cryptoAmount = car.price / (cryptoRates[paymentMethod.code] || 1);
    const guestUserId = `guest_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

    const order = new Order({
      orderId,
      carId: car._id,
      status: "pending",
      paymentMethod: paymentMethod.name,
      paymentMethodCode: paymentMethod.code, // Store code separately
      paymentCurrency: paymentMethod.code,
      amount: car.price,
      cryptoAmount: parseFloat(cryptoAmount.toFixed(8)), // 8 decimal places for crypto
      walletAddress: paymentMethod.walletAddress,
      expiresAt,
      userId: guestUserId,
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
          cryptoAmount: order.cryptoAmount,
          currency: order.paymentCurrency,
          redirectUrl: `/checkout/${order.orderId}/payment`,
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
};
