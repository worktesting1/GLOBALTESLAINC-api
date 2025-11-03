import { NextResponse } from "next/server";
import dbConnect from "../../../../lib/mongodb";
import Kyc from "../../../../models/Kyc";
import { withAuth, withAdmin } from "../../../../lib/apiHander";

// CORS headers helper
function getCorsHeaders(request) {
  const origin = request.headers.get("origin") || "";
  const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:3002",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
  ];

  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, token, x-requested-with",
  };

  if (allowedOrigins.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  } else {
    headers["Access-Control-Allow-Origin"] = "*";
  }

  return headers;
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS(request) {
  const headers = getCorsHeaders(request);
  return new NextResponse(null, {
    status: 200,
    headers: {
      ...headers,
      "Access-Control-Max-Age": "86400",
    },
  });
}

// POST handler - Submit KYC
export async function POST(request, { params }) {
  try {
    const { route } = await params;
    const headers = getCorsHeaders(request);
    await dbConnect();

    // Handle /api/kyc (submit KYC)
    if (!route || route.length === 0) {
      const body = await request.json();
      return await withAuth(handleSubmitKyc)(request, headers, body);
    }

    return NextResponse.json(
      { error: "Endpoint not found" },
      { status: 404, headers }
    );
  } catch (error) {
    console.error("KYC POST API Error:", error);
    const headers = getCorsHeaders(request);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers }
    );
  }
}

// PUT handler - Update KYC
export async function PUT(request, { params }) {
  try {
    const { route } = await params;
    const headers = getCorsHeaders(request);
    await dbConnect();

    if (!route || route.length === 0) {
      return NextResponse.json(
        { error: "Endpoint not found" },
        { status: 404, headers }
      );
    }

    const [id] = route;
    const body = await request.json();

    return await withAdmin(handleUpdateKyc)(request, headers, id, body);
  } catch (error) {
    console.error("KYC PUT API Error:", error);
    const headers = getCorsHeaders(request);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers }
    );
  }
}

// DELETE handler - Delete KYC
export async function DELETE(request, { params }) {
  try {
    const { route } = await params;
    const headers = getCorsHeaders(request);
    await dbConnect();

    if (!route || route.length === 0) {
      return NextResponse.json(
        { error: "Endpoint not found" },
        { status: 404, headers }
      );
    }

    const [id] = route;
    return await withAdmin(handleDeleteKyc)(request, headers, id);
  } catch (error) {
    console.error("KYC DELETE API Error:", error);
    const headers = getCorsHeaders(request);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers }
    );
  }
}

// GET handler - Get KYC data
export async function GET(request, { params }) {
  try {
    const { route } = await params;
    const headers = getCorsHeaders(request);
    await dbConnect();

    // Handle /api/kyc (get all KYC - admin only)
    if (!route || route.length === 0) {
      return await withAdmin(handleGetAllKyc)(request, headers);
    }

    const [firstSegment, secondSegment] = route;

    // Handle /api/kyc/myKYC/:userId
    if (firstSegment === "myKYC" && secondSegment) {
      return await withAuth(handleGetMyKyc)(request, headers, secondSegment);
    }

    // Handle /api/kyc/:userId (get user KYC - admin only)
    if (firstSegment && !secondSegment) {
      return await withAdmin(handleGetUserKyc)(request, headers, firstSegment);
    }

    return NextResponse.json(
      { error: "Endpoint not found" },
      { status: 404, headers }
    );
  } catch (error) {
    console.error("KYC GET API Error:", error);
    const headers = getCorsHeaders(request);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers }
    );
  }
}

// Handler functions
async function handleSubmitKyc(req, headers, body) {
  try {
    // Note: File upload needs separate handling in Next.js
    // For now, we'll assume image URLs are provided in the body
    const newKyc = new Kyc({
      idNumber: body.idNumber,
      email: body.email,
      idName: body.idName,
      name: body.name,
      userId: body.userId,
      front: body.front || [], // Array of front image objects
      back: body.back || [], // Array of back image objects
      status: false, // Default status as false (pending)
    });

    const savedKyc = await newKyc.save();

    return NextResponse.json(
      {
        message: "KYC data uploaded successfully",
        kyc: savedKyc,
      },
      { status: 201, headers }
    );
  } catch (error) {
    console.error("Submit KYC error:", error);
    return NextResponse.json(
      { error: "Failed to submit KYC" },
      { status: 500, headers }
    );
  }
}

async function handleUpdateKyc(req, headers, id, body) {
  try {
    const updatedKyc = await Kyc.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true }
    );

    if (!updatedKyc) {
      return NextResponse.json(
        { message: "KYC record not found" },
        { status: 404, headers }
      );
    }

    return NextResponse.json(updatedKyc, { status: 200, headers });
  } catch (error) {
    console.error("Update KYC error:", error);
    return NextResponse.json(
      { error: "Failed to update KYC" },
      { status: 500, headers }
    );
  }
}

async function handleDeleteKyc(req, headers, id) {
  try {
    const deletedKyc = await Kyc.findByIdAndDelete(id);

    if (!deletedKyc) {
      return NextResponse.json(
        { message: "KYC record not found" },
        { status: 404, headers }
      );
    }

    return NextResponse.json(deletedKyc, { status: 200, headers });
  } catch (error) {
    console.error("Delete KYC error:", error);
    return NextResponse.json(
      { error: "Failed to delete KYC" },
      { status: 500, headers }
    );
  }
}

async function handleGetMyKyc(req, headers, userId) {
  try {
    const kyc = await Kyc.findOne({ userId });

    if (!kyc) {
      return NextResponse.json(
        { error: "No KYC Documents found" },
        { status: 404, headers }
      );
    }

    return NextResponse.json(
      {
        success: true,
        kyc,
      },
      { status: 200, headers }
    );
  } catch (error) {
    console.error("Get my KYC error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch KYC details",
        details: error.message,
      },
      { status: 500, headers }
    );
  }
}

async function handleGetUserKyc(req, headers, userId) {
  try {
    const kyc = await Kyc.find({ userId: userId });

    if (!kyc || kyc.length === 0) {
      return NextResponse.json(
        { message: "No KYC records found" },
        { status: 404, headers }
      );
    }

    return NextResponse.json(kyc, { status: 200, headers });
  } catch (error) {
    console.error("Get user KYC error:", error);
    return NextResponse.json(
      { error: "Failed to fetch KYC records" },
      { status: 500, headers }
    );
  }
}

async function handleGetAllKyc(req, headers) {
  try {
    const kycs = await Kyc.find();
    return NextResponse.json(kycs, { status: 200, headers });
  } catch (error) {
    console.error("Get all KYC error:", error);
    return NextResponse.json(
      { error: "Failed to fetch KYC records" },
      { status: 500, headers }
    );
  }
}
