// removeTTL-permanent.js - COMPLETE SOLUTION
const mongoose = require("mongoose");
require("dotenv").config();

async function removeAllTTL() {
  console.log(
    "🚨 WARNING: This will remove ALL TTL indexes from 'orders' collection",
  );
  console.log("📝 Orders will NO LONGER auto-delete based on expiresAt field");
  console.log("=".repeat(60));

  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URL, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log("✅ Connected to MongoDB");

    const collection = mongoose.connection.db.collection("orders");

    // Get all current indexes
    console.log("\n🔍 Fetching current indexes...");
    const indexes = await collection.indexes();

    // Find TTL indexes
    const ttlIndexes = indexes.filter(
      (index) => index.expireAfterSeconds !== undefined,
    );

    if (ttlIndexes.length === 0) {
      console.log(
        "\n✅ No TTL indexes found. Orders are already safe from auto-deletion.",
      );
      await mongoose.disconnect();
      process.exit(0);
    }

    // Show what we're about to remove
    console.log(`\n⚠️  Found ${ttlIndexes.length} TTL index(es):`);
    ttlIndexes.forEach((index, i) => {
      console.log(`\n${i + 1}. ${index.name}`);
      console.log(`   Field: ${JSON.stringify(index.key)}`);
      console.log(`   Deletes after: ${index.expireAfterSeconds} seconds`);
      console.log(`   (${Math.floor(index.expireAfterSeconds / 86400)} days)`);
    });

    // Ask for confirmation
    console.log("\n" + "=".repeat(60));
    console.log("❓ CONFIRMATION REQUIRED ❓");
    console.log("This will PERMANENTLY stop orders from auto-deleting.");
    console.log(
      "Type 'YES, REMOVE TTL' to proceed, or anything else to cancel.",
    );
    console.log("=".repeat(60));

    // Wait for user confirmation
    const readline = require("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question("> ", async (answer) => {
      if (answer === "YES, REMOVE TTL") {
        console.log("\n🚀 Removing TTL indexes...");

        // Remove each TTL index
        for (const index of ttlIndexes) {
          try {
            console.log(`\n🔄 Removing: ${index.name}...`);

            // Drop the TTL index
            await collection.dropIndex(index.name);
            console.log(`✅ Dropped TTL index: ${index.name}`);

            // OPTIONAL: Recreate as regular index (if you still want the index for queries)
            console.log(`🔄 Recreating as regular index...`);
            await collection.createIndex(index.key, {
              name: index.name,
              background: true,
            });
            console.log(`✅ Recreated as regular index: ${index.name}`);
          } catch (error) {
            console.log(
              `⚠️  Could not recreate ${index.name} as regular index: ${error.message}`,
            );
            console.log(
              `✅ TTL is still removed. Index may need manual recreation if needed for queries.`,
            );
          }
        }

        // Final verification
        console.log("\n" + "=".repeat(60));
        console.log("🔍 VERIFYING REMOVAL...");

        const finalIndexes = await collection.indexes();
        const remainingTTL = finalIndexes.filter(
          (idx) => idx.expireAfterSeconds !== undefined,
        );

        if (remainingTTL.length === 0) {
          console.log("🎉 SUCCESS! All TTL indexes removed.");
          console.log("📦 Orders will NO LONGER auto-delete.");
        } else {
          console.log(
            `⚠️  Warning: ${remainingTTL.length} TTL index(es) still exist`,
          );
          remainingTTL.forEach((idx) => {
            console.log(`   - ${idx.name} on ${JSON.stringify(idx.key)}`);
          });
        }

        // Show current index list
        console.log("\n📋 Current indexes on 'orders' collection:");
        finalIndexes.forEach((idx) => {
          const type =
            idx.expireAfterSeconds !== undefined
              ? " (TTL)"
              : idx.unique
                ? " (Unique)"
                : "";
          console.log(`   - ${idx.name} on ${JSON.stringify(idx.key)}${type}`);
        });

        // Count current orders (to verify nothing was deleted during this process)
        const orderCount = await collection.countDocuments();
        console.log(`\n📊 Total orders in database: ${orderCount}`);
      } else {
        console.log("\n❌ Operation cancelled. TTL indexes NOT removed.");
        console.log(
          "⚠️  Orders will continue to auto-delete based on expiresAt field.",
        );
      }

      rl.close();
      await mongoose.disconnect();
      console.log("\n📤 Disconnected from MongoDB");
      process.exit(0);
    });
  } catch (error) {
    console.error("\n❌ ERROR:", error.message);
    try {
      await mongoose.disconnect();
    } catch (e) {
      // Ignore disconnect error
    }
    process.exit(1);
  }
}

removeAllTTL();
