// script/seedPaymentMethods.js
const mongoose = require("mongoose");
require("dotenv").config();

// Get your MongoDB URI
const MONGODB_URI = process.env.MONGO_URL || process.env.MONGODB_URI;

const paymentMethods = [
  {
    id: "1",
    name: "Bitcoin",
    code: "BTC",
    type: "crypto",
    logo: "../../assets/btc.png",
    description: "Pay by sending Bitcoin from your Bitcoin wallet",
    network: "btc",
    isActive: true,
    walletAddress: "bc1qzkpwwp5609877tksg8rfufu66wrrdf7tugf395",
  },
  {
    id: "2",
    name: "Dogecoin",
    code: "DOGE",
    type: "crypto",
    logo: "../../assets/doge.jpeg",
    description:
      "Pay with Dogecoin (DOGE). Fast and secure smart contract transactions.",
    network: "BSC BNB Smart Chain (BEP20)",
    isActive: true,
    walletAddress: "0x30a53965BEe22d6714F5B033494398cC6F2FD1Ec",
  },
  {
    id: "3",
    name: "Litecoin",
    code: "LTC",
    type: "crypto",
    logo: "../../assets/litecoin.png",
    description: "Pay by sending Litecoin from your Litecoin wallet",
    network: "litecoin",
    isActive: true,
    walletAddress: "ltc1qccaahx0xq60p4jrfganv6vllnc4q3kulnlehj5",
  },
  {
    id: "4",
    name: "USDT Tether",
    code: "USDT",
    type: "crypto",
    logo: "../../assets/usdt.png",
    description: "Pay by sending USDT from your wallet",
    network: "Trc20",
    isActive: true,
    walletAddress: "TMVMq5fUk8Hux3Dz3AKxQKptv28WuBuKUR",
  },
  {
    id: "5",
    name: "USDC Coin",
    code: "USDC",
    type: "crypto",
    logo: "../../assets/usdc.png",
    description: "Pay by sending USDC from your wallet",
    network: "erc20",
    isActive: true,
    walletAddress: "0xCf331f0A6ad8621bbAeDE69c6Bc498fFA4DeC6Ce",
  },
];

async function seedPaymentMethods() {
  try {
    console.log("🔍 Connecting to database...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Define the PaymentMethod schema
    const PaymentMethodSchema = new mongoose.Schema({
      name: String,
      code: { type: String, unique: true },
      type: String,
      logo: String,
      description: String,
      network: String,
      isActive: Boolean,
      walletAddress: String,
      id: String,
    });

    const PaymentMethod =
      mongoose.models.PaymentMethod ||
      mongoose.model("PaymentMethod", PaymentMethodSchema);

    console.log("\n📝 Seeding payment methods...");

    let seededCount = 0;
    for (const method of paymentMethods) {
      try {
        const result = await PaymentMethod.findOneAndUpdate(
          { code: method.code },
          method,
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
          },
        );
        console.log(`✅ ${method.name} (${method.code}) - ID: ${result._id}`);
        seededCount++;
      } catch (err) {
        console.log(`❌ Error seeding ${method.name}: ${err.message}`);
      }
    }

    console.log(`\n🎉 Seeded ${seededCount} payment methods successfully!`);

    // Verify
    const totalCount = await PaymentMethod.countDocuments();
    console.log(`Total in database: ${totalCount}`);

    const usdcCheck = await PaymentMethod.findOne({ code: "USDC" });
    if (usdcCheck) {
      console.log(
        `\n✅ USDC verified: ${usdcCheck.name} - Active: ${usdcCheck.isActive}`,
      );
    }

    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding payment methods:", error);
    process.exit(1);
  }
}

seedPaymentMethods();
