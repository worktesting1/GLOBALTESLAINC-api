// app/api/cars/route.js
import { NextResponse } from "next/server";
import dbConnect from "../../../lib/mongodb";
import Car from "../../../models/Car";
import { corsHeaders, handleOptions } from "../../../lib/cors";

export async function OPTIONS(request) {
  return handleOptions(request);
}

export async function GET(request) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);

    // Pagination
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "12");
    const skip = (page - 1) * limit;

    // Filters
    const filters = {};

    // Status filter
    const status = searchParams.get("status");
    if (status) {
      filters.status = status;
    }

    // Availability filter
    const available = searchParams.get("available");
    if (available === "true") {
      filters.isAvailable = true;
    }

    // Featured filter
    const featured = searchParams.get("featured");
    if (featured === "true") {
      filters.isFeatured = true;
    }

    // Year filter
    const year = searchParams.get("year");
    if (year) {
      filters.year = year;
    }

    // Price range filter
    const priceRange = searchParams.get("price_range");
    if (priceRange) {
      if (priceRange.includes("-")) {
        const [min, max] = priceRange.split("-").map(Number);
        filters.price = { $gte: min, $lte: max };
      } else if (priceRange.endsWith("+")) {
        const min = parseInt(priceRange);
        filters.price = { $gte: min };
      }
    }

    // Search by name
    const search = searchParams.get("search");
    if (search) {
      filters.$or = [
        { name: { $regex: search, $options: "i" } },
        { fullName: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    // Sort
    const sort = searchParams.get("sort") || "newest";
    let sortQuery = {};

    switch (sort) {
      case "newest":
        sortQuery = { createdAt: -1 };
        break;
      case "oldest":
        sortQuery = { createdAt: 1 };
        break;
      case "price_low":
        sortQuery = { price: 1 };
        break;
      case "price_high":
        sortQuery = { price: -1 };
        break;
      case "name_asc":
        sortQuery = { name: 1 };
        break;
      case "name_desc":
        sortQuery = { name: -1 };
        break;
      default:
        sortQuery = { createdAt: -1 };
    }

    // Execute query
    const [cars, total] = await Promise.all([
      Car.find(filters).sort(sortQuery).skip(skip).limit(limit).lean(),
      Car.countDocuments(filters),
    ]);

    // Get available filters for frontend
    const availableYears = await Car.distinct("year", { isAvailable: true });
    const priceStats = await Car.aggregate([
      { $match: { isAvailable: true } },
      {
        $group: {
          _id: null,
          minPrice: { $min: "$price" },
          maxPrice: { $max: "$price" },
          avgPrice: { $avg: "$price" },
        },
      },
    ]);

    // Format response
    const formattedCars = cars.map((car) => ({
      id: car._id,
      name: car.name,
      fullName: car.fullName,
      year: car.year,
      price: car.price,
      priceDisplay: car.formattedPrice || `$${car.price.toLocaleString()}.00`,
      range: car.range,
      acceleration: car.acceleration,
      topSpeed: car.topSpeed,
      image: car.images?.[0]?.url || "",
      images: car.images || [],
      status: car.status,
      isFeatured: car.isFeatured,
      isAvailable: car.isAvailable,
      description: car.description,
      features: car.features || [],
      link: `/cars/${car._id}`,
      createdAt: car.createdAt,
    }));

    return NextResponse.json(
      {
        success: true,
        data: formattedCars,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
        filters: {
          availableYears: availableYears.sort((a, b) => b - a),
          priceRange: priceStats[0] || {
            minPrice: 0,
            maxPrice: 0,
            avgPrice: 0,
          },
          totalAvailable: await Car.countDocuments({ isAvailable: true }),
          totalFeatured: await Car.countDocuments({ isFeatured: true }),
        },
        currentFilters: {
          status,
          available,
          featured,
          year,
          price_range: priceRange,
          sort,
          search,
        },
      },
      {
        status: 200,
        headers: corsHeaders(request),
      },
    );
  } catch (error) {
    console.error("Get cars error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch cars",
        details: error.message,
      },
      {
        status: 500,
        headers: corsHeaders(request),
      },
    );
  }
}
