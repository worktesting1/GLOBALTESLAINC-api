import { NextResponse } from "next/server";
import dbConnect from "../../../../lib/mongodb";
import Car from "../../../../models/Car";
import { withAdmin } from "../../../../lib/apiHander";
import { corsHeaders, handleOptions } from "../../../../lib/cors";
import { uploadToCloudinary } from "../../../../utils/cloudinary";

export async function OPTIONS(request) {
  return handleOptions(request);
}

// GET all cars
export const GET = withAdmin(async (request) => {
  try {
    await dbConnect();

    const url = new URL(request.url);
    const searchParams = url.searchParams;

    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "12");
    const skip = (page - 1) * limit;

    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const year = searchParams.get("year") || "";
    const sort = searchParams.get("sort") || "newest";

    let query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { fullName: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }
    if (status) query.status = status;
    if (year) query.year = year;

    let sortObj = {};
    switch (sort) {
      case "newest":
        sortObj = { createdAt: -1 };
        break;
      case "oldest":
        sortObj = { createdAt: 1 };
        break;
      case "price_high":
        sortObj = { price: -1 };
        break;
      case "price_low":
        sortObj = { price: 1 };
        break;
      case "name_asc":
        sortObj = { name: 1 };
        break;
      case "name_desc":
        sortObj = { name: -1 };
        break;
      default:
        sortObj = { createdAt: -1 };
    }

    const total = await Car.countDocuments(query);
    const cars = await Car.find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(limit)
      .lean();

    return NextResponse.json(
      {
        success: true,
        data: cars,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      { status: 200, headers: corsHeaders(request) },
    );
  } catch (error) {
    console.error("GET cars error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch cars",
        details: error.message,
      },
      { status: 500, headers: corsHeaders(request) },
    );
  }
});
// POST create car
export const POST = withAdmin(async (request) => {
  try {
    await dbConnect();

    const formData = await request.formData();

    // Basic car data
    const carData = {
      name: formData.get("name") || "",
      fullName: formData.get("fullName") || "",
      year: formData.get("year") || "",
      price: parseFloat(formData.get("price") || "0"),
      range: formData.get("range") || "",
      acceleration: formData.get("acceleration") || "",
      topSpeed: formData.get("topSpeed") || "",
      battery: formData.get("battery") || "",
      charging: formData.get("charging") || "",
      seating: parseInt(formData.get("seating") || "5"),
      description: formData.get("description") || "",
      status: formData.get("status") || "available",
      isFeatured: formData.get("isFeatured") === "true",
      isAvailable: formData.get("isAvailable") !== "false",
      link: formData.get("link") || "",
      createdBy: request.userId,
    };

    // Parse features array
    const features = formData.get("features");
    if (features) {
      try {
        carData.features = JSON.parse(features);
      } catch (e) {
        carData.features = [];
      }
    }

    // Parse specifications (Map)
    const specifications = formData.get("specifications");
    if (specifications) {
      try {
        carData.specifications = JSON.parse(specifications);
      } catch (e) {
        carData.specifications = {};
      }
    }

    // Handle image uploads
    const imageFiles = formData.getAll("images");
    const uploadedImages = [];

    if (imageFiles && imageFiles.length > 0) {
      for (const file of imageFiles) {
        if (file.size > 0) {
          try {
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const base64String = `data:${file.type};base64,${buffer.toString("base64")}`;

            const result = await uploadToCloudinary(base64String, "cars");

            uploadedImages.push({
              url: result.url,
              publicId: result.public_id || "",
              isPrimary: uploadedImages.length === 0, // First image is primary
              caption:
                formData.get(`imageCaption_${uploadedImages.length}`) || "",
            });
          } catch (uploadError) {
            console.error("Image upload error:", uploadError);
          }
        }
      }
    }

    carData.images = uploadedImages;

    // Create and save the car
    const car = new Car(carData);
    await car.save();

    return NextResponse.json(
      {
        success: true,
        message: "Car created successfully",
        data: car,
      },
      { status: 201, headers: corsHeaders(request) },
    );
  } catch (error) {
    console.error("POST car error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create car",
        details: error.message,
      },
      { status: 500, headers: corsHeaders(request) },
    );
  }
});
