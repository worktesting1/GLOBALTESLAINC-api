import { NextResponse } from "next/server";
import dbConnect from "../../../../../lib/mongodb";
import User from "../../../../../models/Users";
import { withAdmin } from "../../../../../lib/apiHander";
import { corsHeaders, handleOptions } from "../../../../../lib/cors";

export async function OPTIONS(request) {
  return handleOptions(request);
}

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    await dbConnect();
    return await withAdmin(handleGetUserAdmin)(
      request,
      corsHeaders(request),
      id
    );
  } catch (error) {
    console.error("Admin User GET API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders(request) }
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
