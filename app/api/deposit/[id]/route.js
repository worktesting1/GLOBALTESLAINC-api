import { NextResponse } from "next/server";
import dbConnect from "../../../../lib/mongodb";
import Deposit from "../../../../models/Deposit";
import Wallet from "../../../../models/Wallet";
import { withAuth, withAdmin } from "../../../../lib/apiHander";
import nodemailer from "nodemailer";

import { corsHeaders, handleOptions } from "../../../../lib/cors";

export async function OPTIONS(request) {
  return handleOptions(request);
}

// GET specific deposit
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    await dbConnect();
    return await withAuth(handleGetUserDeposits)(
      request,
      corsHeaders(request),
      id
    );
  } catch (error) {
    console.error("Deposit GET API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders(request) }
    );
  }
}

// PUT - Update deposit
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    await dbConnect();
    const body = await request.json();
    return await withAdmin(handleUpdateDeposit)(
      request,
      corsHeaders(request),
      id,
      body
    );
  } catch (error) {
    console.error("Deposit PUT API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders(request) }
    );
  }
}

// DELETE - Delete deposit
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    await dbConnect();
    return await withAdmin(handleDeleteDeposit)(
      request,
      corsHeaders(request),
      id
    );
  } catch (error) {
    console.error("Deposit DELETE API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders(request) }
    );
  }
}

// Handler functions
async function handleGetUserDeposits(req, headers, userId) {
  try {
    const deposits = await Deposit.find({ userId: userId });

    // Calculate total amount for this user
    const totalAmount = deposits.reduce((sum, deposit) => {
      return sum + Number(deposit.amount);
    }, 0);

    return NextResponse.json(
      {
        deposits: deposits,
        totalAmount: totalAmount,
      },
      { status: 200, headers }
    );
  } catch (error) {
    console.error("Get user deposits error:", error);
    return NextResponse.json(
      { error: "Failed to fetch deposits" },
      { status: 500, headers }
    );
  }
}

async function handleUpdateDeposit(req, headers, id, body) {
  try {
    const updatedDeposit = await Deposit.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true }
    );

    if (!updatedDeposit) {
      return NextResponse.json(
        { message: "Deposit not found" },
        { status: 404, headers }
      );
    }

    // If deposit is approved, credit the user's wallet
    if (body.status === "approved") {
      const wallet = await Wallet.findOne({ userId: updatedDeposit.userId });

      if (!wallet) {
        return NextResponse.json(
          { message: "Wallet not found for user" },
          { status: 404, headers }
        );
      }

      wallet.balanceUSD += Number(updatedDeposit.amount);
      await wallet.save();

      // Send approved email
      await sendDepositEmail(updatedDeposit, "approved");
    }
    // If deposit is rejected/failed
    else if (body.status === "rejected" || body.status === "failed") {
      await sendDepositEmail(updatedDeposit, "failed");
    }

    return NextResponse.json(updatedDeposit, { status: 200, headers });
  } catch (error) {
    console.error("Update deposit error:", error);
    return NextResponse.json(
      { message: "Something went wrong", error: error.message },
      { status: 500, headers }
    );
  }
}

async function handleDeleteDeposit(req, headers, id) {
  try {
    const deletedDeposit = await Deposit.findByIdAndDelete(id);

    if (!deletedDeposit) {
      return NextResponse.json(
        { message: "Deposit not found" },
        { status: 404, headers }
      );
    }

    return NextResponse.json(
      { message: "Deposit deleted successfully", deposit: deletedDeposit },
      { status: 200, headers }
    );
  } catch (error) {
    console.error("Delete deposit error:", error);
    return NextResponse.json(
      { error: "Failed to delete deposit" },
      { status: 500, headers }
    );
  }
}

// Deposit Approved Email Template
const depositApprovedEmailTemplate = (deposit) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Deposit Approved - WealthGrower Finance</title>
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
                <div style="font-size: 48px; margin-bottom: 20px;">✅</div>
                <h2 style="font-size: 28px; margin-bottom: 15px; color: #27ae60; font-weight: 700;">Deposit Approved!</h2>
                <p style="font-size: 18px; color: #555555; margin: 0;">Your funds are now available in your account</p>
              </div>

              <h2 style="font-size: 20px; margin-bottom: 25px; color: #50626a; font-weight: 600;">Dear ${
                deposit.name
              },</h2>

              <p style="line-height: 1.7; margin-bottom: 25px; font-size: 16px; color: #555555;">
                We are pleased to inform you that your deposit has been successfully processed and approved. 
                The funds have been credited to your account and are now available for use.
              </p>

              <div style="background-color: #f8f9fa; border-left: 5px solid #27ae60; padding: 25px; margin: 30px 0; border-radius: 0 8px 8px 0;">
                <h3 style="margin-top: 0; color: #50626a; font-size: 18px; margin-bottom: 20px;">Transaction Details</h3>

                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Reference Number:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">${
                    deposit.referenceNumber
                  }</div>
                </div>

                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Amount Deposited:</div>
                  <div style="font-weight: 500; color: #27ae60; font-size: 15px;">$${
                    deposit.amount
                  } USD</div>
                </div>

                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Transaction Type:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">${
                    deposit.transactionType
                  }</div>
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
                  Status: Successfully Processed ✅
                </div>
              </div>

              <div style="margin-top: 35px; padding-top: 25px; border-top: 1px solid #eaeaea;">
                <h3 style="color: #50626a; margin-bottom: 20px; font-size: 18px; font-weight: 600;">What You Can Do Now</h3>
                <ul style="padding-left: 20px; margin: 0;">
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #555555;">
                    Access your funds immediately for transactions
                  </li>
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #555555;">
                    Make transfers or payments using your available balance
                  </li>
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #555555;">
                    Monitor your account activity in your dashboard
                  </li>
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #555555;">
                    Consider our investment options for your funds
                  </li>
                </ul>
              </div>

              <div style="background-color: #f0f7ff; padding: 20px; border-radius: 8px; margin-top: 25px; border: 1px solid #e1f0ff;">
                <h4 style="color: #50626a; margin-bottom: 10px; font-size: 16px;">Need Help?</h4>
                <p style="margin: 0; color: #555555; line-height: 1.6;">
                  If you have any questions about this transaction or notice any discrepancies, 
                  please contact our support team immediately at
                  <a href="mailto:support@wealthgrowerfinance.org" style="color: #50626a; text-decoration: none; font-weight: 500;">support@wealthgrowerfinance.org</a>
                  or call us at +1 (555) 123-4567.
                </p>
              </div>

              <p style="line-height: 1.7; margin-top: 25px; font-size: 16px; color: #555555;">
                Thank you for banking with us.<br />
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

// Deposit Failed Email Template
const depositFailedEmailTemplate = (deposit) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Deposit Update - WealthGrower Finance</title>
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
                <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
                <h2 style="font-size: 28px; margin-bottom: 15px; color: #e74c3c; font-weight: 700;">Deposit Not Processed</h2>
                <p style="font-size: 18px; color: #555555; margin: 0;">Important Update Regarding Your Transaction</p>
              </div>

              <h2 style="font-size: 20px; margin-bottom: 25px; color: #50626a; font-weight: 600;">Dear ${
                deposit.name
              },</h2>

              <p style="line-height: 1.7; margin-bottom: 25px; font-size: 16px; color: #555555;">
                We regret to inform you that we were unable to process your deposit request. 
                After careful review, the transaction could not be completed successfully.
              </p>

              <div style="background-color: #f8f9fa; border-left: 5px solid #e74c3c; padding: 25px; margin: 30px 0; border-radius: 0 8px 8px 0;">
                <h3 style="margin-top: 0; color: #50626a; font-size: 18px; margin-bottom: 20px;">Transaction Details</h3>

                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Reference Number:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">${
                    deposit.referenceNumber
                  }</div>
                </div>

                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Amount:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">$${
                    deposit.amount
                  } USD</div>
                </div>

                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Transaction Type:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">${
                    deposit.transactionType
                  }</div>
                </div>

                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Status Date:</div>
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
                  Status: Not Processed
                </div>
              </div>

              <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #ffeaa7;">
                <h4 style="color: #856404; margin-bottom: 10px; font-size: 16px;">Common Reasons for Deposit Issues</h4>
                <ul style="padding-left: 20px; margin: 0; color: #856404;">
                  <li style="margin-bottom: 8px; line-height: 1.5;">Insufficient funds in source account</li>
                  <li style="margin-bottom: 8px; line-height: 1.5;">Incorrect account information</li>
                  <li style="margin-bottom: 8px; line-height: 1.5;">Bank transfer restrictions or limits</li>
                  <li style="margin-bottom: 8px; line-height: 1.5;">Technical issues with payment processor</li>
                </ul>
              </div>

              <div style="margin-top: 35px; padding-top: 25px; border-top: 1px solid #eaeaea;">
                <h3 style="color: #50626a; margin-bottom: 20px; font-size: 18px; font-weight: 600;">Next Steps</h3>
                <ul style="padding-left: 20px; margin: 0;">
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #555555;">
                    Verify your payment source has sufficient funds
                  </li>
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #555555;">
                    Ensure all account details are correct
                  </li>
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #555555;">
                    Contact your bank to confirm transfer restrictions
                  </li>
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #555555;">
                    You may submit a new deposit request when ready
                  </li>
                </ul>
              </div>

              <div style="background-color: #f0f7ff; padding: 20px; border-radius: 8px; margin-top: 25px; border: 1px solid #e1f0ff;">
                <h4 style="color: #50626a; margin-bottom: 10px; font-size: 16px;">Need Immediate Assistance?</h4>
                <p style="margin: 0; color: #555555; line-height: 1.6;">
                  If you believe this is an error or need help resolving this issue, 
                  please contact our support team immediately at
                  <a href="mailto:support@wealthgrowerfinance.org" style="color: #50626a; text-decoration: none; font-weight: 500;">support@wealthgrowerfinance.org</a>
                  or call us at +1 (555) 123-4567.
                </p>
              </div>

              <p style="line-height: 1.7; margin-top: 25px; font-size: 16px; color: #555555;">
                We apologize for any inconvenience and appreciate your understanding.<br />
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

// Email sending function for deposits
async function sendDepositEmail(deposit, status) {
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

    let subject, html;

    if (status === "approved") {
      subject = `Deposit Approved - $${deposit.amount} Successfully Credited - WealthGrower Finance Bank`;
      html = depositApprovedEmailTemplate(deposit);
    } else if (status === "failed") {
      subject = `Important: Deposit Not Processed - Reference ${deposit.referenceNumber}`;
      html = depositFailedEmailTemplate(deposit);
    }

    const mailOptions = {
      from: process.env.MAIL_USER,
      to: deposit.email,
      subject: subject,
      html: html,
    };

    await transporter.sendMail(mailOptions);
    console.log(
      `Deposit ${status} email sent successfully to ${deposit.email}`
    );
  } catch (error) {
    console.error(`Error sending deposit ${status} email:`, error);
  }
}
