import { NextResponse } from "next/server";
import { seedInvestmentPlans } from "@/lib/seedInvestmentPlans";
import { corsHeaders, handleOptions } from "@/lib/cors";

// Handle CORS preflight
export async function OPTIONS(request) {
  return handleOptions(request);
}

// POST to seed database with sample data
export async function POST(request) {
  try {
    const result = await seedInvestmentPlans();

    if (result.success) {
      return NextResponse.json(result, {
        status: 201,
        headers: corsHeaders(request),
      });
    } else {
      return NextResponse.json(result, {
        status: 500,
        headers: corsHeaders(request),
      });
    }
  } catch (error) {
    console.error("Error in seed route:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to seed database",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      },
      {
        status: 500,
        headers: corsHeaders(request),
      },
    );
  }
}
