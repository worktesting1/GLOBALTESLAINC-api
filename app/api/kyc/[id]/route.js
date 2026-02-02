import { NextResponse } from "next/server";
import dbConnect from "../../../../lib/mongodb";
import Kyc from "../../../../models/Kyc";
import { withAdmin } from "../../../../lib/apiHander";
import { corsHeaders, handleOptions } from "../../../../lib/cors";
import { sendKYCApprovedEmail, sendKYCRejectedEmail } from "../emailService";

export async function OPTIONS(request) {
  return handleOptions(request);
}

// Note: params is now a Promise in Next.js App Router
export async function PUT(request, { params: paramsPromise }) {
  let headers;
  try {
    // Await the params promise
    const params = await paramsPromise;
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: "KYC ID is required" },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    headers = corsHeaders(request);
    await dbConnect();

    const body = await request.json();

    // Validate request body
    if (!body || Object.keys(body).length === 0) {
      return NextResponse.json(
        { error: "Request body is required" },
        { status: 400, headers },
      );
    }

    return await withAdmin((req) => handleUpdateKyc(req, headers, id, body))(
      request,
    );
  } catch (error) {
    console.error("KYC PUT API Error:", error);
    return NextResponse.json(
      { error: "Internal server error: " + error.message },
      { status: 500, headers: headers || corsHeaders(request) },
    );
  }
}

export async function DELETE(request, { params: paramsPromise }) {
  let headers;
  try {
    // Await the params promise
    const params = await paramsPromise;
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: "KYC ID is required" },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    headers = corsHeaders(request);
    await dbConnect();

    return await withAdmin((req) => handleDeleteKyc(req, headers, id))(request);
  } catch (error) {
    console.error("KYC DELETE API Error:", error);
    return NextResponse.json(
      { error: "Internal server error: " + error.message },
      { status: 500, headers: headers || corsHeaders(request) },
    );
  }
}

export async function GET(request, { params: paramsPromise }) {
  let headers;
  try {
    // Await the params promise
    const params = await paramsPromise;
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: "ID parameter is required" },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    headers = corsHeaders(request);
    await dbConnect();

    return await withAdmin((req) => handleGetUserKyc(req, headers, id))(
      request,
    );
  } catch (error) {
    console.error("KYC GET API Error:", error);
    return NextResponse.json(
      { error: "Internal server error: " + error.message },
      { status: 500, headers: headers || corsHeaders(request) },
    );
  }
}

// Handler functions
async function handleUpdateKyc(req, headers, id, body) {
  try {
    // Validate status if provided
    if (body.status !== undefined && typeof body.status !== "boolean") {
      return NextResponse.json(
        { error: "Status must be a boolean value" },
        { status: 400, headers },
      );
    }

    // Validate rejection reason if status is false
    if (body.status === false && !body.rejectionReason) {
      return NextResponse.json(
        { error: "Rejection reason is required when rejecting KYC" },
        { status: 400, headers },
      );
    }

    const updatedKyc = await Kyc.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true, runValidators: true },
    ).populate("userId", "email firstName lastName");

    if (!updatedKyc) {
      return NextResponse.json(
        { message: "KYC record not found" },
        { status: 404, headers },
      );
    }

    // Send KYC status update email if status changed
    if (body.status !== undefined && updatedKyc.userId) {
      try {
        if (body.status === true) {
          await sendKYCApprovedEmail(updatedKyc);
        } else if (body.status === false) {
          await sendKYCRejectedEmail(updatedKyc, body.rejectionReason);
        }
      } catch (emailError) {
        console.error("Failed to send KYC status email:", emailError);
        // Don't fail the request if email fails
      }
    }

    return NextResponse.json(updatedKyc, { status: 200, headers });
  } catch (error) {
    console.error("Update KYC error:", error);

    if (error.name === "ValidationError") {
      return NextResponse.json(
        { error: "Validation error: " + error.message },
        { status: 400, headers },
      );
    }

    if (error.name === "CastError") {
      return NextResponse.json(
        { error: "Invalid KYC ID format" },
        { status: 400, headers },
      );
    }

    return NextResponse.json(
      { error: "Failed to update KYC: " + error.message },
      { status: 500, headers },
    );
  }
}

async function handleDeleteKyc(req, headers, id) {
  try {
    const deletedKyc = await Kyc.findByIdAndDelete(id);

    if (!deletedKyc) {
      return NextResponse.json(
        { message: "KYC record not found" },
        { status: 404, headers },
      );
    }

    return NextResponse.json(
      { message: "KYC record deleted successfully", kyc: deletedKyc },
      { status: 200, headers },
    );
  } catch (error) {
    console.error("Delete KYC error:", error);

    if (error.name === "CastError") {
      return NextResponse.json(
        { error: "Invalid KYC ID format" },
        { status: 400, headers },
      );
    }

    return NextResponse.json(
      { error: "Failed to delete KYC: " + error.message },
      { status: 500, headers },
    );
  }
}

async function handleGetUserKyc(req, headers, id) {
  try {
    // Try to find by _id first, then by userId if not found
    let kyc;

    // Check if id is a valid ObjectId (24 character hex string)
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);

    if (isObjectId) {
      kyc = await Kyc.findById(id).populate(
        "userId",
        "email firstName lastName",
      );
      if (kyc) {
        return NextResponse.json([kyc], { status: 200, headers });
      }
    }

    // If not found by _id or not an ObjectId, search by userId
    kyc = await Kyc.find({ userId: id }).populate(
      "userId",
      "email firstName lastName",
    );

    if (!kyc || kyc.length === 0) {
      return NextResponse.json(
        { message: "No KYC records found" },
        { status: 404, headers },
      );
    }

    return NextResponse.json(kyc, { status: 200, headers });
  } catch (error) {
    console.error("Get user KYC error:", error);

    if (error.name === "CastError") {
      return NextResponse.json(
        { error: "Invalid ID format" },
        { status: 400, headers },
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch KYC records: " + error.message },
      { status: 500, headers },
    );
  }
}
