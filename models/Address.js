const mongoose = require("mongoose");

const AddressSchema = new mongoose.Schema(
  {
    walletAddress: { type: Array, default: [] },
    bankDetails: { type: Array, default: [{}] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("address", AddressSchema);
