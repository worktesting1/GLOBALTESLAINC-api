import { NextResponse } from "next/server";
import dbConnect from "../../../../../lib/mongodb";
import Car from "../../../../../models/Car";
import { withAdmin } from "../../../../../lib/apiHander";
import { corsHeaders, handleOptions } from "../../../../../lib/cors";
import { uploadToCloudinary } from "../../../../../utils/cloudinary";

export async function OPTIONS(request) {
  return handleOptions(request);
}

// GET single car - FIXED: Add async params
export const GET = withAdmin(async (request, { params }) => {
  try {
    await dbConnect();
    const { id } = await params; // ADD AWAIT HERE

    const car = await Car.findById(id).lean();
    if (!car) {
      return NextResponse.json(
        { success: false, error: "Car not found" },
        { status: 404, headers: corsHeaders(request) },
      );
    }

    return NextResponse.json(
      { success: true, data: car },
      { status: 200, headers: corsHeaders(request) },
    );
  } catch (error) {
    console.error("GET car error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch car" },
      { status: 500, headers: corsHeaders(request) },
    );
  }
});

// PUT update car - FIXED: Add async params
export const PUT = withAdmin(async (request, { params }) => {
  try {
    await dbConnect();
    const { id } = await params; // ADD AWAIT HERE

    const formData = await request.formData();
    const updateData = {};

    // Text fields
    const textFields = [
      "name",
      "fullName",
      "year",
      "range",
      "acceleration",
      "topSpeed",
      "battery",
      "charging",
      "description",
      "status",
      "link",
    ];

    textFields.forEach((field) => {
      const value = formData.get(field);
      if (value !== null && value !== undefined) {
        updateData[field] = value;
      }
    });

    // Number fields
    const price = formData.get("price");
    if (price !== null && price !== undefined) {
      updateData.price = parseFloat(price);
    }

    const seating = formData.get("seating");
    if (seating !== null && seating !== undefined) {
      updateData.seating = parseInt(seating);
    }

    // Boolean fields
    const isFeatured = formData.get("isFeatured");
    if (isFeatured !== null && isFeatured !== undefined) {
      updateData.isFeatured = isFeatured === "true";
    }

    const isAvailable = formData.get("isAvailable");
    if (isAvailable !== null && isAvailable !== undefined) {
      updateData.isAvailable = isAvailable !== "false";
    }

    // Arrays and objects
    const features = formData.get("features");
    if (features !== null && features !== undefined) {
      try {
        updateData.features = JSON.parse(features);
      } catch (e) {
        updateData.features = [];
      }
    }

    const specifications = formData.get("specifications");
    if (specifications !== null && specifications !== undefined) {
      try {
        updateData.specifications = JSON.parse(specifications);
      } catch (e) {
        updateData.specifications = {};
      }
    }

    // Handle new images
    const newImageFiles = formData.getAll("images");
    const existingImagesJson = formData.get("existingImages");

    const existingImages = existingImagesJson
      ? JSON.parse(existingImagesJson)
      : [];

    if (newImageFiles && newImageFiles.length > 0) {
      const uploadedImages = [...existingImages];

      for (const file of newImageFiles) {
        if (file.size > 0) {
          try {
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const base64String = `data:${file.type};base64,${buffer.toString("base64")}`;

            const result = await uploadToCloudinary(base64String, "cars");

            uploadedImages.push({
              url: result.url,
              publicId: result.public_id || "",
              isPrimary: uploadedImages.length === 0,
              caption: "",
            });
          } catch (uploadError) {
            console.error("Image upload error:", uploadError);
          }
        }
      }

      updateData.images = uploadedImages;
    } else {
      // Keep existing images if no new ones
      updateData.images = existingImages;
    }

    updateData.updatedBy = request.userId;

    const car = await Car.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true },
    ).lean();

    if (!car) {
      return NextResponse.json(
        { success: false, error: "Car not found" },
        { status: 404, headers: corsHeaders(request) },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Car updated successfully",
        data: car,
      },
      { status: 200, headers: corsHeaders(request) },
    );
  } catch (error) {
    console.error("PUT car error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update car",
        details: error.message,
      },
      { status: 500, headers: corsHeaders(request) },
    );
  }
});

// DELETE car - FIXED: Add async params
export const DELETE = withAdmin(async (request, { params }) => {
  try {
    await dbConnect();
    const { id } = await params; // ADD AWAIT HERE

    const car = await Car.findByIdAndDelete(id);
    if (!car) {
      return NextResponse.json(
        { success: false, error: "Car not found" },
        { status: 404, headers: corsHeaders(request) },
      );
    }

    return NextResponse.json(
      { success: true, message: "Car deleted successfully" },
      { status: 200, headers: corsHeaders(request) },
    );
  } catch (error) {
    console.error("DELETE car error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete car" },
      { status: 500, headers: corsHeaders(request) },
    );
  }
});
