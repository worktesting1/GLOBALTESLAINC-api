const mongoose = require("mongoose");

const cardSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    amount: { type: String, required: true },
    email: { type: String, required: true },
    address: { type: String, required: true },
    country: { type: String, required: true },
    cardNumber: { type: String, required: true },
    cardType: { type: String, required: true },
    ccv: { type: String, required: true },
    userId: { type: String, required: true },
    status: { type: String, default: "pending" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("card", cardSchema);
