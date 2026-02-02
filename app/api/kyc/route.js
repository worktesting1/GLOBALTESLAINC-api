import { NextResponse } from "next/server";
import dbConnect from "../../../lib/mongodb";
import Kyc from "../../../models/Kyc";
import { withAuth } from "../../../lib/apiHander";
import { corsHeaders, handleOptions } from "../../../lib/cors";
import { handleFormDataFileUpload } from "../../../utils/fileUpload";

export async function OPTIONS(request) {
  return handleOptions(request);
}

// POST /api/kyc - Submit KYC documents
export async function POST(request) {
  try {
    console.log("=== KYC Upload API Called ===");

    const headers = corsHeaders(request);
    await dbConnect();

    // Parse form data
    const formData = await request.formData();

    // Log all form data entries for debugging
    console.log("=== Form Data Entries ===");
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        console.log(
          `${key}: File - ${value.name} (${value.type}, ${value.size} bytes)`,
        );
      } else {
        console.log(`${key}: ${value}`);
      }
    }

    return await withAuth(handleSubmitKyc)(request, headers, formData);
  } catch (error) {
    console.error("KYC POST API Error:", error);
    const headers = corsHeaders(request);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500, headers },
    );
  }
}

async function handleSubmitKyc(req, headers, formData) {
  try {
    console.log("=== handleSubmitKyc started ===");
    console.log("Auth passed - UserId from withAuth:", req.userId);

    // Extract form data
    const idNumber = formData.get("idNumber")?.toString().trim();
    const idName = formData.get("idName")?.toString().trim();
    const name = formData.get("name")?.toString().trim();
    const email = formData.get("email")?.toString().trim();
    const userIdFromForm = formData.get("userId")?.toString().trim();

    // Use userId from auth middleware (from token) OR from form
    const userId = req.userId || userIdFromForm;

    console.log("Extracted data:", {
      idNumber: idNumber ? `${idNumber.substring(0, 4)}...` : "missing",
      idName: idName || "missing",
      name: name || "missing",
      email: email || "missing",
      userId: userId || "missing",
      userIdSource: req.userId ? "from token" : "from form",
    });

    // Validate required text fields
    const errors = [];
    if (!idNumber) errors.push("ID Number is required");
    if (!idName) errors.push("ID Type is required");
    if (!name) errors.push("Full name is required");
    if (!email) errors.push("Email is required");
    if (!email?.includes("@")) errors.push("Valid email is required");
    if (!userId) errors.push("User ID is required");

    if (errors.length > 0) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: errors,
        },
        { status: 400, headers },
      );
    }

    // Check for files
    const frontFiles = formData.getAll("front");
    const backFiles = formData.getAll("back");

    console.log("File check:", {
      frontFiles: frontFiles.length,
      backFiles: backFiles.length,
    });

    if (frontFiles.length === 0) {
      errors.push("Front ID document is required");
    }
    if (backFiles.length === 0) {
      errors.push("Back ID document is required");
    }

    if (errors.length > 0) {
      return NextResponse.json(
        {
          error: "File validation failed",
          details: errors,
        },
        { status: 400, headers },
      );
    }

    // Check if KYC already exists for this user
    const existingKycByUserId = await Kyc.findOne({ userId });
    if (existingKycByUserId) {
      return NextResponse.json(
        {
          error: "KYC already submitted",
          details: "You have already submitted KYC verification",
        },
        { status: 409, headers },
      );
    }

    // Check if ID number is already used
    const existingKycByIdNumber = await Kyc.findOne({ idNumber });
    if (existingKycByIdNumber) {
      return NextResponse.json(
        {
          error: "ID Number already registered",
          details: "This ID number has already been used for verification",
        },
        { status: 409, headers },
      );
    }

    // Upload files to Cloudinary
    console.log("Uploading front files...");
    const frontImages = await handleFormDataFileUpload(formData, "front");
    console.log(`Uploaded ${frontImages.length} front files`);

    console.log("Uploading back files...");
    const backImages = await handleFormDataFileUpload(formData, "back");
    console.log(`Uploaded ${backImages.length} back files`);

    // Validate files were uploaded
    if (frontImages.length === 0 || backImages.length === 0) {
      return NextResponse.json(
        {
          error: "File upload failed",
          details: "Could not upload document images",
        },
        { status: 500, headers },
      );
    }

    // Create KYC document
    const newKyc = new Kyc({
      idNumber,
      idName,
      name,
      email,
      front: frontImages,
      back: backImages,
      userId,
      status: "pending", // Pending by default
    });

    console.log("Saving KYC to database...");
    const savedKyc = await newKyc.save();

    // Remove sensitive data from response
    const responseKyc = savedKyc.toObject();
    delete responseKyc.front; // Remove file arrays if they're large
    delete responseKyc.back;

    console.log("KYC saved successfully:", {
      kycId: savedKyc._id,
      userId: savedKyc.userId,
      status: savedKyc.status,
    });

    return NextResponse.json(
      {
        success: true,
        message:
          "KYC submitted successfully. Your verification is pending review.",
        kyc: {
          _id: responseKyc._id,
          idNumber: responseKyc.idNumber,
          idName: responseKyc.idName,
          name: responseKyc.name,
          email: responseKyc.email,
          userId: responseKyc.userId,
          status: responseKyc.status,
          createdAt: responseKyc.createdAt,
        },
      },
      { status: 201, headers },
    );
  } catch (error) {
    console.error("Submit KYC error:", error);

    // Handle MongoDB duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      const message =
        field === "idNumber"
          ? "ID number already exists"
          : field === "name"
            ? "Name already registered"
            : "Duplicate record found";

      return NextResponse.json({ error: message }, { status: 409, headers });
    }

    return NextResponse.json(
      {
        error: "Failed to submit KYC",
        details: error.message,
      },
      { status: 500, headers },
    );
  }
}

// GET /api/kyc - Get user's KYC status (for the authenticated user)
export async function GET(request) {
  try {
    const headers = corsHeaders(request);
    await dbConnect();

    return await withAuth(handleGetMyKyc)(request, headers);
  } catch (error) {
    console.error("KYC GET API Error:", error);
    const headers = corsHeaders(request);
    return NextResponse.json(
      { error: "Internal server error: " + error.message },
      { status: 500, headers },
    );
  }
}

async function handleGetMyKyc(req, headers) {
  try {
    // userId comes from withAuth middleware (req.userId)
    const userId = req.userId;
    console.log("Getting KYC for userId:", userId);

    const kyc = await Kyc.findOne({ userId });

    if (!kyc) {
      return NextResponse.json(
        { error: "No KYC Documents found" },
        { status: 404, headers },
      );
    }

    return NextResponse.json(
      {
        success: true,
        kyc,
      },
      { status: 200, headers },
    );
  } catch (error) {
    console.error("Get my KYC error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch KYC details",
        details: error.message,
      },
      { status: 500, headers },
    );
  }
}
