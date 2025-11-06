import { NextResponse } from "next/server";
import dbConnect from "../../../../lib/mongodb";
import Loan from "../../../../models/Loan";
import Wallet from "../../../../models/Wallet";
import { withAuth, withAdmin } from "../../../../lib/apiHander";
import { corsHeaders, handleOptions } from "../../../../lib/cors";
import nodemailer from "nodemailer";

export async function OPTIONS(request) {
  return handleOptions(request);
}

// GET /api/loan/[id] - Get user's loans
export const GET = withAuth(async (request, { params }) => {
  try {
    await dbConnect();
    const { id } = await params;

    const loans = await Loan.find({ userId: id }).sort({ createdAt: -1 });

    return NextResponse.json(
      { message: "User loans retrieved", loan: loans },
      { status: 200, headers: corsHeaders(request) }
    );
  } catch (error) {
    console.error("Get user loans error:", error);
    return NextResponse.json(
      { error: "Failed to fetch user loans" },
      { status: 500, headers: corsHeaders(request) }
    );
  }
});

// PUT /api/loan/[id] - Update loan (Admin only)
export const PUT = withAdmin(async (request, { params }) => {
  try {
    await dbConnect();
    const { id } = await params;
    const body = await request.json();

    const updatedLoan = await Loan.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true }
    );

    if (!updatedLoan) {
      return NextResponse.json(
        { error: "Loan not found" },
        { status: 404, headers: corsHeaders(request) }
      );
    }

    // If loan is approved, credit the user's wallet
    if (body.status === "approved") {
      const wallet = await Wallet.findOne({ userId: updatedLoan.userId });

      if (!wallet) {
        return NextResponse.json(
          { error: "Wallet not found for user" },
          { status: 404, headers: corsHeaders(request) }
        );
      }

      wallet.balanceUSD += Number(updatedLoan.amount);
      await wallet.save();

      // Send approved email
      await sendLoanApprovedEmail(updatedLoan);
    }
    // If loan is rejected
    else if (body.status === "rejected") {
      await sendLoanRejectedEmail(updatedLoan);
    }

    return NextResponse.json(
      { message: "Loan updated", data: updatedLoan },
      { status: 200, headers: corsHeaders(request) }
    );
  } catch (error) {
    console.error("Update loan error:", error);
    return NextResponse.json(
      { error: "Failed to update loan" },
      { status: 500, headers: corsHeaders(request) }
    );
  }
});
// DELETE /api/loan/[id] - Delete loan (Admin only)
export const DELETE = withAdmin(async (request, { params }) => {
  try {
    await dbConnect();
    const { id } = await params;

    const deletedLoan = await Loan.findByIdAndDelete(id);

    if (!deletedLoan) {
      return NextResponse.json(
        { error: "Loan not found" },
        { status: 404, headers: corsHeaders(request) }
      );
    }

    return NextResponse.json(
      { message: "Loan deleted" },
      { status: 200, headers: corsHeaders(request) }
    );
  } catch (error) {
    console.error("Delete loan error:", error);
    return NextResponse.json(
      { error: "Failed to delete loan" },
      { status: 500, headers: corsHeaders(request) }
    );
  }
});

// Loan Approved Email Template
const loanApprovedEmailTemplate = (loan) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Loan Application Approved - WealthGrower Finance</title>
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
              <div style="text-align: center; margin-bottom: 30px;">
                <div style="font-size: 48px; margin-bottom: 20px;">🎉</div>
                <h2 style="font-size: 28px; margin-bottom: 15px; color: #27ae60; font-weight: 700;">Congratulations!</h2>
                <p style="font-size: 18px; color: #555555; margin: 0;">Your Loan Application Has Been Approved</p>
              </div>

              <h2 style="font-size: 20px; margin-bottom: 25px; color: #50626a; font-weight: 600;">Dear ${
                loan.firstName
              } ${loan.lastName},</h2>

              <p style="line-height: 1.7; margin-bottom: 25px; font-size: 16px; color: #555555;">
                We are pleased to inform you that your ${
                  loan.loanType
                } loan application has been approved. 
                The funds have been processed and will be available in your account shortly.
              </p>

              <div style="background-color: #f8f9fa; border-left: 5px solid #27ae60; padding: 25px; margin: 30px 0; border-radius: 0 8px 8px 0;">
                <h3 style="margin-top: 0; color: #50626a; font-size: 18px; margin-bottom: 20px;">Loan Approval Details</h3>

                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Reference Number:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">${
                    loan.referenceNumber
                  }</div>
                </div>

                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Loan Type:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">${
                    loan.loanType
                  }</div>
                </div>

                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Approved Amount:</div>
                  <div style="font-weight: 500; color: #27ae60; font-size: 15px;">$${
                    loan.amount
                  } USD</div>
                </div>

                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Loan Term:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">${
                    loan.term
                  } months</div>
                </div>

                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Approval Date:</div>
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

                <div style="display: inline-block; padding: 8px 16px; background-color: #d4edda; color: #155724; border-radius: 6px; font-size: 14px; font-weight: 600; margin-top: 15px; border: 1px solid #c3e6cb;">
                  Status: Approved ✅
                </div>
              </div>

              <div style="margin-top: 35px; padding-top: 25px; border-top: 1px solid #eaeaea;">
                <h3 style="color: #50626a; margin-bottom: 20px; font-size: 18px; font-weight: 600;">Next Steps</h3>
                <ul style="padding-left: 20px; margin: 0;">
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #555555;">
                    Funds have been disbursed to your account
                  </li>
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #555555;">
                    You can now access and use the loan amount
                  </li>
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #555555;">
                    First repayment will be due in 30 days
                  </li>
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #555555;">
                    Check your account dashboard for repayment schedule
                  </li>
                </ul>
              </div>

              <div style="background-color: #f0f7ff; padding: 20px; border-radius: 8px; margin-top: 25px; border: 1px solid #e1f0ff;">
                <h4 style="color: #50626a; margin-bottom: 10px; font-size: 16px;">Need Assistance?</h4>
                <p style="margin: 0; color: #555555; line-height: 1.6;">
                  If you have any questions about your loan or repayment schedule, 
                  please contact our support team at
                  <a href="mailto:support@wealthgrowerfinance.org" style="color: #50626a; text-decoration: none; font-weight: 500;">support@wealthgrowerfinance.org</a>
                  or call us at +1 (555) 123-4567.
                </p>
              </div>

              <p style="line-height: 1.7; margin-top: 25px; font-size: 16px; color: #555555;">
                Thank you for choosing WealthGrower Finance Bank for your financial needs.<br />
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

// Loan Rejected Email Template
const loanRejectedEmailTemplate = (loan) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Loan Application Update - WealthGrower Finance</title>
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
              <div style="text-align: center; margin-bottom: 30px;">
                <div style="font-size: 48px; margin-bottom: 20px;">📋</div>
                <h2 style="font-size: 28px; margin-bottom: 15px; color: #e74c3c; font-weight: 700;">Application Update</h2>
                <p style="font-size: 18px; color: #555555; margin: 0;">Regarding Your Loan Application</p>
              </div>

              <h2 style="font-size: 20px; margin-bottom: 25px; color: #50626a; font-weight: 600;">Dear ${
                loan.firstName
              } ${loan.lastName},</h2>

              <p style="line-height: 1.7; margin-bottom: 25px; font-size: 16px; color: #555555;">
                Thank you for your interest in WealthGrower Finance Bank. After careful review of your application, 
                we regret to inform you that we are unable to approve your ${
                  loan.loanType
                } loan request at this time.
              </p>

              <div style="background-color: #f8f9fa; border-left: 5px solid #e74c3c; padding: 25px; margin: 30px 0; border-radius: 0 8px 8px 0;">
                <h3 style="margin-top: 0; color: #50626a; font-size: 18px; margin-bottom: 20px;">Application Details</h3>

                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Reference Number:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">${
                    loan.referenceNumber
                  }</div>
                </div>

                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Loan Type:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">${
                    loan.loanType
                  }</div>
                </div>

                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Requested Amount:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">$${
                    loan.amount
                  } USD</div>
                </div>

                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Decision Date:</div>
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

                <div style="display: inline-block; padding: 8px 16px; background-color: #f8d7da; color: #721c24; border-radius: 6px; font-size: 14px; font-weight: 600; margin-top: 15px; border: 1px solid #f5c6cb;">
                  Status: Not Approved
                </div>
              </div>

              <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #ffeaa7;">
                <h4 style="color: #856404; margin-bottom: 10px; font-size: 16px;">Important Information</h4>
                <p style="margin: 0; color: #856404; line-height: 1.6;">
                  Loan decisions are based on various factors including credit history, income verification, 
                  and current financial obligations. This decision does not reflect on your character or 
                  future potential with our institution.
                </p>
              </div>

              <div style="margin-top: 35px; padding-top: 25px; border-top: 1px solid #eaeaea;">
                <h3 style="color: #50626a; margin-bottom: 20px; font-size: 18px; font-weight: 600;">Next Steps & Alternatives</h3>
                <ul style="padding-left: 20px; margin: 0;">
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #555555;">
                    You may reapply after 90 days with updated information
                  </li>
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #555555;">
                    Consider our savings or investment products
                  </li>
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #555555;">
                    Review your credit report for any discrepancies
                  </li>
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #555555;">
                    Contact us to discuss other financial solutions
                  </li>
                </ul>
              </div>

              <div style="background-color: #f0f7ff; padding: 20px; border-radius: 8px; margin-top: 25px; border: 1px solid #e1f0ff;">
                <h4 style="color: #50626a; margin-bottom: 10px; font-size: 16px;">Have Questions?</h4>
                <p style="margin: 0; color: #555555; line-height: 1.6;">
                  If you would like more information about this decision or wish to discuss 
                  alternative financial products, please contact our support team at
                  <a href="mailto:support@wealthgrowerfinance.org" style="color: #50626a; text-decoration: none; font-weight: 500;">support@wealthgrowerfinance.org</a>
                  or call us at +1 (555) 123-4567.
                </p>
              </div>

              <p style="line-height: 1.7; margin-top: 25px; font-size: 16px; color: #555555;">
                We appreciate your interest in WealthGrower Finance Bank and hope to serve you in the future.<br />
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

// Email sending functions
async function sendLoanApprovedEmail(loan) {
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

    const mailOptions = {
      from: process.env.MAIL_USER,
      to: loan.email,
      subject: `Congratulations! Your ${loan.loanType} Loan Has Been Approved - WealthGrower Finance Bank`,
      html: loanApprovedEmailTemplate(loan),
    };

    await transporter.sendMail(mailOptions);
    console.log("Loan approval email sent successfully");
  } catch (error) {
    console.error("Error sending loan approval email:", error);
  }
}

async function sendLoanRejectedEmail(loan) {
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

    const mailOptions = {
      from: process.env.MAIL_USER,
      to: loan.email,
      subject: `Update on Your ${loan.loanType} Loan Application - WealthGrower Finance Bank`,
      html: loanRejectedEmailTemplate(loan),
    };

    await transporter.sendMail(mailOptions);
    console.log("Loan rejection email sent successfully");
  } catch (error) {
    console.error("Error sending loan rejection email:", error);
  }
}
