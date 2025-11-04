import { NextResponse } from "next/server";
import dbConnect from "../../../../../../lib/mongodb";
import User from "../../../../../../models/Users";
import { withAuth } from "../../../../../../lib/apiHander";
import CryptoJS from "crypto-js";
import { corsHeaders, handleOptions } from "../../../../../lib/cors";

export async function OPTIONS(request) {
  return handleOptions(request);
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    await dbConnect();
    return await withAuth(handleUpdateUser)(
      request,
      corsHeaders(request),
      id,
      body
    );
  } catch (error) {
    console.error("User Update PUT API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders(request) }
    );
  }
}

async function handleUpdateUser(req, headers, id, body) {
  try {
    if (body.password) {
      body.password = CryptoJS.AES.encrypt(
        body.password,
        process.env.PASS_SEC
      ).toString();
    }
    if (body.confirmpassword) {
      body.confirmpassword = CryptoJS.AES.encrypt(
        body.confirmpassword,
        process.env.PASS_SEC
      ).toString();
    }

    const updatedUser = await User.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true }
    );

    if (!updatedUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404, headers }
      );
    }

    return NextResponse.json(updatedUser, { status: 200, headers });
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500, headers }
    );
  }
}
