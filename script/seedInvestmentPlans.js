// scripts/seedInvestmentPlans.js
const mongoose = require("mongoose");
require("dotenv").config();

// Get your MongoDB URI
const MONGODB_URI = process.env.MONGO_URL || process.env.MONGODB_URI;

const investmentPlans = [
  // Featured Plans (3)
  {
    id: "21",
    name: "Tesla Growth Fund",
    category: "Tesla-Focused",
    riskLevel: "High",
    nav: 35.5,
    oneYearReturn: 9.23,
    minInvestment: 100,
    isFeatured: true,
    description:
      "High-growth investment fund focused on Tesla and related technologies. Ideal for investors seeking aggressive growth in the electric vehicle and renewable energy sectors.",
    features: [
      "Tesla-focused portfolio",
      "High growth potential",
      "Technology sector exposure",
      "EV and renewable energy focus",
      "Global market access",
    ],
    tags: ["tesla", "growth", "technology", "ev", "renewable"],
    investmentStrategy:
      "Growth-oriented, focusing on Tesla and related EV technologies with long-term capital appreciation",
    fundManager: "GlobalTesla Inc.",
    totalAssets: 15000000,
    expenseRatio: 0.75,
    dividendYield: 0.5,
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "22",
    name: "Sustainable Energy ETF",
    category: "ESG",
    riskLevel: "Medium",
    nav: 18.75,
    oneYearReturn: 5.42,
    minInvestment: 50,
    isFeatured: true,
    description:
      "Exchange-traded fund focusing on sustainable energy companies, including solar, wind, and other renewable energy sources. ESG compliant with rigorous screening.",
    features: [
      "ESG compliant portfolio",
      "Diversified renewable energy",
      "Sustainable focus",
      "Low expense ratio",
      "Monthly distributions",
    ],
    tags: ["esg", "renewable", "energy", "sustainable", "etf"],
    investmentStrategy:
      "Focus on companies with strong environmental, social, and governance practices in renewable energy",
    fundManager: "GlobalTesla Inc.",
    totalAssets: 8500000,
    expenseRatio: 0.45,
    dividendYield: 2.1,
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "25",
    name: "Aggressive Growth Fund",
    category: "Growth",
    riskLevel: "High",
    nav: 32.4,
    oneYearReturn: 12.85,
    minInvestment: 200,
    isFeatured: true,
    description:
      "High-risk, high-reward fund targeting aggressive growth through technology, innovation, and disruptive companies. Suitable for investors with high risk tolerance.",
    features: [
      "High growth potential",
      "Tech and innovation focus",
      "Disruptive companies",
      "Active management",
      "Global opportunities",
    ],
    tags: ["growth", "tech", "innovation", "aggressive", "disruptive"],
    investmentStrategy:
      "Aggressive growth through technology and innovation investments with high conviction picks",
    fundManager: "GlobalTesla Inc.",
    totalAssets: 12000000,
    expenseRatio: 0.85,
    dividendYield: 0.2,
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  // Additional Tesla-Focused Plans (2)
  {
    id: "26",
    name: "Tesla Innovation Fund",
    category: "Tesla-Focused",
    riskLevel: "High",
    nav: 28.9,
    oneYearReturn: 11.5,
    minInvestment: 150,
    isFeatured: false,
    description:
      "Focuses on Tesla's innovative technologies including autonomous driving, battery technology, and energy storage solutions.",
    features: [
      "Autonomous driving focus",
      "Battery tech investments",
      "Energy storage solutions",
      "High innovation exposure",
      "Research & development",
    ],
    tags: ["tesla", "innovation", "autonomous", "battery", "tech"],
    investmentStrategy:
      "Concentrated investment in Tesla's most innovative technologies and future growth areas",
    fundManager: "GlobalTesla Inc.",
    totalAssets: 9500000,
    expenseRatio: 0.8,
    dividendYield: 0.3,
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "27",
    name: "Tesla Global Expansion Fund",
    category: "Tesla-Focused",
    riskLevel: "Medium",
    nav: 24.3,
    oneYearReturn: 7.8,
    minInvestment: 300,
    isFeatured: false,
    description:
      "Invests in Tesla's international expansion into emerging markets and new geographic regions.",
    features: [
      "Global market expansion",
      "Emerging markets focus",
      "International growth",
      "Market penetration",
      "Geographic diversification",
    ],
    tags: ["tesla", "global", "expansion", "international", "markets"],
    investmentStrategy:
      "Focus on Tesla's international growth opportunities and market expansion strategies",
    fundManager: "GlobalTesla Inc.",
    totalAssets: 11000000,
    expenseRatio: 0.7,
    dividendYield: 1.2,
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  // ESG Plans (2 more)
  {
    id: "28",
    name: "Clean Technology Fund",
    category: "ESG",
    riskLevel: "Medium",
    nav: 21.8,
    oneYearReturn: 6.9,
    minInvestment: 250,
    isFeatured: false,
    description:
      "Invests in companies developing clean technology solutions for environmental challenges.",
    features: [
      "Clean tech focus",
      "Carbon reduction",
      "Water purification",
      "Waste management",
      "Environmental solutions",
    ],
    tags: ["esg", "clean-tech", "environment", "sustainable", "green"],
    investmentStrategy:
      "Targeted investment in companies providing solutions to environmental challenges",
    fundManager: "GlobalTesla Inc.",
    totalAssets: 12500000,
    expenseRatio: 0.6,
    dividendYield: 1.8,
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "29",
    name: "Social Impact Bond Fund",
    category: "ESG",
    riskLevel: "Low",
    nav: 16.5,
    oneYearReturn: 4.2,
    minInvestment: 500,
    isFeatured: false,
    description:
      "Social impact bonds focusing on community development, education, and healthcare initiatives.",
    features: [
      "Social impact focus",
      "Community development",
      "Education initiatives",
      "Healthcare projects",
      "Measurable outcomes",
    ],
    tags: ["esg", "social-impact", "community", "education", "healthcare"],
    investmentStrategy:
      "Investment in social impact bonds with measurable community benefits",
    fundManager: "GlobalTesla Inc.",
    totalAssets: 18000000,
    expenseRatio: 0.4,
    dividendYield: 3.5,
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  // Conservative Plans (3 more)
  {
    id: "30",
    name: "Conservative Bond Fund",
    category: "Conservative",
    riskLevel: "Low",
    nav: 10.45,
    oneYearReturn: 3.25,
    minInvestment: 750,
    isFeatured: false,
    description:
      "Low-risk bond fund focusing on government and high-quality corporate bonds for stable income.",
    features: [
      "Low risk profile",
      "Stable income",
      "Bond focused",
      "Capital preservation",
      "Regular distributions",
    ],
    tags: ["conservative", "bonds", "income", "stable", "retirement"],
    investmentStrategy:
      "Conservative allocation to government and investment-grade corporate bonds with income focus",
    fundManager: "GlobalTesla Inc.",
    totalAssets: 25000000,
    expenseRatio: 0.25,
    dividendYield: 3.8,
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "31",
    name: "Money Market Fund",
    category: "Conservative",
    riskLevel: "Low",
    nav: 1.0,
    oneYearReturn: 2.8,
    minInvestment: 1000,
    isFeatured: false,
    description:
      "Ultra-conservative money market fund providing liquidity and capital preservation.",
    features: [
      "Ultra-low risk",
      "High liquidity",
      "Capital preservation",
      "Daily liquidity",
      "Money market instruments",
    ],
    tags: ["conservative", "money-market", "liquidity", "preservation", "cash"],
    investmentStrategy:
      "Investment in high-quality, short-term money market instruments",
    fundManager: "GlobalTesla Inc.",
    totalAssets: 35000000,
    expenseRatio: 0.15,
    dividendYield: 2.8,
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "32",
    name: "Inflation-Protected Fund",
    category: "Conservative",
    riskLevel: "Low",
    nav: 13.2,
    oneYearReturn: 4.5,
    minInvestment: 600,
    isFeatured: false,
    description:
      "Protects against inflation through Treasury Inflation-Protected Securities (TIPS) and inflation-sensitive assets.",
    features: [
      "Inflation protection",
      "TIPS focused",
      "Real returns",
      "Purchasing power",
      "Inflation hedge",
    ],
    tags: ["conservative", "inflation", "tips", "protection", "real-returns"],
    investmentStrategy:
      "Allocation to inflation-protected securities and assets that benefit from inflation",
    fundManager: "GlobalTesla Inc.",
    totalAssets: 14000000,
    expenseRatio: 0.35,
    dividendYield: 3.2,
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  // Income Plans (3 more)
  {
    id: "33",
    name: "Conservative Income Fund",
    category: "Income",
    riskLevel: "Low",
    nav: 12.8,
    oneYearReturn: 4.12,
    minInvestment: 500,
    isFeatured: false,
    description:
      "Income-focused fund with conservative risk profile, ideal for retirees and investors seeking steady returns with low volatility.",
    features: [
      "Income focused",
      "Low volatility",
      "Dividend stocks",
      "Capital preservation",
      "Monthly income",
    ],
    tags: ["income", "conservative", "dividends", "retirement", "stable"],
    investmentStrategy:
      "Focus on dividend-paying stocks and fixed income securities for consistent income generation",
    fundManager: "GlobalTesla Inc.",
    totalAssets: 18000000,
    expenseRatio: 0.35,
    dividendYield: 4.2,
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "34",
    name: "Dividend Income Fund",
    category: "Income",
    riskLevel: "Medium",
    nav: 14.6,
    oneYearReturn: 6.32,
    minInvestment: 1000,
    isFeatured: false,
    description:
      "Fund focusing on high-dividend yielding stocks and REITs for consistent income generation with moderate growth potential.",
    features: [
      "High dividends",
      "Income generation",
      "Blue chip stocks",
      "REIT exposure",
      "Quarterly distributions",
    ],
    tags: ["dividend", "income", "stocks", "yield", "reits"],
    investmentStrategy:
      "Invest in companies with strong dividend histories and sustainable payouts across sectors",
    fundManager: "GlobalTesla Inc.",
    totalAssets: 9500000,
    expenseRatio: 0.55,
    dividendYield: 5.1,
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "35",
    name: "High Yield Bond Fund",
    category: "Income",
    riskLevel: "Medium",
    nav: 9.8,
    oneYearReturn: 7.5,
    minInvestment: 800,
    isFeatured: false,
    description:
      "Higher yielding bond fund focusing on corporate bonds with attractive yields and moderate risk.",
    features: [
      "Higher yields",
      "Corporate bonds",
      "Income focus",
      "Credit research",
      "Sector diversification",
    ],
    tags: ["income", "high-yield", "bonds", "corporate", "yield"],
    investmentStrategy:
      "Investment in higher-yielding corporate bonds with careful credit analysis",
    fundManager: "GlobalTesla Inc.",
    totalAssets: 13500000,
    expenseRatio: 0.5,
    dividendYield: 6.8,
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  // Growth Plans (3 more)
  {
    id: "36",
    name: "Technology Innovation Fund",
    category: "Growth",
    riskLevel: "High",
    nav: 29.7,
    oneYearReturn: 14.2,
    minInvestment: 250,
    isFeatured: false,
    description:
      "Focuses on innovative technology companies in artificial intelligence, cloud computing, and software.",
    features: [
      "AI and machine learning",
      "Cloud computing",
      "Software as a service",
      "Digital transformation",
      "Tech innovation",
    ],
    tags: ["growth", "technology", "innovation", "ai", "cloud"],
    investmentStrategy:
      "Targeted investment in innovative technology companies driving digital transformation",
    fundManager: "GlobalTesla Inc.",
    totalAssets: 10500000,
    expenseRatio: 0.85,
    dividendYield: 0.4,
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "37",
    name: "Healthcare Growth Fund",
    category: "Growth",
    riskLevel: "Medium",
    nav: 27.4,
    oneYearReturn: 8.9,
    minInvestment: 350,
    isFeatured: false,
    description:
      "Invests in innovative healthcare companies including biotech, pharmaceuticals, and medical technology.",
    features: [
      "Biotechnology",
      "Pharmaceuticals",
      "Medical devices",
      "Healthcare innovation",
      "Research focused",
    ],
    tags: ["growth", "healthcare", "biotech", "pharma", "medical"],
    investmentStrategy:
      "Growth through investment in innovative healthcare companies and medical breakthroughs",
    fundManager: "GlobalTesla Inc.",
    totalAssets: 12500000,
    expenseRatio: 0.75,
    dividendYield: 1.2,
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "38",
    name: "Global Growth Fund",
    category: "Growth",
    riskLevel: "Medium",
    nav: 19.8,
    oneYearReturn: 8.91,
    minInvestment: 400,
    isFeatured: false,
    description:
      "Diversified global growth fund investing in international markets for geographic diversification and emerging market opportunities.",
    features: [
      "Global diversification",
      "Growth focus",
      "Emerging markets",
      "Currency hedging",
      "Sector rotation",
    ],
    tags: ["global", "growth", "international", "diversified", "emerging"],
    investmentStrategy:
      "Global growth through diversified international market exposure with active country allocation",
    fundManager: "GlobalTesla Inc.",
    totalAssets: 14500000,
    expenseRatio: 0.75,
    dividendYield: 1.5,
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  // Balanced Plans (2 more)
  {
    id: "39",
    name: "ESG Balanced Fund",
    category: "Balanced",
    riskLevel: "Medium",
    nav: 22.15,
    oneYearReturn: 7.45,
    minInvestment: 150,
    isFeatured: false,
    description:
      "Balanced fund with ESG focus, combining growth and income with sustainable investing principles across asset classes.",
    features: [
      "ESG focus",
      "Balanced allocation",
      "Sustainable growth",
      "Risk management",
      "Diversified portfolio",
    ],
    tags: ["esg", "balanced", "sustainable", "diversified", "growth-income"],
    investmentStrategy:
      "Balanced approach combining growth and income with ESG screening across equities and bonds",
    fundManager: "GlobalTesla Inc.",
    totalAssets: 11000000,
    expenseRatio: 0.65,
    dividendYield: 2.8,
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "40",
    name: "Retirement Target Date 2040",
    category: "Balanced",
    riskLevel: "Medium",
    nav: 18.9,
    oneYearReturn: 6.8,
    minInvestment: 200,
    isFeatured: false,
    description:
      "Target-date retirement fund that automatically adjusts asset allocation as investors approach retirement.",
    features: [
      "Target date 2040",
      "Automatic rebalancing",
      "Glide path",
      "Retirement focused",
      "Age-based allocation",
    ],
    tags: ["balanced", "retirement", "target-date", "2040", "glide-path"],
    investmentStrategy:
      "Automatically adjusting asset allocation based on time to retirement",
    fundManager: "GlobalTesla Inc.",
    totalAssets: 19500000,
    expenseRatio: 0.45,
    dividendYield: 2.5,
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  // Additional Plans (2 more)
  {
    id: "41",
    name: "Real Estate Income Fund",
    category: "Income",
    riskLevel: "Medium",
    nav: 16.3,
    oneYearReturn: 5.9,
    minInvestment: 700,
    isFeatured: false,
    description:
      "Invests in commercial real estate and REITs for stable income and property appreciation.",
    features: [
      "Commercial real estate",
      "REIT investments",
      "Property income",
      "Real estate exposure",
      "Rental yields",
    ],
    tags: ["income", "real-estate", "reits", "property", "commercial"],
    investmentStrategy:
      "Income generation through commercial real estate investments and REITs",
    fundManager: "GlobalTesla Inc.",
    totalAssets: 16500000,
    expenseRatio: 0.6,
    dividendYield: 4.8,
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "42",
    name: "Tesla Retirement Fund",
    category: "Conservative",
    riskLevel: "Low",
    nav: 15.2,
    oneYearReturn: 4.85,
    minInvestment: 250,
    isFeatured: false,
    description:
      "Conservative fund designed for retirement planning with moderate Tesla-related exposure. Focus on capital preservation with growth potential.",
    features: [
      "Retirement focus",
      "Conservative growth",
      "Tesla exposure",
      "Long-term focus",
      "Automatic rebalancing",
    ],
    tags: ["retirement", "conservative", "tesla", "long-term", "target-date"],
    investmentStrategy:
      "Conservative allocation with moderate Tesla exposure and glide path for retirement planning",
    fundManager: "GlobalTesla Inc.",
    totalAssets: 22000000,
    expenseRatio: 0.3,
    dividendYield: 3.2,
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

async function seedInvestmentPlans() {
  try {
    console.log("🔍 Connecting to database...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Define the InvestmentPlan schema
    const InvestmentPlanSchema = new mongoose.Schema({
      id: { type: String, required: true, unique: true },
      name: { type: String, required: true },
      category: { type: String, required: true },
      riskLevel: { type: String, required: true },
      nav: { type: Number, required: true },
      oneYearReturn: { type: Number, required: true },
      minInvestment: { type: Number, required: true },
      isFeatured: { type: Boolean, default: false },
      description: { type: String, required: true },
      features: [{ type: String }],
      tags: [{ type: String }],
      investmentStrategy: String,
      fundManager: String,
      totalAssets: Number,
      expenseRatio: Number,
      dividendYield: Number,
      status: { type: String, default: "active" },
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
    });

    // Add indexes
    InvestmentPlanSchema.index({ category: 1 });
    InvestmentPlanSchema.index({ riskLevel: 1 });
    InvestmentPlanSchema.index({ isFeatured: 1 });
    InvestmentPlanSchema.index({ id: 1 });

    const InvestmentPlan =
      mongoose.models.InvestmentPlan ||
      mongoose.model("InvestmentPlan", InvestmentPlanSchema);

    console.log("\n📝 Seeding investment plans...");

    let seededCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    for (const plan of investmentPlans) {
      try {
        const result = await InvestmentPlan.findOneAndUpdate(
          { id: plan.id },
          plan,
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
            runValidators: true,
          },
        );

        if (result.$isNew) {
          console.log(
            `✅ Created: ${plan.name} (ID: ${plan.id}) - ${plan.category}`,
          );
          seededCount++;
        } else {
          console.log(
            `🔄 Updated: ${plan.name} (ID: ${plan.id}) - ${plan.category}`,
          );
          updatedCount++;
        }
      } catch (err) {
        console.log(`❌ Error: ${plan.name} (ID: ${plan.id}) - ${err.message}`);
        errorCount++;
      }
    }

    console.log(`\n📊 Seeding Summary:`);
    console.log(`   ✅ Created: ${seededCount} plans`);
    console.log(`   🔄 Updated: ${updatedCount} plans`);
    console.log(`   ❌ Errors: ${errorCount} plans`);
    console.log(`   📋 Total Processed: ${investmentPlans.length} plans`);

    // Get total count
    const totalCount = await InvestmentPlan.countDocuments();
    console.log(`\n🏦 Total in database: ${totalCount} investment plans`);

    // Get category statistics
    const categories = await InvestmentPlan.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    console.log("\n📊 Category Statistics:");
    categories.forEach((cat) => {
      console.log(`   📈 ${cat._id}: ${cat.count} plans`);
    });

    // Get featured plans
    const featuredPlans = await InvestmentPlan.find(
      { isFeatured: true },
      { name: 1, category: 1, nav: 1 },
    );
    console.log(`\n⭐ Featured Plans (${featuredPlans.length}):`);
    featuredPlans.forEach((plan) => {
      console.log(`   ⭐ ${plan.name} - NAV: $${plan.nav} - ${plan.category}`);
    });

    // Get risk level statistics
    const riskLevels = await InvestmentPlan.aggregate([
      { $group: { _id: "$riskLevel", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    console.log("\n📈 Risk Level Distribution:");
    riskLevels.forEach((risk) => {
      console.log(`   ${risk._id}: ${risk.count} plans`);
    });

    // Get NAV range
    const navStats = await InvestmentPlan.aggregate([
      {
        $group: {
          _id: null,
          minNAV: { $min: "$nav" },
          maxNAV: { $max: "$nav" },
          avgNAV: { $avg: "$nav" },
        },
      },
    ]);

    if (navStats[0]) {
      console.log("\n💰 NAV Statistics:");
      console.log(`   📉 Minimum NAV: $${navStats[0].minNAV.toFixed(2)}`);
      console.log(`   📈 Maximum NAV: $${navStats[0].maxNAV.toFixed(2)}`);
      console.log(`   📊 Average NAV: $${navStats[0].avgNAV.toFixed(2)}`);
    }

    // Get min investment range
    const minInvestmentStats = await InvestmentPlan.aggregate([
      {
        $group: {
          _id: null,
          minInvestmentMin: { $min: "$minInvestment" },
          minInvestmentMax: { $max: "$minInvestment" },
          minInvestmentAvg: { $avg: "$minInvestment" },
        },
      },
    ]);

    if (minInvestmentStats[0]) {
      console.log("\n💵 Minimum Investment Range:");
      console.log(`   💰 Lowest: $${minInvestmentStats[0].minInvestmentMin}`);
      console.log(`   💰 Highest: $${minInvestmentStats[0].minInvestmentMax}`);
      console.log(
        `   💰 Average: $${Math.round(minInvestmentStats[0].minInvestmentAvg)}`,
      );
    }

    // Verify sample plans
    console.log("\n🔍 Sample Plan Verification:");
    const sampleIds = ["21", "22", "25", "30", "42"];
    for (const sampleId of sampleIds) {
      const plan = await InvestmentPlan.findOne({ id: sampleId });
      if (plan) {
        console.log(
          `   ✅ ID ${sampleId}: ${plan.name} - $${plan.nav} (${plan.riskLevel}) ${plan.isFeatured ? "⭐" : ""}`,
        );
      } else {
        console.log(`   ❌ ID ${sampleId}: Not found`);
      }
    }

    // List all plans with IDs
    console.log("\n📋 All Plans with IDs:");
    const allPlans = await InvestmentPlan.find(
      {},
      { id: 1, name: 1, category: 1, riskLevel: 1, isFeatured: 1 },
    ).sort({ id: 1 });
    allPlans.forEach((plan) => {
      console.log(
        `   ID ${plan.id}: ${plan.name} - ${plan.category} - ${plan.riskLevel} ${plan.isFeatured ? "⭐" : ""}`,
      );
    });

    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
    console.log("\n🎉 Investment plans seeding completed successfully!");
    console.log("\n👉 Next steps:");
    console.log("   1. Visit your Investment Plans page to see the data");
    console.log("   2. Test filtering by category and risk level");
    console.log("   3. Verify featured plans are displayed correctly");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding investment plans:", error);
    process.exit(1);
  }
}

// Run the seed function
seedInvestmentPlans();
