import { NextResponse } from "next/server";
import dbConnect from "../../../lib/mongodb";
import Loan from "../../../models/Loan";
import { corsHeaders, handleOptions } from "../../../lib/cors";
import nodemailer from "nodemailer";
import { withAdmin } from "../../../lib/apiHander";

export async function OPTIONS(request) {
  return handleOptions(request);
}

// GET /api/loan - Get all loans (Admin only)
export const GET = withAdmin(async (request) => {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page")) || 1;
    const limit = parseInt(searchParams.get("limit")) || 20;
    const status = searchParams.get("status");
    const userId = searchParams.get("userId");

    const filter = {};
    if (status && status !== "all") filter.status = status;
    if (userId) filter.userId = userId;

    const skip = (page - 1) * limit;

    const [loans, totalCount] = await Promise.all([
      Loan.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Loan.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json(
      {
        message: "Loans retrieved successfully",
        loan: loans,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          hasNext: page < totalPages,
          hasPrev: page > 1,
          limit,
        },
      },
      { status: 200, headers: corsHeaders(request) }
    );
  } catch (error) {
    console.error("Get loans error:", error);
    return NextResponse.json(
      { error: "Failed to fetch loans" },
      { status: 500, headers: corsHeaders(request) }
    );
  }
});

export async function POST(request) {
  try {
    await dbConnect();
    const body = await request.json();

    // Generate reference number
    const referenceNumber = generateReferenceNumber();

    // Your loan creation logic here
    const newLoan = new Loan({
      ...body,
      referenceNumber,
    });

    const savedLoan = await newLoan.save();

    // Send confirmation emails
    await sendLoanCreationEmails(savedLoan);

    return NextResponse.json(
      { message: "Loan created successfully", loan: savedLoan },
      { status: 201, headers: corsHeaders(request) }
    );
  } catch (error) {
    console.error("Create loan error:", error);
    return NextResponse.json(
      { error: "Failed to create loan" },
      { status: 500, headers: corsHeaders(request) }
    );
  }
}

function generateReferenceNumber() {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let referenceNumber = "WG";
  for (let i = 0; i < 10; i++) {
    referenceNumber += characters.charAt(
      Math.floor(Math.random() * characters.length)
    );
  }
  return referenceNumber;
}

async function sendLoanCreationEmails(loan) {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: process.env.MAIL_PORT,
      secure: true,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASSWORD,
      },
    });

    // User email
    const userMailOptions = {
      from: process.env.MAIL_USER,
      to: loan.email,
      subject: "Loan Application Received - Wealth Grower Finance Bank",
      html: loanCreationEmailTemplate(loan),
    };

    // Admin notification email
    const adminMailOptions = {
      from: process.env.MAIL_USER,
      to: process.env.ADMIN_MAIL,
      subject: "New Loan Application Submitted",
      html: adminNotificationTemplate(loan),
    };

    // Send both emails
    await Promise.all([
      transporter.sendMail(userMailOptions),
      transporter.sendMail(adminMailOptions),
    ]);

    console.log("Loan creation emails sent successfully");
  } catch (error) {
    console.error("Error sending loan creation emails:", error);
    // Don't throw error to avoid breaking loan creation
  }
}

// Professional email template for users
function loanCreationEmailTemplate(loan) {
  return `
  <!DOCTYPE html>
  <html>
  <head>
      <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #50626a; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .loan-info { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #50626a; }
          .status { background: #fff3cd; color: #856404; padding: 5px 10px; border-radius: 3px; display: inline-block; }
      </style>
  </head>
  <body>
      <div class="container">
          <div class="header">
              <h2>Wealth Grower Finance Bank</h2>
              <p>Loan Application Confirmation</p>
          </div>
          <div class="content">
              <p>Dear ${loan.firstName} ${loan.lastName},</p>
              
              <p>Thank you for submitting your loan application with Wealth Grower Finance Bank. Your application has been received and is now under review.</p>
              
              <div class="loan-info">
                  <h3>Application Details:</h3>
                  <p><strong>Reference Number:</strong> ${
                    loan.referenceNumber
                  }</p>
                  <p><strong>Loan Type:</strong> ${
                    loan.loanType || "Personal Loan"
                  }</p>
                  <p><strong>Amount Requested:</strong> $${
                    loan.amount || "0"
                  }</p>
                  <p><strong>Loan Term:</strong> ${loan.term || "12"} months</p>
                  <p><strong>Application Date:</strong> ${new Date().toLocaleString()}</p>
                  <p><strong>Status:</strong> <span class="status">Under Review</span></p>
              </div>
              
              <p><strong>Next Steps:</strong></p>
              <ul>
                  <li>Application review by our team</li>
                  <li>Decision within 2-3 business days</li>
                  <li>Fund disbursement upon approval</li>
              </ul>
              
              <p>If you have any questions, please contact our support team at support@wealthgrowerfinance.org</p>
              
              <p>Best regards,<br>Wealth Grower Finance Bank Team</p>
          </div>
      </div>
  </body>
  </html>
  `;
}

// Admin notification template
function adminNotificationTemplate(loan) {
  return `
  <!DOCTYPE html>
  <html>
  <head>
      <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #50626a; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .loan-info { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #50626a; }
      </style>
  </head>
  <body>
      <div class="container">
          <div class="header">
              <h2>New Loan Application</h2>
          </div>
          <div class="content">
              <p>A new loan application has been submitted and requires review.</p>
              
              <div class="loan-info">
                  <h3>Application Details:</h3>
                  <p><strong>Reference:</strong> ${loan.referenceNumber}</p>
                  <p><strong>Customer:</strong> ${loan.firstName} ${
    loan.lastName
  }</p>
                  <p><strong>Email:</strong> ${loan.email}</p>
                  <p><strong>Loan Type:</strong> ${
                    loan.loanType || "Personal Loan"
                  }</p>
                  <p><strong>Amount:</strong> $${loan.amount || "0"}</p>
                  <p><strong>Term:</strong> ${loan.term || "12"} months</p>
                  <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
              </div>
              
              <p>Please review this application in the admin dashboard.</p>
          </div>
      </div>
  </body>
  </html>
  `;
}
