// app/api/admin/cars/stats/route.js
import { NextResponse } from "next/server";
import dbConnect from "../../../../../lib/mongodb";
import Car from "../../../../../models/Car";
import { withAdmin } from "../../../../../lib/apiHander";
import { corsHeaders, handleOptions } from "../../../../../lib/cors";

export async function OPTIONS(request) {
  return handleOptions(request);
}

export const GET = withAdmin(async (request) => {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "7d";

    // Calculate date range
    const now = new Date();
    let startDate = new Date();

    switch (range) {
      case "7d":
        startDate.setDate(now.getDate() - 7);
        break;
      case "30d":
        startDate.setDate(now.getDate() - 30);
        break;
      case "90d":
        startDate.setDate(now.getDate() - 90);
        break;
      case "1y":
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate = new Date(0); // All time
    }

    // Get all cars
    const cars = await Car.find({
      createdAt: { $gte: startDate },
    }).lean();

    // Calculate overview stats
    const totalCars = cars.length;
    const availableCars = cars.filter((c) => c.status === "available").length;
    const soldThisMonth = cars.filter(
      (c) =>
        c.status === "sold-out" &&
        new Date(c.updatedAt).getMonth() === now.getMonth(),
    ).length;

    const monthlyRevenue = cars
      .filter(
        (c) =>
          c.status === "sold-out" &&
          new Date(c.updatedAt).getMonth() === now.getMonth(),
      )
      .reduce((sum, c) => sum + (c.price || 0), 0);

    const totalViews = cars.reduce((sum, c) => sum + (c.views || 0), 0);
    const totalClicks = cars.reduce((sum, c) => sum + (c.clicks || 0), 0);
    const engagementRate =
      totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(1) : 0;

    // Generate sample data for charts (replace with real data)
    const salesTrend = Array.from({ length: 7 }, (_, i) => ({
      date: new Date(
        Date.now() - (6 - i) * 24 * 60 * 60 * 1000,
      ).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      sold: Math.floor(Math.random() * 10) + 1,
      reserved: Math.floor(Math.random() * 5) + 1,
    }));

    const inventoryDistribution = [
      { name: "Available", value: availableCars },
      {
        name: "Sold Out",
        value: cars.filter((c) => c.status === "sold-out").length,
      },
      {
        name: "Reserved",
        value: cars.filter((c) => c.status === "reserved").length,
      },
      { name: "Featured", value: cars.filter((c) => c.isFeatured).length },
    ];

    const topModels = [
      { model: "Model X", views: 1250, clicks: 230, sales: 12 },
      { model: "Model 3", views: 980, clicks: 180, sales: 8 },
      { model: "Model S", views: 750, clicks: 120, sales: 5 },
      { model: "Model Y", views: 620, clicks: 95, sales: 4 },
    ];

    const priceDistribution = [
      { range: "$50-75K", count: Math.floor(Math.random() * 10) + 5 },
      { range: "$75-100K", count: Math.floor(Math.random() * 8) + 3 },
      { range: "$100-125K", count: Math.floor(Math.random() * 6) + 2 },
      { range: "$125K+", count: Math.floor(Math.random() * 4) + 1 },
    ];

    const monthlyPerformance = [
      { month: "Jan", revenue: 450000, carsSold: 18 },
      { month: "Feb", revenue: 520000, carsSold: 21 },
      { month: "Mar", revenue: 480000, carsSold: 19 },
      { month: "Apr", revenue: 600000, carsSold: 24 },
      { month: "May", revenue: 550000, carsSold: 22 },
      { month: "Jun", revenue: 650000, carsSold: 26 },
    ];

    const insights = [
      {
        type: "positive",
        title: "High Demand for Model X",
        description:
          "Model X has seen a 45% increase in views this month, indicating strong market interest.",
        impact: "High",
        date: "Today",
      },
      {
        type: "warning",
        title: "Low Inventory Alert",
        description:
          "Only 3 Model S units available. Consider restocking soon.",
        impact: "Medium",
        date: "2 days ago",
      },
      {
        type: "positive",
        title: "Featured Cars Performance",
        description:
          "Featured cars receive 3x more clicks than non-featured ones.",
        impact: "High",
        date: "1 week ago",
      },
    ];

    const recentActivity = [
      {
        type: "sale",
        carName: "Model X Plaid",
        description: " was sold to a new customer",
        time: "2 hours ago",
      },
      {
        type: "view",
        carName: "Model 3",
        description: " received 150 views today",
        time: "5 hours ago",
      },
      {
        type: "upload",
        carName: "New Model Y",
        description: " was added to inventory",
        time: "Yesterday",
      },
    ];

    return NextResponse.json(
      {
        overview: {
          totalCars,
          availableCars,
          soldThisMonth,
          monthlyRevenue,
          monthlyGrowth: Math.floor(Math.random() * 20) + 5,
          salesGrowth: Math.floor(Math.random() * 30) + 10,
          revenueGrowth: Math.floor(Math.random() * 25) + 8,
          totalViews,
          viewChange: Math.floor(Math.random() * 15) - 5,
          engagementRate,
          engagementChange: Math.floor(Math.random() * 10) + 2,
        },
        salesTrend,
        inventoryDistribution,
        topModels,
        priceDistribution,
        monthlyPerformance,
        insights,
        recentActivity,
      },
      {
        status: 200,
        headers: corsHeaders(request),
      },
    );
  } catch (error) {
    console.error("Stats error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch statistics",
        details: error.message,
      },
      {
        status: 500,
        headers: corsHeaders(request),
      },
    );
  }
});
