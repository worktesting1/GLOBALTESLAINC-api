import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import InvestmentPlan from "@/models/InvestmentPlan";
import { corsHeaders, handleOptions } from "@/lib/cors";

// Handle CORS preflight
export async function OPTIONS(request) {
  return handleOptions(request);
}

// GET investment plans with filtering, sorting, and pagination
export async function GET(request) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);

    // Pagination parameters
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "9");
    const skip = (page - 1) * limit;

    // Filter parameters
    const category = searchParams.get("category") || "";
    const risk = searchParams.get("risk") || "";
    const search = searchParams.get("search") || "";
    const featured = searchParams.get("featured") === "true";

    // Sort parameter
    const sortBy = searchParams.get("sort") || "name";

    // Build query
    let query = { status: "active" };

    if (category) {
      query.category = category;
    }

    if (risk) {
      const riskMap = {
        conservative: "Low",
        moderate: "Medium",
        aggressive: "High",
      };
      query.riskLevel = riskMap[risk] || risk;
    }

    if (featured) {
      query.isFeatured = true;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    // Build sort object
    let sort = {};
    switch (sortBy) {
      case "name":
        sort.name = 1;
        break;
      case "performance":
        sort.oneYearReturn = -1;
        break;
      case "nav":
        sort.nav = 1;
        break;
      case "risk":
        const riskOrder = { Low: 1, Medium: 2, High: 3 };
        // We'll handle this differently
        break;
      default:
        sort.name = 1;
    }

    // Get total count for pagination
    const totalCount = await InvestmentPlan.countDocuments(query);

    // Get categories count
    const categories = await InvestmentPlan.aggregate([
      { $match: { status: "active" } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]);

    // Get risk levels count
    const riskLevels = await InvestmentPlan.aggregate([
      { $match: { status: "active" } },
      { $group: { _id: "$riskLevel", count: { $sum: 1 } } },
    ]);

    let plans;

    // Special handling for risk sorting
    if (sortBy === "risk") {
      // Get all plans and sort in memory for risk order
      plans = await InvestmentPlan.find(query).lean();
      plans.sort((a, b) => {
        const riskOrder = { Low: 1, Medium: 2, High: 3 };
        return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
      });
      plans = plans.slice(skip, skip + limit);
    } else {
      plans = await InvestmentPlan.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean();
    }

    // Get featured plans separately
    const featuredPlans = await InvestmentPlan.find({
      isFeatured: true,
      status: "active",
    })
      .limit(3)
      .lean();

    const response = {
      success: true,
      data: {
        plans: plans.map((plan) => ({
          id: plan._id.toString(),
          name: plan.name,
          category: plan.category,
          risk: plan.riskLevel,
          nav: plan.nav,
          return: plan.oneYearReturn,
          minInvestment: plan.minInvestment,
          isFeatured: plan.isFeatured,
          description: plan.description,
          features: plan.features || [],
          tags: plan.tags || [],
          status: plan.status,
          formattedNav: `$${plan.nav.toFixed(4)}`,
          formattedReturn: `${plan.oneYearReturn >= 0 ? "+" : ""}${plan.oneYearReturn.toFixed(2)}%`,
        })),
        featuredPlans: featuredPlans.map((plan) => ({
          id: plan._id.toString(),
          name: plan.name,
          category: plan.category,
          risk: plan.riskLevel,
          nav: plan.nav,
          return: plan.oneYearReturn,
          minInvestment: plan.minInvestment,
          isFeatured: plan.isFeatured,
          description: plan.description,
          formattedNav: `$${plan.nav.toFixed(4)}`,
          formattedReturn: `${plan.oneYearReturn >= 0 ? "+" : ""}${plan.oneYearReturn.toFixed(2)}%`,
        })),
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          totalItems: totalCount,
          itemsPerPage: limit,
          hasNextPage: page < Math.ceil(totalCount / limit),
          hasPrevPage: page > 1,
        },
        filters: {
          categories: categories.map((cat) => ({
            name: cat._id,
            count: cat.count,
          })),
          riskLevels: riskLevels.map((risk) => ({
            value: risk._id.toLowerCase(),
            label: risk._id,
            count: risk.count,
          })),
          sortOptions: [
            { value: "name", label: "Name A-Z" },
            { value: "performance", label: "Best Performance" },
            { value: "nav", label: "Lowest NAV" },
            { value: "risk", label: "Risk Level" },
          ],
        },
        stats: {
          totalPlans: totalCount,
          featuredCount: featuredPlans.length,
          activePlans: totalCount,
        },
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { headers: corsHeaders(request) });
  } catch (error) {
    console.error("Error fetching investment plans:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch investment plans",
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

// POST - Create new investment plan (Admin only)
export async function POST(request) {
  try {
    await dbConnect();

    const body = await request.json();

    // Validate required fields
    const requiredFields = [
      "name",
      "description",
      "category",
      "riskLevel",
      "nav",
      "oneYearReturn",
      "minInvestment",
    ];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          {
            success: false,
            error: `Missing required field: ${field}`,
          },
          {
            status: 400,
            headers: corsHeaders(request),
          },
        );
      }
    }

    // Create new plan
    const plan = new InvestmentPlan({
      name: body.name,
      description: body.description,
      category: body.category,
      riskLevel: body.riskLevel,
      nav: parseFloat(body.nav),
      oneYearReturn: parseFloat(body.oneYearReturn),
      minInvestment: parseFloat(body.minInvestment),
      isFeatured: body.isFeatured || false,
      features: body.features || [],
      tags: body.tags || [],
      investmentStrategy: body.investmentStrategy,
      fundManager: body.fundManager,
      inceptionDate: body.inceptionDate ? new Date(body.inceptionDate) : null,
      totalAssets: body.totalAssets ? parseFloat(body.totalAssets) : null,
      expenseRatio: body.expenseRatio ? parseFloat(body.expenseRatio) : null,
      dividendYield: body.dividendYield ? parseFloat(body.dividendYield) : null,
      status: body.status || "active",
    });

    await plan.save();

    return NextResponse.json(
      {
        success: true,
        data: {
          id: plan._id,
          name: plan.name,
          category: plan.category,
          message: "Investment plan created successfully",
        },
      },
      {
        status: 201,
        headers: corsHeaders(request),
      },
    );
  } catch (error) {
    console.error("Error creating investment plan:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create investment plan",
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
