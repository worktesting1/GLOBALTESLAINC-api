import { NextResponse } from "next/server";
import dbConnect from "../../../lib/mongodb";
import Withdrawal from "../../../models/Withdrawal";
import { withAdmin } from "../../../lib/apiHander";
import { corsHeaders, handleOptions } from "../../../lib/cors";

export async function OPTIONS(request) {
  return handleOptions(request);
}

// GET handler - Get all withdrawals (Admin only)
export const GET = withAdmin(async (request) => {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page")) || 1;
    const limit = parseInt(searchParams.get("limit")) || 20;
    const status = searchParams.get("status");
    const userId = searchParams.get("userId");
    const email = searchParams.get("email");
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    // Build filter object
    const filter = {};

    if (status && status !== "all") {
      filter.status = status;
    }

    if (userId) {
      filter.userId = userId;
    }

    if (email) {
      filter.email = { $regex: email, $options: "i" };
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Execute query with pagination
    const [withdrawals, totalCount] = await Promise.all([
      Withdrawal.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .select("-__v")
        .lean(),
      Withdrawal.countDocuments(filter),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    return NextResponse.json(
      {
        message: "Withdrawals retrieved successfully",
        withdrawals,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          hasNext,
          hasPrev,
          limit,
        },
      },
      { status: 200, headers: corsHeaders(request) }
    );
  } catch (error) {
    console.error("Get withdrawals API Error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve withdrawals", details: error.message },
      { status: 500, headers: corsHeaders(request) }
    );
  }
});
