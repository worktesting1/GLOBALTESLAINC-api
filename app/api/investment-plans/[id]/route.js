import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import InvestmentPlan from "@/models/InvestmentPlan";
import { corsHeaders, handleOptions } from "@/lib/cors";

// Handle CORS preflight
export async function OPTIONS(request) {
  return handleOptions(request);
}

// GET single investment plan by ID
export async function GET(request, { params }) {
  try {
    await dbConnect();

    // Await the params since it's now a Promise in Next.js 14
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "Plan ID is required",
        },
        {
          status: 400,
          headers: corsHeaders(request),
        },
      );
    }

    const plan = await InvestmentPlan.findById(id).lean();

    if (!plan) {
      return NextResponse.json(
        {
          success: false,
          error: "Investment plan not found",
        },
        {
          status: 404,
          headers: corsHeaders(request),
        },
      );
    }

    // Get related plans (same category)
    const relatedPlans = await InvestmentPlan.find({
      _id: { $ne: id },
      category: plan.category,
      status: "active",
    })
      .limit(3)
      .select(
        "name category riskLevel nav oneYearReturn minInvestment isFeatured",
      )
      .lean();

    const response = {
      success: true,
      data: {
        plan: {
          id: plan._id.toString(),
          name: plan.name,
          description: plan.description,
          category: plan.category,
          riskLevel: plan.riskLevel,
          nav: plan.nav,
          oneYearReturn: plan.oneYearReturn,
          minInvestment: plan.minInvestment,
          isFeatured: plan.isFeatured,
          features: plan.features || [],
          tags: plan.tags || [],
          investmentStrategy: plan.investmentStrategy,
          fundManager: plan.fundManager,
          inceptionDate: plan.inceptionDate,
          totalAssets: plan.totalAssets,
          expenseRatio: plan.expenseRatio,
          dividendYield: plan.dividendYield,
          status: plan.status,
          performanceData: plan.performanceData || [],
          createdAt: plan.createdAt,
          updatedAt: plan.updatedAt,
          formattedNav: `$${plan.nav.toFixed(4)}`,
          formattedReturn: `${plan.oneYearReturn >= 0 ? "+" : ""}${plan.oneYearReturn.toFixed(2)}%`,
        },
        relatedPlans: relatedPlans.map((plan) => ({
          id: plan._id.toString(),
          name: plan.name,
          category: plan.category,
          risk: plan.riskLevel,
          nav: plan.nav,
          return: plan.oneYearReturn,
          minInvestment: plan.minInvestment,
          isFeatured: plan.isFeatured,
          formattedNav: `$${plan.nav.toFixed(4)}`,
          formattedReturn: `${plan.oneYearReturn >= 0 ? "+" : ""}${plan.oneYearReturn.toFixed(2)}%`,
        })),
      },
    };

    return NextResponse.json(response, { headers: corsHeaders(request) });
  } catch (error) {
    console.error("Error fetching investment plan:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch investment plan",
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
