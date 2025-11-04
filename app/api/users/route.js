import { NextResponse } from "next/server";
import dbConnect from "../../../lib/mongodb";
import User from "../../../models/Users";
import { withAdmin } from "../../../lib/apiHander";

// CORS headers helper
function getCorsHeaders() {
  return {
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
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

// GET all users (admin only)
export async function GET(request) {
  try {
    await dbConnect();
    return await withAdmin(handleGetAllUsers)(request, getCorsHeaders());
  } catch (error) {
    console.error("Users GET API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

// POST - Create new user (if needed)
export async function POST(request) {
  try {
    await dbConnect();
    const body = await request.json();
    // Add your user creation logic here
    return NextResponse.json(
      { error: "User creation not implemented" },
      { status: 501, headers: getCorsHeaders() }
    );
  } catch (error) {
    console.error("Users POST API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

async function handleGetAllUsers(req, headers) {
  try {
    const users = await User.find({}, "-password -confirmpassword");
    return NextResponse.json(users, { status: 200, headers });
  } catch (error) {
    console.error("Get all users error:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500, headers }
    );
  }
}
