import { NextResponse } from "next/server";
import dbConnect from "../../../../lib/mongodb";
import Loan from "../../../../models/Loan";
import { withAuth, withAdmin } from "../../../../lib/apiHander";
import { corsHeaders, handleOptions } from "../../../../lib/cors";

export async function OPTIONS(request) {
  return handleOptions(request);
}

// GET /api/loan/[id] - Get user's loans
export const GET = withAuth(async (request, { params }) => {
  try {
    await dbConnect();
    const { id } = await params;

    const loans = await Loan.find({ userId: id }).sort({ createdAt: -1 });

    return NextResponse.json(
      { message: "User loans retrieved", data: loans },
      { status: 200, headers: corsHeaders(request) }
    );
  } catch (error) {
    console.error("Get user loans error:", error);
    return NextResponse.json(
      { error: "Failed to fetch user loans" },
      { status: 500, headers: corsHeaders(request) }
    );
  }
});

// PUT /api/loan/[id] - Update loan (Admin only)
export const PUT = withAdmin(async (request, { params }) => {
  try {
    await dbConnect();
    const { id } = await params;
    const body = await request.json();

    const updatedLoan = await Loan.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true }
    );

    if (!updatedLoan) {
      return NextResponse.json(
        { error: "Loan not found" },
        { status: 404, headers: corsHeaders(request) }
      );
    }

    return NextResponse.json(
      { message: "Loan updated", data: updatedLoan },
      { status: 200, headers: corsHeaders(request) }
    );
  } catch (error) {
    console.error("Update loan error:", error);
    return NextResponse.json(
      { error: "Failed to update loan" },
      { status: 500, headers: corsHeaders(request) }
    );
  }
});

// DELETE /api/loan/[id] - Delete loan (Admin only)
export const DELETE = withAdmin(async (request, { params }) => {
  try {
    await dbConnect();
    const { id } = await params;

    const deletedLoan = await Loan.findByIdAndDelete(id);

    if (!deletedLoan) {
      return NextResponse.json(
        { error: "Loan not found" },
        { status: 404, headers: corsHeaders(request) }
      );
    }

    return NextResponse.json(
      { message: "Loan deleted" },
      { status: 200, headers: corsHeaders(request) }
    );
  } catch (error) {
    console.error("Delete loan error:", error);
    return NextResponse.json(
      { error: "Failed to delete loan" },
      { status: 500, headers: corsHeaders(request) }
    );
  }
});
