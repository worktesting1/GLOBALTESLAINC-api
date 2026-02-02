import { NextResponse } from "next/server";
import { withAuth } from "../../../../../lib/apiHander";
import { corsHeaders, handleOptions } from "../../../../../lib/cors";
import dbConnect from "../../../../../lib/mongodb";
import User from "../../../../../models/Users";
import { uploadToCloudinary } from "../../../../../utils/cloudinary";

export async function OPTIONS(request) {
  return handleOptions(request);
}

// PUT /api/user/profile/[id] - Update user profile image
export const PUT = withAuth(async (request, { params }) => {
  try {
    await dbConnect();
    const { id } = await params;

    const formData = await request.formData();
    const profileImage = formData.get("profileImage");

    if (!profileImage) {
      return NextResponse.json(
        { error: "No file uploaded" },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    console.log(`☁️ Uploading ${profileImage.name} to Cloudinary...`);

    // Use the same upload pattern as deposits
    const uploadedImage = await handleCloudinaryUpload(
      profileImage,
      "profile-images",
    );

    console.log(`✅ Successfully uploaded: ${uploadedImage.url}`);

    const updatedUser = await User.findByIdAndUpdate(
      id,
      {
        $set: { profileImage: uploadedImage },
      },
      { new: true },
    );

    if (!updatedUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404, headers: corsHeaders(request) },
      );
    }

    return NextResponse.json(
      {
        message: "Profile image updated successfully",
        user: {
          _id: updatedUser._id,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          email: updatedUser.email,
          profileImage: updatedUser.profileImage,
        },
      },
      { status: 200, headers: corsHeaders(request) },
    );
  } catch (error) {
    console.error("❌ Update profile image error:", error);
    return NextResponse.json(
      { error: "Failed to update profile image", details: error.message },
      { status: 500, headers: corsHeaders(request) },
    );
  }
});

// Cloudinary upload handler - Same pattern as deposits
async function handleCloudinaryUpload(file, folder) {
  try {
    console.log(`☁️ Uploading ${file.name} to Cloudinary...`);

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Convert to base64 for Cloudinary
    const base64String = `data:${file.type};base64,${buffer.toString(
      "base64",
    )}`;

    // Use the named export directly
    const result = await uploadToCloudinary(base64String, folder);

    const uploadedImage = {
      url: result.url,
      public_id: result.public_id, // Fixed: should be public_id not id
      uploadedAt: new Date(),
    };

    console.log(`✅ Successfully uploaded: ${result.url}`);
    return uploadedImage;
  } catch (error) {
    console.error(`❌ Failed to upload file ${file.name}:`, error);
    throw error;
  }
}
