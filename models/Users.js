import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    country: {
      type: String,
      required: true,
    },
    phone: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    confirmpassword: { type: String, required: true },
    isAdmin: { type: Boolean, default: false },
    status: { type: String, default: false },
    resetToken: { type: String, default: null },
    resetTokenExpiry: { type: Date, default: null },
    gender: { type: String, default: null },
    state: { type: String, default: null },
    zipCode: { type: String, default: null },
    address: { type: String, default: null },
    age: { type: String, default: null },
    maritalstatus: { type: String, default: null },
    dob: { type: String, default: null },
    bonus: { type: Number, default: 0 },
    profit: { type: Number, default: 0 },
    transferStep: { type: Number, default: 1 },
    userOtp: { type: Number },
    otpMessage: { type: String, default: "" },
    cardIssuing: { type: Boolean, default: false },
    cardAmount: { type: String, default: "1000" },
    profileImage: { type: Array, default: [] },
    firstCode: {
      type: String,
      default: "12345",
    },
    firstMessage: { type: String, default: "First Message" },
    secondCode: {
      type: String,
      default: "12345",
    },
    secondMessage: { type: String, default: "Second Message" },
    thirdCode: {
      type: String,
      default: "12345",
    },
    thirdMessage: { type: String, default: "Third Message" },
    forthCode: {
      type: String,
      default: "12345",
    },
    forthMessage: { type: String, default: "Fourth Message" },
  },
  { timestamps: true },
);

// Prevent model overwrite in development
export default mongoose.models.User || mongoose.model("User", userSchema);
