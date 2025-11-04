import { NextResponse } from "next/server";
import dbConnect from "../../../../../lib/mongodb";
import User from "../../../../../models/Users";
import { withAdmin } from "../../../../../lib/apiHander";

function getCorsHeaders() {
  return {
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, token, x-requested-with",
    "Access-Control-Allow-Origin": "http://localhost:3001",
    "Access-Control-Allow-Credentials": "true",
    "Content-Type": "application/json",
  };
}

export async function OPTIONS() {
  const headers = getCorsHeaders();
  return new NextResponse(null, {
    status: 200,
    headers: {
      ...headers,
      "Access-Control-Max-Age": "86400",
    },
  });
}

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    await dbConnect();
    return await withAdmin(handleGetUserAdmin)(request, getCorsHeaders(), id);
  } catch (error) {
    console.error("Admin User GET API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

async function handleGetUserAdmin(req, headers, id) {
  try {
    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404, headers }
      );
    }

    const { password, confirmpassword, ...others } = user._doc;
    return NextResponse.json(others, { status: 200, headers });
  } catch (error) {
    console.error("Get user admin error:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500, headers }
    );
  }
}
