// app/api/admin/kyc/[userId]/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import KYC from "@/models/Kyc";
import { withAdmin } from "@/lib/apiHander";
import { corsHeaders, handleOptions } from "@/lib/cors";

export async function OPTIONS(request) {
  return handleOptions(request);
}

// PUT update user KYC status (Admin only)
export const PUT = withAdmin(async (request) => {
  console.log("✏️ [Admin KYC PUT] Starting update request...");

  try {
    await dbConnect();
    console.log("✅ [Admin KYC PUT] Database connected");

    // Get userId from URL - Next.js App Router passes it differently
    const url = new URL(request.url);
    const pathname = url.pathname;
    const userId = pathname.split("/").pop(); // Get last segment

    console.log("📋 [Admin KYC PUT] Full URL:", request.url);
    console.log("📋 [Admin KYC PUT] Pathname:", pathname);
    console.log("👤 [Admin KYC PUT] Extracted User ID:", userId);
    console.log("👮 [Admin KYC PUT] Admin ID from auth:", request.userId);

    if (!userId || userId === "kyc") {
      console.error("❌ [Admin KYC PUT] No valid user ID found in URL");
      return NextResponse.json(
        {
          success: false,
          error: "User ID is required",
        },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    let body;
    try {
      body = await request.json();
      console.log(
        "📦 [Admin KYC PUT] Request body:",
        JSON.stringify(body, null, 2),
      );
    } catch (parseError) {
      console.error(
        "❌ [Admin KYC PUT] Failed to parse request body:",
        parseError.message,
      );
      return NextResponse.json(
        {
          success: false,
          error: "Invalid JSON in request body",
        },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    const { status, rejectionReason, notes } = body;

    console.log("📝 [Admin KYC PUT] Received fields:", {
      status,
      hasRejectionReason: !!rejectionReason,
      hasNotes: !!notes,
    });

    // Validate required fields
    if (!status) {
      console.error("❌ [Admin KYC PUT] Status is missing in request body");
      return NextResponse.json(
        {
          success: false,
          error: "Status is required",
        },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    // Validate status
    const validStatuses = [
      "pending",
      "submitted",
      "under_review",
      "approved",
      "rejected",
      "expired",
    ];

    if (!validStatuses.includes(status)) {
      console.error("❌ [Admin KYC PUT] Invalid status:", status);
      console.log("📋 [Admin KYC PUT] Valid statuses:", validStatuses);
      return NextResponse.json(
        {
          success: false,
          error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
        },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    // Check if KYC exists
    console.log("🔍 [Admin KYC PUT] Looking for KYC for user:", userId);
    const kyc = await KYC.findOne({ userId });
    console.log("📄 [Admin KYC PUT] KYC result:", kyc ? "Found" : "Not found");

    if (!kyc) {
      console.error(
        "❌ [Admin KYC PUT] KYC record not found for user:",
        userId,
      );
      return NextResponse.json(
        {
          success: false,
          error: "KYC record not found for this user",
        },
        { status: 404, headers: corsHeaders(request) },
      );
    }

    const adminId = request.userId; // From withAdmin middleware

    console.log("🔄 [Admin KYC PUT] Updating KYC with:", {
      oldStatus: kyc.status,
      newStatus: status,
      adminId,
    });

    // Update KYC
    kyc.status = status;
    kyc.reviewedAt = new Date();
    kyc.reviewedBy = adminId;

    if (rejectionReason) {
      kyc.rejectionReason = rejectionReason;
      console.log("📝 [Admin KYC PUT] Added rejection reason");
    }

    if (notes) {
      kyc.notes = notes;
      console.log("📝 [Admin KYC PUT] Added notes");
    }

    await kyc.save();
    console.log("✅ [Admin KYC PUT] KYC saved successfully");

    return NextResponse.json(
      {
        success: true,
        message: `KYC status updated to ${status}`,
        data: {
          userId: kyc.userId,
          status: kyc.status,
          reviewedAt: kyc.reviewedAt,
          reviewedBy: kyc.reviewedBy,
          rejectionReason: kyc.rejectionReason,
          notes: kyc.notes,
        },
      },
      { status: 200, headers: corsHeaders(request) },
    );
  } catch (error) {
    console.error("🔥 [Admin KYC PUT] ERROR DETAILS:");
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    console.error("Error name:", error.name);

    if (error.name === "ValidationError") {
      console.error("Validation errors:", error.errors);
    }

    if (error.code) {
      console.error("Error code:", error.code);
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to update KYC record",
        details:
          process.env.NODE_ENV === "development"
            ? {
                message: error.message,
                type: error.name,
              }
            : undefined,
      },
      { status: 500, headers: corsHeaders(request) },
    );
  }
});
