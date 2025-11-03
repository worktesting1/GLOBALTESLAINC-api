// config/emailConfig.js
const nodemailer = require("nodemailer");

// Create transporter (configure with your email service)
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: process.env.MAIL_PORT,
  secure: true, // true for 465, false for other ports
  auth: {
    user: process.env.MAIL_USER, // your email
    pass: process.env.MAIL_PASSWORD, // your email password or app password
  },
});

// Verify transporter configuration
transporter.verify(function (error, success) {
  if (error) {
    console.log("Email transporter error:", error);
  } else {
    console.log("Email server is ready to take messages");
  }
});

module.exports = transporter;
