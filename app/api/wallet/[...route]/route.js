import { NextResponse } from "next/server";
import dbConnect from "../../../../lib/mongodb";
import Wallet from "../../../../models/Wallet";
import User from "../../../../models/Users";
import Withdrawal from "../../../../models/Withdrawal";
import FundingRequest from "../../../../models/FundingRequest";
import { withAuth, withAdmin } from "../../../../lib/apiHander";
import nodemailer from "nodemailer";
import { corsHeaders, handleOptions } from "../../../../lib/cors";

export async function OPTIONS(request) {
  return handleOptions(request);
}

// POST handler - Fund wallet and withdraw
export async function POST(request, { params }) {
  try {
    const { route } = await params;
    const headers = corsHeaders(request);
    await dbConnect();

    if (!route || route.length === 0) {
      return NextResponse.json(
        { error: "Endpoint not found" },
        { status: 404, headers }
      );
    }

    const [action] = route;
    const body = await request.json();

    switch (action) {
      case "fund":
        return await withAuth(handleFundWallet)(request, headers, body);
      case "withdraw":
        return await withAuth(handleWithdraw)(request, headers, body);
      default:
        return NextResponse.json(
          { error: "Endpoint not found" },
          { status: 404, headers }
        );
    }
  } catch (error) {
    console.error("Wallet POST API Error:", error);
    const headers = corsHeaders(request);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers }
    );
  }
}

// PUT handler - Update wallet balance and approve withdrawals
export async function PUT(request, { params }) {
  try {
    const { route } = await params;
    const headers = corsHeaders(request);
    await dbConnect();

    if (!route || route.length === 0) {
      return NextResponse.json(
        { error: "Endpoint not found" },
        { status: 404, headers }
      );
    }

    const [action, id] = route;
    const body = await request.json();

    switch (action) {
      case "update-balance":
        return await withAdmin(handleUpdateBalance)(request, headers, body);
      case "withdrawals":
        if (id === "approve" && body.withdrawalId) {
          return await withAdmin(handleApproveWithdrawal)(
            request,
            headers,
            body.withdrawalId,
            body
          );
        } else if (id === "reject" && body.withdrawalId) {
          return await withAdmin(handleRejectWithdrawal)(
            request,
            headers,
            body.withdrawalId,
            body
          );
        }
        break;
      default:
        return NextResponse.json(
          { error: "Endpoint not found" },
          { status: 404, headers }
        );
    }

    return NextResponse.json(
      { error: "Endpoint not found" },
      { status: 404, headers }
    );
  } catch (error) {
    console.error("Wallet PUT API Error:", error);
    const headers = corsHeaders(request);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers }
    );
  }
}

// GET handler - Get wallet balance, funding history, and withdrawals
export async function GET(request, { params }) {
  try {
    const { route } = await params;
    console.log("Wallet GET Route params:", route); // Debug log

    const headers = corsHeaders(request);
    await dbConnect();

    // If no route segments, return endpoint not found
    if (!route || route.length === 0) {
      return NextResponse.json(
        { error: "Endpoint not found" },
        { status: 404, headers }
      );
    }

    const [firstSegment, secondSegment] = route;

    // Handle /api/wallet/funding/history/:userId
    if (firstSegment === "funding" && secondSegment === "history" && route[2]) {
      return await withAuth(handleFundingHistory)(request, headers, route[2]);
    }

    // Handle /api/wallet/withdrawals/:userId
    if (firstSegment === "withdrawals" && secondSegment) {
      return await withAuth(handleGetWithdrawals)(
        request,
        headers,
        secondSegment
      );
    }

    // Handle /api/wallet/:userId (get wallet balance)
    if (firstSegment && !secondSegment) {
      return await withAuth(handleGetWalletBalance)(
        request,
        headers,
        firstSegment
      );
    }

    return NextResponse.json(
      { error: "Endpoint not found" },
      { status: 404, headers }
    );
  } catch (error) {
    console.error("Wallet GET API Error:", error);
    const headers = corsHeaders(request);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers }
    );
  }
}

// Handler functions
function generateReferenceNumber() {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let referenceNumber = "";
  for (let i = 0; i < 20; i++) {
    referenceNumber += characters.charAt(
      Math.floor(Math.random() * characters.length)
    );
  }
  return referenceNumber;
}

async function handleFundWallet(req, headers, body) {
  try {
    const referenceNumber = generateReferenceNumber();

    const fundingRequest = new FundingRequest({
      ...body,
      referenceNumber,
    });

    await fundingRequest.save();

    // Send emails (fire and forget)
    sendFundingRequestEmails(body, referenceNumber);

    return NextResponse.json(
      {
        success: true,
        message: "Funding request submitted for admin approval",
        requestId: fundingRequest._id,
        status: "pending",
      },
      { status: 201, headers }
    );
  } catch (error) {
    console.error("Fund wallet error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to process funding request",
        error: error.message,
      },
      { status: 500, headers }
    );
  }
}

async function handleWithdraw(req, headers, body) {
  try {
    const {
      userId,
      currency,
      amount,
      destinationAddress,
      network,
      bankName,
      accountName,
      accountNumber,
      accountType,
      ibanNumber,
      swiftCode,
      transferType,
      name,
      email,
      userEmail,
      cryptocurrency,
      cashTag,
      fullName,
      bankAddress,
      country,
      userName,
      phone,
      id,
    } = body;

    if (amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be positive" },
        { status: 400, headers }
      );
    }

    // Find the user's wallet
    const wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      return NextResponse.json(
        { error: "Wallet not found" },
        { status: 404, headers }
      );
    }

    // Check sufficient balance
    const totalDeduction = amount;
    if (wallet.balanceUSD < totalDeduction) {
      return NextResponse.json(
        {
          error: "Insufficient balance",
          required: totalDeduction,
          available: wallet.balanceUSD,
        },
        { status: 400, headers }
      );
    }

    // Create withdrawal record
    const withdrawal = new Withdrawal({
      userId,
      currency,
      amount,
      destinationAddress,
      network,
      txHash: generateReferenceNumber(),
      bankName,
      accountName,
      accountNumber,
      accountType,
      ibanNumber,
      swiftCode,
      transferType,
      name,
      email,
      userEmail,
      cryptocurrency,
      cashTag,
      fullName,
      bankAddress,
      country,
      userName,
      phone,
      id,
      status: "pending",
    });

    // Save withdrawal and deduct from wallet
    await withdrawal.save();
    wallet.balanceUSD -= totalDeduction;
    await wallet.save();

    // Send withdrawal emails
    sendWithdrawalEmails(withdrawal, body);

    return NextResponse.json(withdrawal, { status: 201, headers });
  } catch (error) {
    console.error("Withdraw error:", error);
    return NextResponse.json(
      {
        error: "Withdrawal processing failed",
        details: process.env.NODE_ENV === "development" ? error.message : null,
      },
      { status: 500, headers }
    );
  }
}

async function handleGetWalletBalance(req, headers, id) {
  try {
    const wallet = await Wallet.findOne({ userId: id });
    const balance = wallet?.balanceUSD < 0 ? 0 : wallet?.balanceUSD || 0;

    return NextResponse.json({ balanceUSD: balance }, { status: 200, headers });
  } catch (error) {
    console.error("Get wallet balance error:", error);
    return NextResponse.json(
      { message: "Error fetching balance" },
      { status: 500, headers }
    );
  }
}

async function handleFundingHistory(req, headers, userId) {
  try {
    const requests = await FundingRequest.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    const totals = await FundingRequest.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: "$status",
          total: { $sum: "$amount" },
        },
      },
    ]);

    let totalAmount = 0;
    let pendingTotal = 0;
    let successfulTotal = 0;

    for (const item of totals) {
      totalAmount += item.total;
      if (item._id === "pending") pendingTotal = item.total;
      else if (item._id === "successful") successfulTotal = item.total;
    }

    if (requests.length === 0) {
      const userExists = await User.exists({ _id: userId });
      const anyRequestsExist = await FundingRequest.exists({});
      console.log({ userExists, anyRequestsExist, userIdUsed: userId });
    }

    return NextResponse.json(
      {
        requests,
        totalAmount,
        pendingTotal,
        successfulTotal,
      },
      { status: 200, headers }
    );
  } catch (error) {
    console.error("Funding history error:", error);
    return NextResponse.json(
      {
        message: "Failed to fetch history",
        error: error.message,
      },
      { status: 500, headers }
    );
  }
}

async function handleGetWithdrawals(req, headers, userId) {
  try {
    const withdrawals = await Withdrawal.find({ userId }).sort({
      createdAt: -1,
    });

    const totals = await Withdrawal.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: "$status",
          total: { $sum: "$amount" },
        },
      },
    ]);

    let totalAmount = 0;
    let pendingTotal = 0;
    let successfulTotal = 0;
    let failedTotal = 0;

    for (const item of totals) {
      totalAmount += item.total;
      if (item._id === "pending") pendingTotal = item.total;
      else if (item._id === "approved") successfulTotal = item.total;
      else if (item._id === "failed") failedTotal = item.total;
    }

    return NextResponse.json(
      {
        withdrawals,
        totalAmount,
        pendingTotal,
        successfulTotal,
        failedTotal,
      },
      { status: 200, headers }
    );
  } catch (error) {
    console.error("Get withdrawals error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve withdrawals" },
      { status: 500, headers }
    );
  }
}

async function handleApproveWithdrawal(req, headers, withdrawalId, body) {
  try {
    const { status, txHash } = body;

    const withdrawal = await Withdrawal.findById(withdrawalId);
    if (!withdrawal) {
      return NextResponse.json(
        { message: "Withdrawal not found" },
        { status: 404, headers }
      );
    }

    if (withdrawal.status === "approved" || withdrawal.status === "failed") {
      return NextResponse.json(
        { message: "Withdrawal already finalized" },
        { status: 400, headers }
      );
    }

    // Update status and txHash
    withdrawal.status = "approved";
    if (txHash) withdrawal.txHash = txHash;
    await withdrawal.save();

    // Send approval email
    sendWithdrawalStatusEmail(withdrawal, "approved");

    return NextResponse.json(
      { message: "Withdrawal approved successfully", withdrawal },
      { status: 200, headers }
    );
  } catch (error) {
    console.error("Approve withdrawal error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500, headers }
    );
  }
}

async function handleRejectWithdrawal(req, headers, withdrawalId, body) {
  try {
    const { reason } = body;

    const withdrawal = await Withdrawal.findById(withdrawalId);
    if (!withdrawal) {
      return NextResponse.json(
        { message: "Withdrawal not found" },
        { status: 404, headers }
      );
    }

    if (withdrawal.status === "approved" || withdrawal.status === "failed") {
      return NextResponse.json(
        { message: "Withdrawal already finalized" },
        { status: 400, headers }
      );
    }

    // Refund the user's wallet
    const wallet = await Wallet.findOne({ userId: withdrawal.userId });
    if (wallet) {
      wallet.balanceUSD += withdrawal.amount;
      await wallet.save();
    }

    // Update status
    withdrawal.status = "failed";
    withdrawal.rejectionReason = reason;
    await withdrawal.save();

    // Send rejection email
    sendWithdrawalStatusEmail(withdrawal, "failed", reason);

    return NextResponse.json(
      { message: "Withdrawal rejected successfully", withdrawal },
      { status: 200, headers }
    );
  } catch (error) {
    console.error("Reject withdrawal error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500, headers }
    );
  }
}

async function handleUpdateBalance(req, headers, body) {
  try {
    const { userId, amount } = body;

    if (!userId || amount === undefined) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing/invalid fields. Required: userId, amount",
        },
        { status: 400, headers }
      );
    }

    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Amount must be a positive number",
        },
        { status: 400, headers }
      );
    }

    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      wallet = await Wallet.create({ userId, balanceUSD: 0 });
    }

    const newBalance = wallet.balanceUSD + amount;
    wallet.balanceUSD = newBalance;
    await wallet.save();

    return NextResponse.json(
      {
        success: true,
        message: `Balance updated successfully $${amount}`,
        newBalance,
      },
      { status: 200, headers }
    );
  } catch (error) {
    console.error("Update balance error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Server error during balance update",
        error: error.message,
      },
      { status: 500, headers }
    );
  }
}

// Email functions with professional deposit-style templates
async function sendFundingRequestEmails(body, referenceNumber) {
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

    // User email
    const userMailOptions = {
      from: process.env.MAIL_USER,
      to: body.email,
      subject: "Funding Request Submitted - WealthGrower Finance Bank",
      html: fundingRequestEmailTemplate(body, referenceNumber),
    };

    // Admin email
    const adminMailOptions = {
      from: process.env.MAIL_USER,
      to: process.env.ADMIN_MAIL,
      subject: "New Funding Request Submitted",
      html: adminFundingNotificationTemplate(body, referenceNumber),
    };

    await transport.sendMail(userMailOptions);
    await transport.sendMail(adminMailOptions);

    console.log("Funding request emails sent successfully");
  } catch (error) {
    console.error("Error sending funding request emails:", error);
  }
}

async function sendWithdrawalEmails(withdrawal, body) {
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
      to: body.userEmail,
      subject: "Withdrawal Request Received - WealthGrower Finance Bank",
      html: getWithdrawalTemplate(body),
    };

    const adminMailOptions = {
      from: process.env.MAIL_USER,
      to: process.env.ADMIN_MAIL,
      subject: "New Withdrawal Request Submitted",
      html: adminWithdrawalNotificationTemplate(withdrawal, body),
    };

    await transport.sendMail(userMailOptions);
    await transport.sendMail(adminMailOptions);

    console.log("Withdrawal emails sent successfully");
  } catch (error) {
    console.error("Error sending withdrawal emails:", error);
  }
}

async function sendWithdrawalStatusEmail(withdrawal, status, reason = "") {
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
      to: withdrawal.email,
      subject:
        status === "approved"
          ? "Withdrawal Approved - WealthGrower Finance Bank"
          : "Withdrawal Update - WealthGrower Finance Bank",
      html:
        status === "approved"
          ? withdrawalApprovedEmailTemplate(withdrawal)
          : withdrawalFailedEmailTemplate(withdrawal, reason),
    };

    await transport.sendMail(userMailOptions);
    console.log("Withdrawal status email sent successfully");
  } catch (error) {
    console.error("Error sending withdrawal status email:", error);
  }
}

// Helper function to get appropriate withdrawal template
function getWithdrawalTemplate(body) {
  const {
    transferType,
    name,
    cryptocurrency,
    amount,
    network,
    destinationAddress,
    email,
    fullName,
    country,
    cashTag,
    bankName,
    accountName,
    accountType,
    accountNumber,
    swiftCode,
    ibanNumber,
    bankAddress,
  } = body;

  if (transferType === "Cryptocurrency") {
    return withdrawalTemplateForCrypto(
      name,
      cryptocurrency,
      amount,
      network,
      destinationAddress
    );
  } else if (transferType === "PayPal") {
    return paypalWithdrawalTemplate(name, amount, email);
  } else if (transferType === "Wise Transfer") {
    return wiseWithdrawalTemplate(
      fullName,
      amount,
      email,
      country,
      name,
      transferType
    );
  } else if (transferType === "Cash App") {
    return cashappWithdrawalTemplate(
      fullName,
      amount,
      cashTag,
      email,
      transferType,
      name
    );
  } else {
    return withdrawalTemplateForBank(
      name,
      amount,
      "$",
      transferType,
      bankName,
      accountName,
      accountType,
      accountNumber,
      swiftCode,
      ibanNumber,
      bankAddress,
      country
    );
  }
}

// Professional deposit-style email templates
const fundingRequestEmailTemplate = (body, referenceNumber) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Funding Request Submitted - WealthGrower Finance</title>
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
                <div style="font-size: 48px; margin-bottom: 20px;">📥</div>
                <h2 style="font-size: 28px; margin-bottom: 15px; color: #50626a; font-weight: 700;">Funding Request Submitted</h2>
                <p style="font-size: 18px; color: #555555; margin: 0;">Your request is now under review</p>
              </div>

              <h2 style="font-size: 20px; margin-bottom: 25px; color: #50626a; font-weight: 600;">Dear ${
                body.name
              },</h2>

              <p style="line-height: 1.7; margin-bottom: 25px; font-size: 16px; color: #555555;">
                Thank you for submitting your funding request. We have successfully received your transaction details and they are now under review by our finance team.
              </p>

              <div style="background-color: #f8f9fa; border-left: 5px solid #50626a; padding: 25px; margin: 30px 0; border-radius: 0 8px 8px 0;">
                <h3 style="margin-top: 0; color: #50626a; font-size: 18px; margin-bottom: 20px;">Request Details</h3>

                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Reference Number:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">${referenceNumber}</div>
                </div>

                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Amount:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">$${
                    body.amount
                  } USD</div>
                </div>

                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Transaction Type:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">${
                    body.transactionType
                  }</div>
                </div>

                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Submission Date:</div>
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
                  Status: Pending Review
                </div>
              </div>

              <p style="line-height: 1.7; margin-bottom: 25px; font-size: 16px; color: #555555;">
                Our team will verify your funding request within 1-2 business hours. You will receive another email notification once your request has been processed and the funds are available in your account.
              </p>

              <div style="margin-top: 35px; padding-top: 25px; border-top: 1px solid #eaeaea;">
                <h3 style="color: #50626a; margin-bottom: 20px; font-size: 18px; font-weight: 600;">What to Expect Next</h3>
                <ul style="padding-left: 20px; margin: 0;">
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #555555;">
                    Our finance team will verify your transaction details
                  </li>
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #555555;">
                    We'll confirm the funding amount and source
                  </li>
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #555555;">
                    You'll receive an approval notification email
                  </li>
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #555555;">
                    Funds will be credited to your account immediately after approval
                  </li>
                </ul>
              </div>

              <div style="background-color: #f0f7ff; padding: 20px; border-radius: 8px; margin-top: 25px; border: 1px solid #e1f0ff;">
                <h4 style="color: #50626a; margin-bottom: 10px; font-size: 16px;">Need Assistance?</h4>
                <p style="margin: 0; color: #555555; line-height: 1.6;">
                  If you have any questions about your funding request or need to update your submission, please contact our support team at
                  <a href="mailto:support@wealthgrowerfinance.org" style="color: #50626a; text-decoration: none; font-weight: 500;">support@wealthgrowerfinance.org</a>
                  or call us at +1 (555) 123-4567.
                </p>
              </div>

              <div style="background-color: #fff8e6; padding: 15px; border-radius: 6px; margin-top: 20px; font-size: 13px; color: #856404; border: 1px solid #ffeaa7;">
                <strong>Security Notice:</strong> For your protection, please do not share your reference number or transaction details with anyone. WealthGrower Finance Bank will never ask for your password or sensitive information via email.
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

const adminFundingNotificationTemplate = (body, referenceNumber) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New Funding Request - Admin Notification</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, Helvetica, sans-serif; background-color: #f8fafc; color: #333333; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <table width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc;">
    <tr>
      <td align="center" style="padding: 40px 15px;">
        <table width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);">
          <tr>
            <td style="background-color: #50626a; padding: 30px; text-align: center; border-bottom: 4px solid #3a4a52;">
              <a href="#" style="display: inline-block; color: #ffffff; font-size: 32px; font-weight: 700; text-decoration: none; letter-spacing: -0.5px;">
                WealthGrower
                <span style="display: block; font-size: 16px; font-weight: 400; margin-top: 8px; opacity: 0.9;">Finance Bank</span>
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <div style="font-size: 48px; margin-bottom: 20px;">📥</div>
                <h2 style="font-size: 28px; margin-bottom: 15px; color: #50626a; font-weight: 700;">New Funding Request</h2>
                <p style="font-size: 18px; color: #555555; margin: 0;">Requires Admin Approval</p>
              </div>

              <div style="background-color: #f8f9fa; border-left: 5px solid #50626a; padding: 25px; margin: 30px 0; border-radius: 0 8px 8px 0;">
                <h3 style="margin-top: 0; color: #50626a; font-size: 18px; margin-bottom: 20px;">Request Details</h3>
                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Customer:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">${body.name}</div>
                </div>
                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Email:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">${body.email}</div>
                </div>
                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Amount:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">$${body.amount} USD</div>
                </div>
                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Reference:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">${referenceNumber}</div>
                </div>
                <div style="display: inline-block; padding: 8px 16px; background-color: #fff3cd; color: #856404; border-radius: 6px; font-size: 14px; font-weight: 600; margin-top: 15px; border: 1px solid #ffeaa7;">
                  Status: Awaiting Review
                </div>
              </div>

              <div style="background-color: #f0f7ff; padding: 20px; border-radius: 8px; margin-top: 25px; border: 1px solid #e1f0ff;">
                <h4 style="color: #50626a; margin-bottom: 10px; font-size: 16px;">Action Required</h4>
                <p style="margin: 0; color: #555555; line-height: 1.6;">
                  Please review this funding request in the admin dashboard and approve or reject it accordingly.
                </p>
              </div>

              <p style="line-height: 1.7; margin-top: 25px; font-size: 16px; color: #555555;">
                Best regards,<br />
                <strong>WealthGrower Finance Bank System</strong>
              </p>
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

const withdrawalTemplateForCrypto = (
  NAME,
  CURRENCY,
  AMOUNT,
  NETWORK,
  DESTINATION
) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Withdrawal Request - WealthGrower Finance</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, Helvetica, sans-serif; background-color: #f8fafc; color: #333333; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <table width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc;">
    <tr>
      <td align="center" style="padding: 40px 15px;">
        <table width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);">
          <tr>
            <td style="background-color: #50626a; padding: 30px; text-align: center; border-bottom: 4px solid #3a4a52;">
              <a href="#" style="display: inline-block; color: #ffffff; font-size: 32px; font-weight: 700; text-decoration: none; letter-spacing: -0.5px;">
                WealthGrower
                <span style="display: block; font-size: 16px; font-weight: 400; margin-top: 8px; opacity: 0.9;">Finance Bank</span>
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <div style="font-size: 48px; margin-bottom: 20px;">🚀</div>
                <h2 style="font-size: 28px; margin-bottom: 15px; color: #50626a; font-weight: 700;">Crypto Withdrawal Request</h2>
                <p style="font-size: 18px; color: #555555; margin: 0;">Your request is being processed</p>
              </div>

              <h2 style="font-size: 20px; margin-bottom: 25px; color: #50626a; font-weight: 600;">Dear ${NAME},</h2>

              <p style="line-height: 1.7; margin-bottom: 25px; font-size: 16px; color: #555555;">
                We've received your cryptocurrency withdrawal request and it is currently being processed by our team.
              </p>

              <div style="background-color: #f8f9fa; border-left: 5px solid #50626a; padding: 25px; margin: 30px 0; border-radius: 0 8px 8px 0;">
                <h3 style="margin-top: 0; color: #50626a; font-size: 18px; margin-bottom: 20px;">Withdrawal Details</h3>
                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Currency:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">${CURRENCY}</div>
                </div>
                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Amount:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">${AMOUNT}</div>
                </div>
                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Network:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">${NETWORK}</div>
                </div>
                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Destination:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px; word-break: break-all;">${DESTINATION}</div>
                </div>
                <div style="display: inline-block; padding: 8px 16px; background-color: #fff3cd; color: #856404; border-radius: 6px; font-size: 14px; font-weight: 600; margin-top: 15px; border: 1px solid #ffeaa7;">
                  Status: Under Review
                </div>
              </div>

              <div style="margin-top: 35px; padding-top: 25px; border-top: 1px solid #eaeaea;">
                <h3 style="color: #50626a; margin-bottom: 20px; font-size: 18px; font-weight: 600;">Processing Timeline</h3>
                <ul style="padding-left: 20px; margin: 0;">
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #555555;">
                    Security verification and approval process
                  </li>
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #555555;">
                    Network confirmation and transaction processing
                  </li>
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #555555;">
                    You'll receive confirmation with transaction hash
                  </li>
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #555555;">
                    Funds typically arrive within 1-2 hours after approval
                  </li>
                </ul>
              </div>

              <div style="background-color: #f0f7ff; padding: 20px; border-radius: 8px; margin-top: 25px; border: 1px solid #e1f0ff;">
                <h4 style="color: #50626a; margin-bottom: 10px; font-size: 16px;">Need Assistance?</h4>
                <p style="margin: 0; color: #555555; line-height: 1.6;">
                  If you have any questions about your withdrawal, please contact our support team at
                  <a href="mailto:support@wealthgrowerfinance.org" style="color: #50626a; text-decoration: none; font-weight: 500;">support@wealthgrowerfinance.org</a>
                </p>
              </div>

              <p style="line-height: 1.7; margin-top: 25px; font-size: 16px; color: #555555;">
                Best regards,<br />
                <strong>The WealthGrower Finance Bank Team</strong>
              </p>
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

const withdrawalTemplateForBank = (
  NAME,
  AMOUNT,
  CURRENCY,
  transferType,
  bankName,
  accountName,
  accountType,
  accountNumber,
  swiftCode,
  ibanNumber,
  bankAddress,
  country
) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bank Withdrawal Request - WealthGrower Finance</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, Helvetica, sans-serif; background-color: #f8fafc; color: #333333; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <table width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc;">
    <tr>
      <td align="center" style="padding: 40px 15px;">
        <table width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);">
          <tr>
            <td style="background-color: #50626a; padding: 30px; text-align: center; border-bottom: 4px solid #3a4a52;">
              <a href="#" style="display: inline-block; color: #ffffff; font-size: 32px; font-weight: 700; text-decoration: none; letter-spacing: -0.5px;">
                WealthGrower
                <span style="display: block; font-size: 16px; font-weight: 400; margin-top: 8px; opacity: 0.9;">Finance Bank</span>
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <div style="font-size: 48px; margin-bottom: 20px;">🏦</div>
                <h2 style="font-size: 28px; margin-bottom: 15px; color: #50626a; font-weight: 700;">Bank Withdrawal Request</h2>
                <p style="font-size: 18px; color: #555555; margin: 0;">Your request is being processed</p>
              </div>

              <h2 style="font-size: 20px; margin-bottom: 25px; color: #50626a; font-weight: 600;">Dear ${NAME},</h2>

              <p style="line-height: 1.7; margin-bottom: 25px; font-size: 16px; color: #555555;">
                We've received your bank withdrawal request and it is currently being processed by our finance team.
              </p>

              <div style="background-color: #f8f9fa; border-left: 5px solid #50626a; padding: 25px; margin: 30px 0; border-radius: 0 8px 8px 0;">
                <h3 style="margin-top: 0; color: #50626a; font-size: 18px; margin-bottom: 20px;">Withdrawal Details</h3>
                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Amount:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">$${AMOUNT} USD</div>
                </div>
                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Bank Name:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">${bankName}</div>
                </div>
                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Account Name:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">${accountName}</div>
                </div>
                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Account Number:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">${accountNumber}</div>
                </div>
                <div style="display: inline-block; padding: 8px 16px; background-color: #fff3cd; color: #856404; border-radius: 6px; font-size: 14px; font-weight: 600; margin-top: 15px; border: 1px solid #ffeaa7;">
                  Status: Under Review
                </div>
              </div>

              <div style="margin-top: 35px; padding-top: 25px; border-top: 1px solid #eaeaea;">
                <h3 style="color: #50626a; margin-bottom: 20px; font-size: 18px; font-weight: 600;">Processing Timeline</h3>
                <ul style="padding-left: 20px; margin: 0;">
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #555555;">
                    Security verification and approval process (1-2 hours)
                  </li>
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #555555;">
                    Bank transfer processing (1-3 business days)
                  </li>
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #555555;">
                    You'll receive confirmation once funds are sent
                  </li>
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #555555;">
                    Additional bank processing time may apply
                  </li>
                </ul>
              </div>

              <div style="background-color: #f0f7ff; padding: 20px; border-radius: 8px; margin-top: 25px; border: 1px solid #e1f0ff;">
                <h4 style="color: #50626a; margin-bottom: 10px; font-size: 16px;">Need Assistance?</h4>
                <p style="margin: 0; color: #555555; line-height: 1.6;">
                  If you have any questions about your withdrawal, please contact our support team at
                  <a href="mailto:support@wealthgrowerfinance.org" style="color: #50626a; text-decoration: none; font-weight: 500;">support@wealthgrowerfinance.org</a>
                </p>
              </div>

              <p style="line-height: 1.7; margin-top: 25px; font-size: 16px; color: #555555;">
                Best regards,<br />
                <strong>The WealthGrower Finance Bank Team</strong>
              </p>
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

const withdrawalApprovedEmailTemplate = (withdrawal) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Withdrawal Approved - WealthGrower Finance</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, Helvetica, sans-serif; background-color: #f8fafc; color: #333333; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <table width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc;">
    <tr>
      <td align="center" style="padding: 40px 15px;">
        <table width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);">
          <tr>
            <td style="background-color: #50626a; padding: 30px; text-align: center; border-bottom: 4px solid #3a4a52;">
              <a href="#" style="display: inline-block; color: #ffffff; font-size: 32px; font-weight: 700; text-decoration: none; letter-spacing: -0.5px;">
                WealthGrower
                <span style="display: block; font-size: 16px; font-weight: 400; margin-top: 8px; opacity: 0.9;">Finance Bank</span>
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <div style="font-size: 48px; margin-bottom: 20px;">✅</div>
                <h2 style="font-size: 28px; margin-bottom: 15px; color: #27ae60; font-weight: 700;">Withdrawal Approved!</h2>
                <p style="font-size: 18px; color: #555555; margin: 0;">Your funds have been processed</p>
              </div>

              <h2 style="font-size: 20px; margin-bottom: 25px; color: #50626a; font-weight: 600;">Dear ${
                withdrawal.name
              },</h2>

              <p style="line-height: 1.7; margin-bottom: 25px; font-size: 16px; color: #555555;">
                We are pleased to inform you that your withdrawal request has been approved and processed successfully.
              </p>

              <div style="background-color: #f8f9fa; border-left: 5px solid #27ae60; padding: 25px; margin: 30px 0; border-radius: 0 8px 8px 0;">
                <h3 style="margin-top: 0; color: #50626a; font-size: 18px; margin-bottom: 20px;">Transaction Details</h3>
                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Amount:</div>
                  <div style="font-weight: 500; color: #27ae60; font-size: 15px;">$${
                    withdrawal.amount
                  } USD</div>
                </div>
                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Transaction Hash:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px; word-break: break-all;">${
                    withdrawal.txHash
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
                  Status: Approved ✅
                </div>
              </div>

              <div style="background-color: #f0f7ff; padding: 20px; border-radius: 8px; margin-top: 25px; border: 1px solid #e1f0ff;">
                <h4 style="color: #50626a; margin-bottom: 10px; font-size: 16px;">Delivery Time</h4>
                <p style="margin: 0; color: #555555; line-height: 1.6;">
                  ${
                    withdrawal.transferType === "Cryptocurrency"
                      ? "Cryptocurrency transfers typically arrive within 1-2 hours depending on network congestion."
                      : "Bank transfers typically take 1-3 business days to reflect in your account."
                  }
                </p>
              </div>

              <p style="line-height: 1.7; margin-top: 25px; font-size: 16px; color: #555555;">
                Thank you for choosing WealthGrower Finance Bank.<br />
                <strong>The WealthGrower Finance Bank Team</strong>
              </p>
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

const withdrawalFailedEmailTemplate = (withdrawal, reason) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Withdrawal Update - WealthGrower Finance</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, Helvetica, sans-serif; background-color: #f8fafc; color: #333333; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <table width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc;">
    <tr>
      <td align="center" style="padding: 40px 15px;">
        <table width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);">
          <tr>
            <td style="background-color: #50626a; padding: 30px; text-align: center; border-bottom: 4px solid #3a4a52;">
              <a href="#" style="display: inline-block; color: #ffffff; font-size: 32px; font-weight: 700; text-decoration: none; letter-spacing: -0.5px;">
                WealthGrower
                <span style="display: block; font-size: 16px; font-weight: 400; margin-top: 8px; opacity: 0.9;">Finance Bank</span>
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
                <h2 style="font-size: 28px; margin-bottom: 15px; color: #e74c3c; font-weight: 700;">Withdrawal Not Processed</h2>
                <p style="font-size: 18px; color: #555555; margin: 0;">Important Update Regarding Your Request</p>
              </div>

              <h2 style="font-size: 20px; margin-bottom: 25px; color: #50626a; font-weight: 600;">Dear ${
                withdrawal.name
              },</h2>

              <p style="line-height: 1.7; margin-bottom: 25px; font-size: 16px; color: #555555;">
                We regret to inform you that we were unable to process your withdrawal request. The funds have been refunded to your wallet.
              </p>

              <div style="background-color: #f8f9fa; border-left: 5px solid #e74c3c; padding: 25px; margin: 30px 0; border-radius: 0 8px 8px 0;">
                <h3 style="margin-top: 0; color: #50626a; font-size: 18px; margin-bottom: 20px;">Request Details</h3>
                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Amount:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">$${
                    withdrawal.amount
                  } USD</div>
                </div>
                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Transfer Type:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">${
                    withdrawal.transferType
                  }</div>
                </div>
                ${
                  reason
                    ? `
                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Reason:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">${reason}</div>
                </div>
                `
                    : ""
                }
                <div style="display: inline-block; padding: 8px 16px; background-color: #f8d7da; color: #721c24; border-radius: 6px; font-size: 14px; font-weight: 600; margin-top: 15px; border: 1px solid #f5c6cb;">
                  Status: Not Processed
                </div>
              </div>

              <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #ffeaa7;">
                <h4 style="color: #856404; margin-bottom: 10px; font-size: 16px;">Funds Refunded</h4>
                <p style="margin: 0; color: #856404; line-height: 1.6;">
                  The amount of $${
                    withdrawal.amount
                  } has been refunded to your wallet balance and is available for immediate use.
                </p>
              </div>

              <div style="background-color: #f0f7ff; padding: 20px; border-radius: 8px; margin-top: 25px; border: 1px solid #e1f0ff;">
                <h4 style="color: #50626a; margin-bottom: 10px; font-size: 16px;">Next Steps</h4>
                <p style="margin: 0; color: #555555; line-height: 1.6;">
                  You may submit a new withdrawal request with corrected information, or contact our support team for assistance.
                </p>
              </div>

              <p style="line-height: 1.7; margin-top: 25px; font-size: 16px; color: #555555;">
                We apologize for any inconvenience and appreciate your understanding.<br />
                <strong>The WealthGrower Finance Bank Team</strong>
              </p>
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

const adminWithdrawalNotificationTemplate = (withdrawal, body) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New Withdrawal Request - Admin Notification</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, Helvetica, sans-serif; background-color: #f8fafc; color: #333333; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <table width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc;">
    <tr>
      <td align="center" style="padding: 40px 15px;">
        <table width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);">
          <tr>
            <td style="background-color: #50626a; padding: 30px; text-align: center; border-bottom: 4px solid #3a4a52;">
              <a href="#" style="display: inline-block; color: #ffffff; font-size: 32px; font-weight: 700; text-decoration: none; letter-spacing: -0.5px;">
                WealthGrower
                <span style="display: block; font-size: 16px; font-weight: 400; margin-top: 8px; opacity: 0.9;">Finance Bank</span>
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <div style="font-size: 48px; margin-bottom: 20px;">💸</div>
                <h2 style="font-size: 28px; margin-bottom: 15px; color: #50626a; font-weight: 700;">New Withdrawal Request</h2>
                <p style="font-size: 18px; color: #555555; margin: 0;">Requires Admin Approval</p>
              </div>

              <div style="background-color: #f8f9fa; border-left: 5px solid #50626a; padding: 25px; margin: 30px 0; border-radius: 0 8px 8px 0;">
                <h3 style="margin-top: 0; color: #50626a; font-size: 18px; margin-bottom: 20px;">Request Details</h3>
                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Customer:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">${withdrawal.name}</div>
                </div>
                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Email:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">${withdrawal.email}</div>
                </div>
                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Amount:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">$${withdrawal.amount} USD</div>
                </div>
                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Method:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">${withdrawal.transferType}</div>
                </div>
                <div style="display: inline-block; padding: 8px 16px; background-color: #fff3cd; color: #856404; border-radius: 6px; font-size: 14px; font-weight: 600; margin-top: 15px; border: 1px solid #ffeaa7;">
                  Status: Awaiting Review
                </div>
              </div>

              <div style="background-color: #f0f7ff; padding: 20px; border-radius: 8px; margin-top: 25px; border: 1px solid #e1f0ff;">
                <h4 style="color: #50626a; margin-bottom: 10px; font-size: 16px;">Action Required</h4>
                <p style="margin: 0; color: #555555; line-height: 1.6;">
                  Please review this withdrawal request in the admin dashboard and approve or reject it accordingly.
                </p>
              </div>

              <p style="line-height: 1.7; margin-top: 25px; font-size: 16px; color: #555555;">
                Best regards,<br />
                <strong>WealthGrower Finance Bank System</strong>
              </p>
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

// PayPal, Wise, and Cash App templates follow the same structure...
const paypalWithdrawalTemplate = (NAME, AMOUNT, paypalEmail) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PayPal Withdrawal Request - WealthGrower Finance</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, Helvetica, sans-serif; background-color: #f8fafc; color: #333333; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <table width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc;">
    <tr>
      <td align="center" style="padding: 40px 15px;">
        <table width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);">
          <tr>
            <td style="background-color: #50626a; padding: 30px; text-align: center; border-bottom: 4px solid #3a4a52;">
              <a href="#" style="display: inline-block; color: #ffffff; font-size: 32px; font-weight: 700; text-decoration: none; letter-spacing: -0.5px;">
                WealthGrower
                <span style="display: block; font-size: 16px; font-weight: 400; margin-top: 8px; opacity: 0.9;">Finance Bank</span>
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <div style="font-size: 48px; margin-bottom: 20px;">💰</div>
                <h2 style="font-size: 28px; margin-bottom: 15px; color: #50626a; font-weight: 700;">PayPal Withdrawal Request</h2>
                <p style="font-size: 18px; color: #555555; margin: 0;">Your request is being processed</p>
              </div>

              <h2 style="font-size: 20px; margin-bottom: 25px; color: #50626a; font-weight: 600;">Dear ${NAME},</h2>

              <p style="line-height: 1.7; margin-bottom: 25px; font-size: 16px; color: #555555;">
                We've received your PayPal withdrawal request and it is currently being processed by our team.
              </p>

              <div style="background-color: #f8f9fa; border-left: 5px solid #50626a; padding: 25px; margin: 30px 0; border-radius: 0 8px 8px 0;">
                <h3 style="margin-top: 0; color: #50626a; font-size: 18px; margin-bottom: 20px;">Withdrawal Details</h3>
                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Amount:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">$${AMOUNT} USD</div>
                </div>
                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">PayPal Email:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">${paypalEmail}</div>
                </div>
                <div style="display: inline-block; padding: 8px 16px; background-color: #fff3cd; color: #856404; border-radius: 6px; font-size: 14px; font-weight: 600; margin-top: 15px; border: 1px solid #ffeaa7;">
                  Status: Under Review
                </div>
              </div>

              <p style="line-height: 1.7; margin-top: 25px; font-size: 16px; color: #555555;">
                Best regards,<br />
                <strong>The WealthGrower Finance Bank Team</strong>
              </p>
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

const wiseWithdrawalTemplate = (
  fullName,
  amount,
  email,
  country,
  name,
  transferType
) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Wise Withdrawal Request - WealthGrower Finance</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, Helvetica, sans-serif; background-color: #f8fafc; color: #333333; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <table width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc;">
    <tr>
      <td align="center" style="padding: 40px 15px;">
        <table width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);">
          <tr>
            <td style="background-color: #50626a; padding: 30px; text-align: center; border-bottom: 4px solid #3a4a52;">
              <a href="#" style="display: inline-block; color: #ffffff; font-size: 32px; font-weight: 700; text-decoration: none; letter-spacing: -0.5px;">
                WealthGrower
                <span style="display: block; font-size: 16px; font-weight: 400; margin-top: 8px; opacity: 0.9;">Finance Bank</span>
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <div style="font-size: 48px; margin-bottom: 20px;">🌍</div>
                <h2 style="font-size: 28px; margin-bottom: 15px; color: #50626a; font-weight: 700;">Wise Transfer Request</h2>
                <p style="font-size: 18px; color: #555555; margin: 0;">Your international transfer is being processed</p>
              </div>

              <h2 style="font-size: 20px; margin-bottom: 25px; color: #50626a; font-weight: 600;">Dear ${name},</h2>

              <p style="line-height: 1.7; margin-bottom: 25px; font-size: 16px; color: #555555;">
                We've received your Wise transfer request and it is currently being processed by our international payments team.
              </p>

              <div style="background-color: #f8f9fa; border-left: 5px solid #50626a; padding: 25px; margin: 30px 0; border-radius: 0 8px 8px 0;">
                <h3 style="margin-top: 0; color: #50626a; font-size: 18px; margin-bottom: 20px;">Transfer Details</h3>

                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Full Name:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">${fullName}</div>
                </div>

                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Amount:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">$${amount} USD</div>
                </div>

                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Email:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">${email}</div>
                </div>

                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Country:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">${country}</div>
                </div>

                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Transfer Type:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">${transferType}</div>
                </div>

                <div style="display: inline-block; padding: 8px 16px; background-color: #fff3cd; color: #856404; border-radius: 6px; font-size: 14px; font-weight: 600; margin-top: 15px; border: 1px solid #ffeaa7;">
                  Status: Under Review
                </div>
              </div>

              <div style="margin-top: 35px; padding-top: 25px; border-top: 1px solid #eaeaea;">
                <h3 style="color: #50626a; margin-bottom: 20px; font-size: 18px; font-weight: 600;">International Transfer Timeline</h3>
                <ul style="padding-left: 20px; margin: 0;">
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #555555;">
                    Security verification and compliance checks (1-2 hours)
                  </li>
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #555555;">
                    Currency conversion and transfer processing
                  </li>
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #555555;">
                    Wise network processing (1-3 business days)
                  </li>
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #555555;">
                    You'll receive Wise transfer confirmation
                  </li>
                </ul>
              </div>

              <div style="background-color: #f0f7ff; padding: 20px; border-radius: 8px; margin-top: 25px; border: 1px solid #e1f0ff;">
                <h4 style="color: #50626a; margin-bottom: 10px; font-size: 16px;">Exchange Rates & Fees</h4>
                <p style="margin: 0; color: #555555; line-height: 1.6;">
                  The final amount received may vary based on Wise's current exchange rates and applicable transfer fees. You'll see the exact amount in your Wise account.
                </p>
              </div>

              <div style="background-color: #fff8e6; padding: 15px; border-radius: 6px; margin-top: 20px; font-size: 13px; color: #856404; border: 1px solid #ffeaa7;">
                <strong>Important:</strong> Please ensure your Wise account details are correct and your account can receive USD transfers. Incorrect information may delay your transfer.
              </div>

              <div style="background-color: #f0f7ff; padding: 20px; border-radius: 8px; margin-top: 25px; border: 1px solid #e1f0ff;">
                <h4 style="color: #50626a; margin-bottom: 10px; font-size: 16px;">Need Assistance?</h4>
                <p style="margin: 0; color: #555555; line-height: 1.6;">
                  If you have any questions about your Wise transfer, please contact our international support team at
                  <a href="mailto:support@wealthgrowerfinance.org" style="color: #50626a; text-decoration: none; font-weight: 500;">support@wealthgrowerfinance.org</a>
                </p>
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

const cashappWithdrawalTemplate = (
  fullName,
  amount,
  cashTag,
  email,
  transferType,
  name
) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cash App Withdrawal Request - WealthGrower Finance</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, Helvetica, sans-serif; background-color: #f8fafc; color: #333333; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <table width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc;">
    <tr>
      <td align="center" style="padding: 40px 15px;">
        <table width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);">
          <tr>
            <td style="background-color: #50626a; padding: 30px; text-align: center; border-bottom: 4px solid #3a4a52;">
              <a href="#" style="display: inline-block; color: #ffffff; font-size: 32px; font-weight: 700; text-decoration: none; letter-spacing: -0.5px;">
                WealthGrower
                <span style="display: block; font-size: 16px; font-weight: 400; margin-top: 8px; opacity: 0.9;">Finance Bank</span>
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <div style="font-size: 48px; margin-bottom: 20px;">💳</div>
                <h2 style="font-size: 28px; margin-bottom: 15px; color: #50626a; font-weight: 700;">Cash App Transfer Request</h2>
                <p style="font-size: 18px; color: #555555; margin: 0;">Your instant transfer is being processed</p>
              </div>

              <h2 style="font-size: 20px; margin-bottom: 25px; color: #50626a; font-weight: 600;">Dear ${name},</h2>

              <p style="line-height: 1.7; margin-bottom: 25px; font-size: 16px; color: #555555;">
                We've received your Cash App withdrawal request and it is currently being processed for instant transfer to your account.
              </p>

              <div style="background-color: #f8f9fa; border-left: 5px solid #50626a; padding: 25px; margin: 30px 0; border-radius: 0 8px 8px 0;">
                <h3 style="margin-top: 0; color: #50626a; font-size: 18px; margin-bottom: 20px;">Transfer Details</h3>

                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Full Name:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">${fullName}</div>
                </div>

                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Amount:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">$${amount} USD</div>
                </div>

                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Cash Tag:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">${cashTag}</div>
                </div>

                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Email:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">${email}</div>
                </div>

                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Transfer Type:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">${transferType}</div>
                </div>

                <div style="display: inline-block; padding: 8px 16px; background-color: #fff3cd; color: #856404; border-radius: 6px; font-size: 14px; font-weight: 600; margin-top: 15px; border: 1px solid #ffeaa7;">
                  Status: Under Review
                </div>
              </div>

              <div style="margin-top: 35px; padding-top: 25px; border-top: 1px solid #eaeaea;">
                <h3 style="color: #50626a; margin-bottom: 20px; font-size: 18px; font-weight: 600;">Instant Transfer Timeline</h3>
                <ul style="padding-left: 20px; margin: 0;">
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #555555;">
                    Security verification and approval process (1-2 hours)
                  </li>
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #555555;">
                    Cash App instant transfer processing
                  </li>
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #555555;">
                    Funds typically arrive within minutes after approval
                  </li>
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #555555;">
                    You'll receive Cash App notification
                  </li>
                </ul>
              </div>

              <div style="background-color: #f0f7ff; padding: 20px; border-radius: 8px; margin-top: 25px; border: 1px solid #e1f0ff;">
                <h4 style="color: #50626a; margin-bottom: 10px; font-size: 16px;">Instant Transfer Features</h4>
                <p style="margin: 0; color: #555555; line-height: 1.6;">
                  Cash App instant transfers provide immediate access to your funds. Standard transfers are free, while instant transfers may include a small fee from Cash App.
                </p>
              </div>

              <div style="background-color: #fff8e6; padding: 15px; border-radius: 6px; margin-top: 20px; font-size: 13px; color: #856404; border: 1px solid #ffeaa7;">
                <strong>Verification Required:</strong> Please ensure your Cash App account is verified and can receive the specified amount. Unverified accounts may experience delays.
              </div>

              <div style="background-color: #f0f7ff; padding: 20px; border-radius: 8px; margin-top: 25px; border: 1px solid #e1f0ff;">
                <h4 style="color: #50626a; margin-bottom: 10px; font-size: 16px;">Need Help?</h4>
                <p style="margin: 0; color: #555555; line-height: 1.6;">
                  If you encounter any issues with your Cash App transfer or need to update your Cash Tag, please contact our support team at
                  <a href="mailto:support@wealthgrowerfinance.org" style="color: #50626a; text-decoration: none; font-weight: 500;">support@wealthgrowerfinance.org</a>
                </p>
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
