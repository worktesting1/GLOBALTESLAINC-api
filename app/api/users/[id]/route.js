import { NextResponse } from "next/server";
import dbConnect from "../../../../lib/mongodb";
import User from "../../../../models/Users";
import { withAuth, withAdmin } from "../../../../lib/apiHander";
import { corsHeaders, handleOptions } from "../../../../lib/cors";

export async function OPTIONS(request) {
  return handleOptions(request);
}

// GET user by ID (user's own data)
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    await dbConnect();
    return await withAuth(handleGetUser)(request, corsHeaders(request), id);
  } catch (error) {
    console.error("User GET API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders(request) }
    );
  }
}

// PUT - Update basic user data
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    await dbConnect();
    return await handleChangeUserData(request, corsHeaders(request), id, body);
  } catch (error) {
    console.error("User PUT API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders(request) }
    );
  }
}

// DELETE user (admin only)
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    await dbConnect();
    return await withAdmin(handleDeleteUser)(request, corsHeaders(request), id);
  } catch (error) {
    console.error("User DELETE API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders(request) }
    );
  }
}

async function handleGetUser(req, headers, id) {
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
    console.error("Get user error:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500, headers }
    );
  }
}

async function handleChangeUserData(req, headers, userId, body) {
  try {
    const {
      firstName,
      lastName,
      userName,
      country,
      phone,
      email,
      gender,
      city,
      address,
      age,
      maritalstatus,
      dob,
    } = body;

    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404, headers }
      );
    }

    // Update user data
    user.firstName = firstName || user.firstName;
    user.lastName = lastName || user.lastName;
    user.userName = userName || user.userName;
    user.country = country || user.country;
    user.phone = phone || user.phone;
    user.email = email || user.email;
    user.gender = gender || user.gender;
    user.city = city || user.city;
    user.address = address || user.address;
    user.age = age || user.age;
    user.maritalstatus = maritalstatus || user.maritalstatus;
    user.dob = dob || user.dob;

    await user.save();

    return NextResponse.json(
      { message: "User data updated successfully" },
      { status: 200, headers }
    );
  } catch (error) {
    console.error("Change user data error:", error);
    return NextResponse.json(
      { error: "Failed to update user data" },
      { status: 500, headers }
    );
  }
}

async function handleDeleteUser(req, headers, id) {
  try {
    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404, headers }
      );
    }

    return NextResponse.json(
      { message: "User has been deleted" },
      { status: 200, headers }
    );
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500, headers }
    );
  }
}
