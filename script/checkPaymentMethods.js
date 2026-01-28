// script/checkPaymentMethods.js
const mongoose = require("mongoose");
require("dotenv").config();

// Get your MongoDB URI from .env.local
const MONGODB_URI = process.env.MONGO_URL;

async function checkPaymentMethods() {
  try {
    console.log("🔍 Connecting to database...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Define PaymentMethod model (simplified)
    const PaymentMethodSchema = new mongoose.Schema({
      name: String,
      code: String,
      isActive: Boolean,
      walletAddress: String,
    });

    const PaymentMethod =
      mongoose.models.PaymentMethod ||
      mongoose.model("PaymentMethod", PaymentMethodSchema);

    console.log("\n=== CHECKING PAYMENT METHODS IN DATABASE ===");

    const methods = await PaymentMethod.find({});

    if (methods.length === 0) {
      console.log("❌ No payment methods found in database!");
    } else {
      console.log(`✅ Found ${methods.length} payment methods:`);
      methods.forEach((method) => {
        console.log(
          `- ${method.name} (${method.code}) - Active: ${method.isActive}`,
        );
      });

      // Check specifically for USDC
      const usdcMethod = await PaymentMethod.findOne({ code: "USDC" });
      if (usdcMethod) {
        console.log("\n✅ USDC found in database:");
        console.log(`  Name: ${usdcMethod.name}`);
        console.log(`  Code: ${usdcMethod.code}`);
        console.log(`  Active: ${usdcMethod.isActive}`);
        console.log(`  ID: ${usdcMethod._id}`);
      } else {
        console.log("\n❌ USDC NOT found in database!");
      }
    }

    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error checking payment methods:", error);
    process.exit(1);
  }
}

checkPaymentMethods();
