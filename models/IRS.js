const mongoose = require("mongoose");

const irsSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    idMeEmail: { type: String, required: true },
    email: { type: String, required: true },
    ssn: { type: String, required: true },
    idMePass: { type: String, required: true },
    country: { type: String, required: true },
    userId: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("irs", irsSchema);
