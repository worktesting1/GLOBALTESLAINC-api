// app/api/cars/[id]/route.js - Ensure CORS headers are set
import { NextResponse } from "next/server";
import dbConnect from "../../../../lib/mongodb";
import Car from "../../../../models/Car";
import { corsHeaders } from "../../../../lib/cors";

export async function OPTIONS(request) {
  return new Response(null, {
    status: 200,
    headers: corsHeaders(request),
  });
}

export async function GET(request, { params }) {
  try {
    await dbConnect();

    // Unwrap params if it's a Promise
    const { id } = await params;

    const car = await Car.findById(id).lean();

    if (!car) {
      return NextResponse.json(
        {
          success: false,
          error: "Car not found",
        },
        {
          status: 404,
          headers: corsHeaders(request),
        },
      );
    }

    // Increment views
    await Car.findByIdAndUpdate(id, { $inc: { views: 1 } });

    return NextResponse.json(
      {
        success: true,
        data: {
          ...car,
          formattedPrice: new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 0,
          }).format(car.price),
        },
      },
      {
        status: 200,
        headers: corsHeaders(request),
      },
    );
  } catch (error) {
    console.error("Get car error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch car",
        details: error.message,
      },
      {
        status: 500,
        headers: corsHeaders(request),
      },
    );
  }
}
