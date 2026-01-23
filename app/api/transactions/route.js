import { NextResponse } from "next/server";
import dbConnect from "../../../lib/mongodb";
import Transaction from "../../../models/Transaction";
import { withAuth } from "../../../lib/apiHander";
import { corsHeaders, handleOptions } from "../../../lib/cors";

export async function OPTIONS(request) {
  return handleOptions(request);
}

export const GET = withAuth(async (request) => {
  try {
    await dbConnect();

    const userId = request.userId;
    const { searchParams } = new URL(request.url);

    const limit = parseInt(searchParams.get("limit")) || 10;
    const page = parseInt(searchParams.get("page")) || 1;
    const skip = (page - 1) * limit;

    // Get user's transactions
    const transactions = await Transaction.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Format transactions for frontend
    const formattedTransactions = transactions.map((transaction) => {
      const date = new Date(transaction.createdAt);
      const formattedDate = date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

      return {
        date: formattedDate,
        symbol: transaction.symbol,
        type: transaction.type,
        typeColor:
          transaction.type === "BUY"
            ? "bg-green-100 text-green-800"
            : "bg-red-100 text-red-800",
        quantity: transaction.quantity,
        price: `$${transaction.price.toFixed(2)}`,
        total: `$${transaction.netAmount.toFixed(2)}`,
        status: transaction.status,
        statusColor:
          transaction.status === "COMPLETED"
            ? "bg-green-100 text-green-800"
            : transaction.status === "PENDING"
              ? "bg-yellow-100 text-yellow-800"
              : "bg-red-100 text-red-800",
        logo: `https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/${transaction.symbol}.png`,
      };
    });

    // Get total count for pagination
    const totalCount = await Transaction.countDocuments({ userId });

    return NextResponse.json(
      {
        success: true,
        data: {
          transactions: formattedTransactions,
          pagination: {
            page,
            limit,
            total: totalCount,
            pages: Math.ceil(totalCount / limit),
            hasNext: page * limit < totalCount,
            hasPrev: page > 1,
          },
        },
      },
      {
        status: 200,
        headers: corsHeaders(request),
      },
    );
  } catch (error) {
    console.error("Get transactions error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch transactions",
        details: error.message,
      },
      {
        status: 500,
        headers: corsHeaders(request),
      },
    );
  }
});
