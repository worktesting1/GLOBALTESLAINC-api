import Loan from "../../../models/Loan";
import nodemailer from "nodemailer";
import dbConnect from "../../../lib/mongodb";
import { NextResponse } from "next/server";
import { corsHeaders, handleOptions } from "../../../lib/cors";
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
      { status: 200, headers: corsHeaders(request) },
    );
  } catch (error) {
    console.error("Get loans error:", error);
    return NextResponse.json(
      { error: "Failed to fetch loans" },
      { status: 500, headers: corsHeaders(request) },
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
      { status: 201, headers: corsHeaders(request) },
    );
  } catch (error) {
    console.error("Create loan error:", error);
    return NextResponse.json(
      { error: "Failed to create loan" },
      { status: 500, headers: corsHeaders(request) },
    );
  }
}

function generateReferenceNumber() {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let referenceNumber = "WG";
  for (let i = 0; i < 10; i++) {
    referenceNumber += characters.charAt(
      Math.floor(Math.random() * characters.length),
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
const loanCreationEmailTemplate = (loan) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Loan Application Confirmation - WealthGrower Finance</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, Helvetica, sans-serif; background-color: #f8fafc; color: #333333; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <table width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc;">
    <tr>
      <td align="center" style="padding: 40px 15px;">
        <!-- Email Container -->
        <table width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);">
          <!-- Header -->
          <tr>
            <td style="background-color: #50626a; padding: 30px; text-align: center; border-bottom: 4px solid #3a4a52;">
              <a href="#" style="display: inline-block; color: #ffffff; font-size: 32px; font-weight: 700; text-decoration: none; letter-spacing: -0.5px;">
                WealthGrower
                <span style="display: block; font-size: 16px; font-weight: 400; margin-top: 8px; opacity: 0.9;">Finance Bank</span>
              </a>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="font-size: 20px; margin-bottom: 25px; color: #50626a; font-weight: 600;">Dear ${
                loan.firstName
              } ${loan.lastName},</h2>

              <p style="line-height: 1.7; margin-bottom: 25px; font-size: 16px; color: #555555;">
                Thank you for submitting your loan application. We have
                successfully received your application details and they are
                now under review by our credit team.
              </p>

              <div style="background-color: #f8f9fa; border-left: 5px solid #50626a; padding: 25px; margin: 30px 0; border-radius: 0 8px 8px 0;">
                <h3 style="margin-top: 0; color: #50626a; font-size: 18px; margin-bottom: 20px;">Loan Application Details</h3>

                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Reference Number:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">${
                    loan.referenceNumber
                  }</div>
                </div>

                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Loan Type:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">${
                    loan.loanType || "Personal Loan"
                  }</div>
                </div>

                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Amount Requested:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">$${
                    loan.amount || "0"
                  } USD</div>
                </div>

                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Loan Term:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">${
                    loan.term || "12"
                  } months</div>
                </div>

                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Application Date:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">
                    ${new Date().toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>

                <div style="display: inline-block; padding: 8px 16px; background-color: #fff3cd; color: #856404; border-radius: 6px; font-size: 14px; font-weight: 600; margin-top: 15px; border: 1px solid #ffeaa7;">
                  Status: Under Review
                </div>
              </div>

              <p style="line-height: 1.7; margin-bottom: 25px; font-size: 16px; color: #555555;">
                Our credit team will review your application within 1-2 business days.
                You will receive another email notification once your loan
                application has been processed and a decision has been made.
              </p>

              <div style="margin-top: 35px; padding-top: 25px; border-top: 1px solid #eaeaea;">
                <h3 style="color: #50626a; margin-bottom: 20px; font-size: 18px; font-weight: 600;">What to Expect Next</h3>
                <ul style="padding-left: 20px; margin: 0;">
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #555555; position: relative;">
                    Our credit team will review your application and documents
                  </li>
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #555555; position: relative;">
                    We'll verify your employment and income information
                  </li>
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #555555; position: relative;">
                    You'll receive a decision notification via email
                  </li>
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #555555; position: relative;">
                    If approved, funds will be disbursed to your account
                  </li>
                </ul>
              </div>

              <div style="background-color: #f0f7ff; padding: 20px; border-radius: 8px; margin-top: 25px; border: 1px solid #e1f0ff;">
                <h4 style="color: #50626a; margin-bottom: 10px; font-size: 16px;">Need Assistance?</h4>
                <p style="margin: 0; color: #555555; line-height: 1.6;">
                  If you have any questions about your loan application or need to
                  update your information, please contact our support team at
                  <a href="mailto:support@wealthgrowerfinance.org" style="color: #50626a; text-decoration: none; font-weight: 500;">support@wealthgrowerfinance.org</a>
                  or call us at +1 (555) 123-4567.
                </p>
              </div>

              <div style="background-color: #fff8e6; padding: 15px; border-radius: 6px; margin-top: 20px; font-size: 13px; color: #856404; border: 1px solid #ffeaa7;">
                <strong>Security Notice:</strong> For your protection, please
                do not share your reference number or personal information with
                anyone. WealthGrower Finance Bank will never ask for your
                password or sensitive information via email.
              </div>

              <p style="line-height: 1.7; margin-top: 25px; font-size: 16px; color: #555555;">
                Best regards,<br />
                <strong>The WealthGrower Finance Bank Team</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f5f7f9; padding: 30px; text-align: center; font-size: 14px; color: #666666; border-top: 1px solid #eaeaea;">
              <p style="margin: 0;">
                &copy; ${new Date().getFullYear()} WealthGrower Finance Bank. All rights reserved.
              </p>
              <div style="margin-top: 20px; line-height: 1.6;">
                <p style="margin: 0;">
                  WealthGrower Finance Bank | 123 Financial District, City, Country
                </p>
                <p style="margin: 0;">
                  Email:
                  <a href="mailto:support@wealthgrowerfinance.org" style="color: #50626a; text-decoration: none; font-weight: 500;">support@wealthgrowerfinance.org</a>
                  | Phone: +1 (555) 123-4567
                </p>
                <p style="margin-top: 15px; font-size: 12px; color: #888;">
                  This email was sent automatically. Please do not reply to this message.
                </p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
};

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
