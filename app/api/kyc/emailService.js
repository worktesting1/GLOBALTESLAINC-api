import nodemailer from "nodemailer";
import { kycApprovedTemplate, kycRejectedTemplate } from "./emailTemplates";

export async function sendKYCApprovedEmail(kyc) {
  try {
    const transport = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: process.env.MAIL_PORT,
      secure: true,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASSWORD,
      },
    });

    const userMailOptions = {
      from: process.env.MAIL_USER,
      to: kyc.email,
      subject: "KYC Verification Approved - ",
      html: kycApprovedTemplate(kyc),
    };

    await transport.sendMail(userMailOptions);
    console.log("KYC approval email sent successfully");
  } catch (error) {
    console.error("Error sending KYC approval email:", error);
    throw error;
  }
}

export async function sendKYCRejectedEmail(kyc, reason = "") {
  try {
    const transport = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: process.env.MAIL_PORT,
      secure: true,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASSWORD,
      },
    });

    const userMailOptions = {
      from: process.env.MAIL_USER,
      to: kyc.email,
      subject: "KYC Verification Update - GlobalTeslaInc",
      html: kycRejectedTemplate(kyc, reason),
    };

    await transport.sendMail(userMailOptions);
    console.log("KYC rejection email sent successfully");
  } catch (error) {
    console.error("Error sending KYC rejection email:", error);
    throw error;
  }
}
