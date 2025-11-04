import { NextResponse } from "next/server";
import dbConnect from "../../../lib/mongodb";
import User from "../../../models/Users";
import { withAdmin } from "../../../lib/apiHander";
import { corsHeaders, handleOptions } from "../../../lib/cors";

export async function OPTIONS(request) {
  return handleOptions(request);
}

// GET all users (admin only)
export async function GET(request) {
  try {
    await dbConnect();
    return await withAdmin(handleGetAllUsers)(request, corsHeaders(request));
  } catch (error) {
    console.error("Users GET API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders(request) }
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
      { status: 501, headers: corsHeaders(request) }
    );
  } catch (error) {
    console.error("Users POST API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders(request) }
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
