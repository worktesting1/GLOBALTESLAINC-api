// services/emailService.js
const transporter = require("../config/emailConfig");
const { generateKYCEmailTemplate } = require("../utils/emailTemplates");

async function sendKYCConfirmationEmail(userData) {
  try {
    const { email, name, kycId, idName, idNumber } = userData;

    const emailHtml = generateKYCEmailTemplate({
      name,
      kycId,
      submissionDate: new Date().toLocaleDateString(),
      idName,
      idNumber,
    });

    const mailOptions = {
      from: {
        name: "WealthGrower Finance",
        address: process.env.ADMIN_MAIL,
      },
      to: email,
      subject: "KYC Submission Confirmation - WealthGrower Finance",
      html: emailHtml,
      // Optional: Text version for email clients that don't support HTML
      text: `Dear ${name},\n\nThank you for submitting your KYC information. We have successfully received your documents and they are now under review.\n\nReference ID: ${kycId}\nSubmission Date: ${new Date().toLocaleDateString()}\nID Type: ${idName}\nID Number: ${idNumber}\nStatus: Pending Review\n\nOur verification team will review your submitted documents. This process typically takes 1-3 business days.\n\nBest regards,\nThe WealthGrower Finance Team`,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log("KYC confirmation email sent:", result.messageId);
    return result;
  } catch (error) {
    console.error("Error sending KYC confirmation email:", error);
    throw new Error("Failed to send confirmation email");
  }
}

module.exports = { sendKYCConfirmationEmail };
