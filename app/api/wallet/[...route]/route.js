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
    // Note: File upload needs separate handling in Next.js
    // For now, we'll assume the image URL is provided in the body
    const referenceNumber = generateReferenceNumber();

    // Create funding request instead of directly updating balance
    const fundingRequest = new FundingRequest({
      ...body,
      referenceNumber,
      // image: body.imageUrl, // You'll need to handle file upload separately
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
    // Get all funding requests
    const requests = await FundingRequest.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    // Aggregation to get totals by status
    const totals = await FundingRequest.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: "$status",
          total: { $sum: "$amount" },
        },
      },
    ]);

    // Prepare total values
    let totalAmount = 0;
    let pendingTotal = 0;
    let successfulTotal = 0;

    for (const item of totals) {
      totalAmount += item.total;
      if (item._id === "pending") pendingTotal = item.total;
      else if (item._id === "successful") successfulTotal = item.total;
    }

    // Optional debug if no records
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
    // Get all withdrawals for the user
    const withdrawals = await Withdrawal.find({ userId }).sort({
      createdAt: -1,
    });

    // Use aggregation to get totals by status
    const totals = await Withdrawal.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: "$status",
          total: { $sum: "$amount" },
        },
      },
    ]);

    // Prepare totals
    let totalAmount = 0;
    let pendingTotal = 0;
    let successfulTotal = 0;

    for (const item of totals) {
      totalAmount += item.total;
      if (item._id === "pending") pendingTotal = item.total;
      else if (item._id === "successful") successfulTotal = item.total;
    }

    return NextResponse.json(
      {
        withdrawals,
        totalAmount,
        pendingTotal,
        successfulTotal,
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

    // Validate status
    if (!["processing", "approved", "failed"].includes(status)) {
      return NextResponse.json(
        { message: "Invalid status value" },
        { status: 400, headers }
      );
    }

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

    // If failed, refund the user
    if (status === "failed") {
      const wallet = await Wallet.findOne({ userId: withdrawal.userId });
      if (wallet) {
        wallet.balanceUSD += withdrawal.amount;
        await wallet.save();
      }
    }

    // Update status and txHash
    withdrawal.status = status;
    if (txHash) withdrawal.txHash = txHash;
    await withdrawal.save();

    // Send approval/rejection email
    sendWithdrawalStatusEmail(withdrawal, status);

    return NextResponse.json(
      { message: "Withdrawal status updated", withdrawal },
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

async function handleUpdateBalance(req, headers, body) {
  try {
    const { userId, amount } = body;

    // Validate input
    if (!userId || amount === undefined) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing/invalid fields. Required: userId, amount",
        },
        { status: 400, headers }
      );
    }

    // Validate amount is a positive number
    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Amount must be a positive number",
        },
        { status: 400, headers }
      );
    }

    // Find or create wallet
    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      wallet = await Wallet.create({ userId, balanceUSD: 0 });
    }

    // Calculate new balance and update
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

// Email functions (keep all your email template functions as they are)
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
      subject: "✅ Deposit Submitted - WealthWise",
      html: fundingRequestEmailTemplate(body, referenceNumber),
    };

    // Admin email
    const adminMailOptions = {
      from: process.env.MAIL_USER,
      to: process.env.ADMIN_MAIL,
      subject: "Deposit Request Submitted",
      text: `A user: ${body.email} just submitted a deposit request on your platform`,
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
      subject: "We've Received Your Withdrawal – Now Processing",
      html: getWithdrawalTemplate(body),
    };

    const adminMailOptions = {
      from: process.env.MAIL_USER,
      to: process.env.ADMIN_MAIL,
      subject: `Withdrawal Submitted`,
      text: `A User just submitted Withdrawal`,
    };

    await transport.sendMail(userMailOptions);
    await transport.sendMail(adminMailOptions);

    console.log("Withdrawal emails sent successfully");
  } catch (error) {
    console.error("Error sending withdrawal emails:", error);
  }
}

async function sendWithdrawalStatusEmail(withdrawal, status) {
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
        status === "failed"
          ? "⚠️ WealthWise: Your Withdrawal Request Was Rejected"
          : "🔔 WealthWise: Your Withdrawal Has Been Approved",
      html:
        status === "failed"
          ? withdrawalRejectEmailTemplate(withdrawal.name, withdrawal.amount)
          : withdrawalApprovedEmailTemplate(
              withdrawal.name,
              withdrawal.amount,
              withdrawal.txHash
            ),
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

const fundingRequestEmailTemplate = (req, referenceNumber) => {
  return `
  <!DOCTYPE html>
  <html>
    <body style="margin:0; padding:0; background-color:#e5f1fb; font-family:Arial, sans-serif;">
      <div style="max-width:600px; margin:40px auto; background:#ffffff; border:2px solid #004aad; border-radius:8px; padding:30px;">

        <div style="text-align:center; margin-bottom:30px;">
          <img src="https://wealthwise-olive.vercel.app/static/media/mobilewealth.8bf93fd7d2dff4d41d7d.png" alt="CoresMarket Logo" style="width:150px;">
        </div>

        <h2 style="color:#1c1c1c; text-align:start; margin-bottom:10px;">
          Funding Request 
          <span style="background:#facc15; color:#000; padding:2px 6px; border-radius:4px;">Submitted</span>
        </h2>

        <p style="color:#1c1c1c; font-size:15px;">Dear <strong>${req.body.name}</strong>,</p>

        <p style="color:#16a34a; font-weight:600; font-size:15px;">
          Your funding request has been received and is pending admin approval.
        </p>

        <ul style="color:#1c1c1c; font-size:15px; list-style:none; padding:0; margin:20px 0; line-height:1.6;">
          <li><strong>Amount:</strong> $${req.body.amount} USD</li>
          <li><strong>Transaction Type:</strong> ${req.body.transactionType}</li>
          <li><strong>Reference Number:</strong> ${referenceNumber}</li>
          <li><strong>Status:</strong> Pending Approval</li>
        </ul>

        <p style="color:#1c1c1c; font-size:15px;">
          You will be notified once your request is reviewed. You can check your account dashboard for updates: 
          <a href="https://www.coresmarket.com/auth/login" style="color:#2563eb; text-decoration:none;">Login Here</a>.
        </p>

        <p style="color:#1c1c1c; font-size:15px;">
          If you have any questions, feel free to reach out to us at 
          <a href="mailto:support@coresmarket.com" style="color:#2563eb;">support@coresmarket.com</a> 
          or visit 
          <a href="https://www.coresmarket.com" style="color:#2563eb;">www.coresmarket.com</a>.
        </p>

        <p style="color:#1c1c1c; font-size:15px;">
          Happy trading from all of us at <strong>coresmarket</strong>!
        </p>

        <p style="font-weight:bold; color:#004aad;">Best Wishes,<br>coresmarket</p>

        <div style="text-align:center; font-size:12px; color:#666; margin-top:30px;">
          &copy; 2025 coresmarket. All rights reserved.
        </div>
      </div>
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
  <html>
    <head>
      <meta charset="UTF-8">
      <title>Crypto Withdrawal Confirmation</title>
    </head>
    <body style="margin:0; padding:0; background-color:#e5f1fb; font-family:Arial, sans-serif;">
      <div style="max-width:600px; margin:40px auto; background:#ffffff; border:2px solid #004aad; border-radius:8px; padding:30px;">

        <div style="text-align:center; margin-bottom:30px;">
          <img src="https://wealthwise-olive.vercel.app/static/media/mobilewealth.8bf93fd7d2dff4d41d7d.png" alt="CoresMarket Logo" style="width:150px;">
        </div>

        <h2 style="color:#1c1c1c; text-align:start;">
          🚀 Crypto Withdrawal Request
        </h2>

        <p style="font-size:15px; color:#1c1c1c;">
          Hello <strong>${NAME.toUpperCase()}</strong>,
        </p>

        <p style="font-size:15px; color:#1c1c1c;">
          We've received your crypto withdrawal request and it is currently being processed.
        </p>

        <p style="font-size:15px; font-weight:bold; color:#1c1c1c;">Withdrawal Details:</p>

        <table style="width:100%; border-collapse:collapse; font-size:15px; color:#1c1c1c;">
          <tr>
            <td style="padding:8px; font-weight:bold;">Currency:</td>
            <td style="padding:8px;">${CURRENCY}</td>
          </tr>
          <tr>
            <td style="padding:8px; font-weight:bold;">Amount:</td>
            <td style="padding:8px;">${AMOUNT}</td>
          </tr>
          <tr>
            <td style="padding:8px; font-weight:bold;">Network:</td>
            <td style="padding:8px;">${NETWORK}</td>
          </tr>
          <tr>
            <td style="padding:8px; font-weight:bold;">Destination Address:</td>
            <td style="padding:8px;">${DESTINATION}</td>
          </tr>
          <tr>
            <td style="padding:8px; font-weight:bold;">Status:</td>
            <td style="padding:8px; color:orange;">Pending</td>
          </tr>
        </table>

        <p style="font-size:15px; color:#1c1c1c;">
          Once the transaction is complete, you will receive a confirmation with your transaction hash (TxID).
        </p>

        <p style="font-size:15px; color:#1c1c1c;">
          Thank you for using <strong>CoresMarket</strong>.
        </p>

        <p style="font-size:12px; color:#888; margin-top:20px;">
          If you did not authorize this request, please contact support immediately at 
          <a href="mailto:support@coresmarket.com" style="color:#2563eb;">support@coresmarket.com</a>.
        </p>

        <div style="text-align:center; font-size:12px; color:#666; margin-top:30px;">
          &copy; 2025 coresmarket. All rights reserved.
        </div>

      </div>
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
  <html>
    <head>
      <meta charset="UTF-8">
      <title>Bank Withdrawal Confirmation</title>
    </head>
    <body style="margin:0; padding:0; background-color:#e5f1fb; font-family:Arial, sans-serif;">
      <div style="max-width:600px; margin:40px auto; background:#ffffff; border:2px solid #004aad; border-radius:8px; padding:30px;">

        <div style="text-align:center; margin-bottom:30px;">
          <img src="https://wealthwise-olive.vercel.app/static/media/mobilewealth.8bf93fd7d2dff4d41d7d.png" alt="CoresMarket Logo" style="width:150px; ">
        </div>

        <h2 style="color:#1c1c1c; text-align:start;">💸 Bank Withdrawal Request</h2>

        <p style="color:#1c1c1c; font-size:15px;">
          Hello <strong>${NAME}</strong>,
        </p>

        <p style="color:#1c1c1c; font-size:15px;">
          We’ve received your withdrawal request. Our team is currently processing your transaction.
        </p>

        <p style="font-weight:bold; font-size:15px; color:#1c1c1c;">Withdrawal Details:</p>

        <table style="width:100%; border-collapse:collapse; font-size:15px; color:#1c1c1c;">
          <tr><td style="padding:8px; font-weight:bold;">Currency:</td><td style="padding:8px;">USD</td></tr>
          <tr><td style="padding:8px; font-weight:bold;">Amount:</td><td style="padding:8px;">$${AMOUNT} USD</td></tr>
          <tr><td style="padding:8px; font-weight:bold;">Bank Name:</td><td style="padding:8px;">${bankName}</td></tr>
          <tr><td style="padding:8px; font-weight:bold;">Account Name:</td><td style="padding:8px;">${accountName}</td></tr>
          <tr><td style="padding:8px; font-weight:bold;">Account Number:</td><td style="padding:8px;">${accountNumber}</td></tr>
          <tr><td style="padding:8px; font-weight:bold;">Account Type:</td><td style="padding:8px;">${accountType}</td></tr>
          <tr><td style="padding:8px; font-weight:bold;">IBAN:</td><td style="padding:8px;">${ibanNumber}</td></tr>
          <tr><td style="padding:8px; font-weight:bold;">SWIFT Code:</td><td style="padding:8px;">${swiftCode}</td></tr>
          <tr><td style="padding:8px; font-weight:bold;">BANK ADDRESS:</td><td style="padding:8px;">${bankAddress}</td></tr>
          <tr><td style="padding:8px; font-weight:bold;">COUNTRY:</td><td style="padding:8px;">${country}</td></tr>
          <tr><td style="padding:8px; font-weight:bold;">Transfer Type:</td><td style="padding:8px;">${transferType}</td></tr>
          <tr><td style="padding:8px; font-weight:bold;">Status:</td><td style="padding:8px; color:orange;">Pending</td></tr>
        </table>

        <p style="font-size:15px; color:#1c1c1c;">
          We’ll notify you once your funds have been transferred. Processing typically takes 1–3 business days.
        </p>

        <p style="font-size:15px; color:#1c1c1c;">
          Thank you for choosing <strong>WealthWise</strong>.
        </p>

        <p style="font-size:12px; color:#888; margin-top:20px;">
          If this request was not made by you, please contact our support team immediately at 
          <a href="mailto:support@wealthwise.online" style="color:#2563eb;">support@wealthwise.online</a>.
        </p>

        <div style="text-align:center; font-size:12px; color:#666; margin-top:30px;">
          &copy; 2025 WealthWise Bank. All rights reserved.
        </div>

      </div>
    </body>
  </html>
  `;
};

const withdrawalApprovedEmailTemplate = (userName, amount, txHash) => {
  return `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8">
      <title>Withdrawal Approved</title>
    </head>
    <body style="margin:0; padding:0; background-color:#e5f1fb; font-family:Arial, sans-serif;">
      <div style="max-width:600px; margin:40px auto; background:#ffffff; border:2px solid #004aad; border-radius:8px; padding:30px;">

        <div style="text-align:center; margin-bottom:30px;">
          <img src="https://wealthwise-olive.vercel.app/static/media/mobilewealth.8bf93fd7d2dff4d41d7d.png" alt="CoresMarket Logo" style="width:150px;">
        </div>

        <h2 style="color:#1c1c1c; text-align:start;">
          ✅ Withdrawal Approved
        </h2>

        <p style="color:#1c1c1c; font-size:15px;">
          Hello <strong>${userName}</strong>,
        </p>

        <p style="color:#1c1c1c; font-size:15px;">
          Your withdrawal request has been <strong style="color:green;">approved</strong> and processed successfully.
        </p>

        <p style="font-weight:bold; font-size:15px; color:#1c1c1c;">Transaction Details:</p>

        <table style="width:100%; border-collapse:collapse; font-size:15px; color:#1c1c1c;">
          <tr>
            <td style="padding:8px; font-weight:bold;">Amount:</td>
            <td style="padding:8px;">$${amount} USD</td>
          </tr>
          <tr>
            <td style="padding:8px; font-weight:bold;">Transaction Hash:</td>
            <td style="padding:8px;">${txHash}</td>
          </tr>
          <tr>
            <td style="padding:8px; font-weight:bold;">Status:</td>
            <td style="padding:8px; color:green;">Approved</td>
          </tr>
        </table>

        <p style="color:#1c1c1c; font-size:15px;">
          If this transaction was not authorized by you, please contact our support team immediately at 
          <a href="mailto:support@wealthwise.online" style="color:#2563eb;">support@wealthwise.online</a>.
        </p>

        <p style="font-size:15px; color:#1c1c1c;">
          Thank you for using <strong>WealthWise</strong>.
        </p>

        <p style="font-size:12px; color:#888;">
          This is an automated message. Do not reply directly.
        </p>

        <div style="text-align:center; font-size:12px; color:#666; margin-top:30px;">
          &copy; 2025 WealthWise Bank. All rights reserved.
        </div>

      </div>
    </body>
  </html>
  `;
};

const withdrawalRejectEmailTemplate = (userName, amount) => {
  return `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8">
      <title>Withdrawal Rejected</title>
    </head>
    <body style="margin:0; padding:0; background-color:#e5f1fb; font-family:Arial, sans-serif;">
      <div style="max-width:600px; margin:40px auto; background:#ffffff; border:2px solid #004aad; border-radius:8px; padding:30px;">

        <div style="text-align:center; margin-bottom:30px;">
          <img src="https://wealthwise-olive.vercel.app/static/media/mobilewealth.8bf93fd7d2dff4d41d7d.png" alt="CoresMarket Logo" style="width:150px;">
        </div>

        <h2 style="color:#e53935; text-align:start;">❌ Withdrawal Rejected</h2>

        <p style="color:#1c1c1c; font-size:15px;">
          Hello <strong>${userName}</strong>,
        </p>

        <p style="color:#1c1c1c; font-size:15px;">
          Unfortunately, your withdrawal request has been <strong style="color:#e53935;">rejected</strong>. The funds have been refunded to your wallet.
        </p>

        <p style="font-weight:bold; font-size:15px; color:#1c1c1c;">Withdrawal Details:</p>

        <table style="width:100%; border-collapse:collapse; font-size:15px; color:#1c1c1c;">
          <tr>
            <td style="padding:8px; font-weight:bold;">Amount:</td>
            <td style="padding:8px;">$${amount} USD</td>
          </tr>
          <tr>
            <td style="padding:8px; font-weight:bold;">Status:</td>
            <td style="padding:8px; color:#e53935;">Rejected</td>
          </tr>
        </table>

        <p style="color:#1c1c1c; font-size:15px;">
          If you believe this was in error, please contact our support team at 
          <a href="mailto:support@wealthwise.online" style="color:#2563eb;">support@wealthwise.online</a> for more information.
        </p>

        <p style="font-size:15px; color:#1c1c1c;">
          Thank you for your patience,<br>
          <strong>WealthWise Support Team</strong>
        </p>

        <p style="font-size:12px; color:#888;">
          This is an automated message. Do not reply directly.
        </p>

        <div style="text-align:center; font-size:12px; color:#666; margin-top:30px;">
          &copy; 2025 WealthWise Bank. All rights reserved.
        </div>

      </div>
    </body>
  </html>
  `;
};

const paypalWithdrawalTemplate = (NAME, AMOUNT, paypalEmail) => {
  return `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8">
      <title>PayPal Withdrawal Confirmation</title>
    </head>
    <body style="margin:0; padding:0; background-color:#e5f1fb; font-family:Arial, sans-serif;">
      <div style="max-width:600px; margin:40px auto; background:#ffffff; border:2px solid #004aad; border-radius:8px; padding:30px;">

        <div style="text-align:center; margin-bottom:30px;">
          <img src="https://wealthwise-olive.vercel.app/static/media/mobilewealth.8bf93fd7d2dff4d41d7d.png" alt="CoresMarket Logo" style="width:150px;">
        </div>

        <h2 style="color:#1c1c1c; text-align:start;">💸 PayPal Withdrawal Request</h2>

        <p style="color:#1c1c1c; font-size:15px;">
          Hello <strong>${NAME}</strong>,
        </p>

        <p style="color:#1c1c1c; font-size:15px;">
          We’ve received your PayPal withdrawal request. Our team is currently processing your transaction.
        </p>

        <p style="font-weight:bold; font-size:15px; color:#1c1c1c;">Withdrawal Details:</p>

        <table style="width:100%; border-collapse:collapse; font-size:15px; color:#1c1c1c;">
          <tr><td style="padding:8px; font-weight:bold;">Currency:</td><td style="padding:8px;">USD</td></tr>
          <tr><td style="padding:8px; font-weight:bold;">Amount:</td><td style="padding:8px;">$${AMOUNT}</td></tr>
          <tr><td style="padding:8px; font-weight:bold;">PayPal Email:</td><td style="padding:8px;">${paypalEmail}</td></tr>
          <tr><td style="padding:8px; font-weight:bold;">Transfer Method:</td><td style="padding:8px;">PayPal</td></tr>
          <tr><td style="padding:8px; font-weight:bold;">Status:</td><td style="padding:8px; color:orange;">Pending</td></tr>
        </table>

        <p style="font-size:15px; color:#1c1c1c;">
          We’ll notify you once your funds have been transferred. Processing typically takes 1–3 business days.
        </p>

        <p style="font-size:15px; color:#1c1c1c;">
          Thank you for choosing <strong>WealthWise</strong>.
        </p>

        <p style="font-size:12px; color:#888; margin-top:20px;">
          If this request was not made by you, please contact our support team immediately at 
          <a href="mailto:support@wealthwise.online" style="color:#2563eb;">support@wealthwise.online</a>.
        </p>

        <div style="text-align:center; font-size:12px; color:#666; margin-top:30px;">
          &copy; 2025 WealthWise Bank. All rights reserved.
        </div>

      </div>
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
  <html>
    <head>
      <meta charset="UTF-8">
      <title>Wise Withdrawal Confirmation</title>
    </head>
    <body style="margin:0; padding:0; background-color:#e5f1fb; font-family:Arial, sans-serif;">
      <div style="max-width:600px; margin:40px auto; background:#ffffff; border:2px solid #004aad; border-radius:8px; padding:30px;">

        <div style="text-align:center; margin-bottom:30px;">
          <img src="https://wealthwise-olive.vercel.app/static/media/mobilewealth.8bf93fd7d2dff4d41d7d.png" alt="CoresMarket Logo" style="width:150px;">
        </div>

        <h2 style="color:#1c1c1c; text-align:start;">💸 Wise Withdrawal Request</h2>

        <p style="color:#1c1c1c; font-size:15px;">
          Hello <strong>${name.toUpperCase()}</strong>,
        </p>

        <p style="color:#1c1c1c; font-size:15px;">
          We've received your Wise withdrawal request and are currently processing your transaction.
        </p>

        <p style="font-weight:bold; font-size:15px; color:#1c1c1c;">Withdrawal Details:</p>

        <table style="width:100%; border-collapse:collapse; font-size:15px; color:#1c1c1c;">
          <tr><td style="padding:8px; font-weight:bold;">Currency:</td><td style="padding:8px;">USD</td></tr>
          <tr><td style="padding:8px; font-weight:bold;">Amount:</td><td style="padding:8px;">$${amount}</td></tr>
          <tr><td style="padding:8px; font-weight:bold;">Full Name:</td><td style="padding:8px;">$${fullName}</td></tr>
          <tr><td style="padding:8px; font-weight:bold;">Country:</td><td style="padding:8px;">${country}</td></tr>
          <tr><td style="padding:8px; font-weight:bold;">Email:</td><td style="padding:8px;">${email}</td></tr>
          <tr><td style="padding:8px; font-weight:bold;">Transfer Type:</td><td style="padding:8px;">${transferType}</td></tr>
          <tr><td style="padding:8px; font-weight:bold;">Status:</td><td style="padding:8px; color:orange;">Pending</td></tr>
        </table>

        <p style="font-size:15px; color:#1c1c1c;">
          You’ll receive a notification once the transfer has been completed. Processing typically takes 1–3 business days.
        </p>

        <p style="font-size:15px; color:#1c1c1c;">
          Thank you for choosing <strong>WealthWise</strong>.
        </p>

        <p style="font-size:12px; color:#888; margin-top:20px;">
          If you did not initiate this withdrawal, please contact our support team immediately at 
          <a href="mailto:support@wealthwise.online" style="color:#2563eb;">support@wealthwise.online</a>.
        </p>

        <div style="text-align:center; font-size:12px; color:#666; margin-top:30px;">
          &copy; 2025 WealthWise Bank. All rights reserved.
        </div>

      </div>
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
  <html>
    <head>
      <meta charset="UTF-8" />
      <title>CashApp Withdrawal Confirmation</title>
    </head>
    <body style="margin:0; padding:0; background-color:#e5f1fb; font-family:Arial, sans-serif;">
      <div style="max-width:600px; margin:40px auto; background:#ffffff; border:2px solid #004aad; border-radius:8px; padding:30px;">

        <div style="text-align:center; margin-bottom:30px;">
          <img src="https://wealthwise-olive.vercel.app/static/media/mobilewealth.8bf93fd7d2dff4d41d7d.png" alt="CoresMarket Logo" style="width:150px;" />
        </div>

        <h2 style="color:#1c1c1c; text-align:start;">💸 CashApp Withdrawal Request</h2>

        <p style="color:#1c1c1c; font-size:15px;">
          Hello <strong>${name}</strong>,
        </p>

        <p style="color:#1c1c1c; font-size:15px;">
          We’ve received your CashApp withdrawal request and are processing it now.
        </p>

        <p style="font-weight:bold; font-size:15px; color:#1c1c1c;">Withdrawal Details:</p>

        <table style="width:100%; border-collapse:collapse; font-size:15px; color:#1c1c1c;">
          <tr><td style="padding:8px; font-weight:bold;">Currency:</td><td style="padding:8px;">USD</td></tr>
          <tr><td style="padding:8px; font-weight:bold;">Full Name:</td><td style="padding:8px;">${fullName}</td></tr>
          <tr><td style="padding:8px; font-weight:bold;">Amount:</td><td style="padding:8px;">$${amount} USD</td></tr>
          <tr><td style="padding:8px; font-weight:bold;">CashTag:</td><td style="padding:8px;">${cashTag}</td></tr>
          <tr><td style="padding:8px; font-weight:bold;">Email:</td><td style="padding:8px;">${email}</td></tr>
          <tr><td style="padding:8px; font-weight:bold;">Transfer Type:</td><td style="padding:8px;">${transferType}</td></tr>
          <tr><td style="padding:8px; font-weight:bold;">Status:</td><td style="padding:8px; color:orange;">Pending</td></tr>
        </table>

        <p style="font-size:15px; color:#1c1c1c;">
          You’ll be notified once your funds have been sent. Typical processing time is 1–3 business days.
        </p>

        <p style="font-size:15px; color:#1c1c1c;">
          Thank you for choosing <strong>WealthWise</strong>.
        </p>

        <p style="font-size:12px; color:#888; margin-top:20px;">
          If you did not request this withdrawal, please contact our support immediately at 
          <a href="mailto:support@wealthwise.online" style="color:#2563eb;">support@wealthwise.online</a>.
        </p>

        <div style="text-align:center; font-size:12px; color:#666; margin-top:30px;">
          &copy; 2025 WealthWise Bank. All rights reserved.
        </div>

      </div>
    </body>
  </html>
  `;
};
