// checkTTL.js - FIXED
const mongoose = require("mongoose");
require("dotenv").config();

async function checkTTL() {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log("✅ Connected to MongoDB");

    // Get the collection
    const collection = mongoose.connection.db.collection("orders");

    // Get all indexes on orders collection
    const indexes = await collection.indexes();

    console.log("\n📋 All indexes on 'orders' collection:");
    console.log(JSON.stringify(indexes, null, 2));

    // Check for TTL indexes
    let hasTTL = false;
    indexes.forEach((index, i) => {
      if (index.expireAfterSeconds !== undefined) {
        console.log(`\n🚨 FOUND TTL INDEX #${i}:`);
        console.log(`   Name: ${index.name}`);
        console.log(`   Field: ${JSON.stringify(index.key)}`);
        console.log(`   Expires after: ${index.expireAfterSeconds} seconds`);
        hasTTL = true;
      }
    });

    if (!hasTTL) {
      console.log("\n✅ No TTL indexes found");
    }

    // Count orders
    const orderCount = await collection.countDocuments();
    console.log(`\n📊 Total orders in database: ${orderCount}`);

    // Count expired orders
    const expiredCount = await collection.countDocuments({
      expiresAt: { $lt: new Date() },
    });
    console.log(`📊 Expired orders (expiresAt < now): ${expiredCount}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

checkTTL();
