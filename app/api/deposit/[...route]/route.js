import { NextResponse } from "next/server";
import dbConnect from "../../../../lib/mongodb";
import Deposit from "../../../../models/Deposit";
import Wallet from "../../../../models/Wallet";
import { withAuth, withAdmin } from "../../../../lib/apiHander";

// CORS headers helper
function getCorsHeaders(request) {
  const origin = request.headers.get("origin") || "";
  const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:3002",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
  ];

  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, token, x-requested-with",
  };

  if (allowedOrigins.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  } else {
    headers["Access-Control-Allow-Origin"] = "*";
  }

  return headers;
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS(request) {
  const headers = getCorsHeaders(request);
  return new NextResponse(null, {
    status: 200,
    headers: {
      ...headers,
      "Access-Control-Max-Age": "86400",
    },
  });
}

// POST handler - Create deposit
export async function POST(request, { params }) {
  try {
    const { route } = await params;
    const headers = getCorsHeaders(request);
    await dbConnect();

    // Handle /api/deposit (create deposit)
    if (!route || route.length === 0) {
      const body = await request.json();
      return await withAuth(handleCreateDeposit)(request, headers, body);
    }

    return NextResponse.json(
      { error: "Endpoint not found" },
      { status: 404, headers }
    );
  } catch (error) {
    console.error("Deposit POST API Error:", error);
    const headers = getCorsHeaders(request);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers }
    );
  }
}

// PUT handler - Update deposit
export async function PUT(request, { params }) {
  try {
    const { route } = await params;
    const headers = getCorsHeaders(request);
    await dbConnect();

    if (!route || route.length === 0) {
      return NextResponse.json(
        { error: "Endpoint not found" },
        { status: 404, headers }
      );
    }

    const [id] = route;
    const body = await request.json();

    return await withAdmin(handleUpdateDeposit)(request, headers, id, body);
  } catch (error) {
    console.error("Deposit PUT API Error:", error);
    const headers = getCorsHeaders(request);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers }
    );
  }
}

// DELETE handler - Delete deposit
export async function DELETE(request, { params }) {
  try {
    const { route } = await params;
    const headers = getCorsHeaders(request);
    await dbConnect();

    if (!route || route.length === 0) {
      return NextResponse.json(
        { error: "Endpoint not found" },
        { status: 404, headers }
      );
    }

    const [id] = route;
    return await withAdmin(handleDeleteDeposit)(request, headers, id);
  } catch (error) {
    console.error("Deposit DELETE API Error:", error);
    const headers = getCorsHeaders(request);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers }
    );
  }
}

// GET handler - Get deposits
export async function GET(request, { params }) {
  try {
    const { route } = await params;
    const headers = getCorsHeaders(request);
    await dbConnect();

    // Handle /api/deposit (get all deposits - admin only)
    if (!route || route.length === 0) {
      return await withAdmin(handleGetAllDeposits)(request, headers);
    }

    // Handle /api/deposit/:id (get user's deposits)
    const [id] = route;
    return await withAuth(handleGetUserDeposits)(request, headers, id);
  } catch (error) {
    console.error("Deposit GET API Error:", error);
    const headers = getCorsHeaders(request);
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

async function handleCreateDeposit(req, headers, body) {
  try {
    // Note: File upload needs separate handling in Next.js
    // For now, we'll assume image URLs are provided in the body
    const referenceNumber = generateReferenceNumber();

    const newDeposit = new Deposit({
      ...body,
      referenceNumber: referenceNumber,
      image: body.image || [], // Array of image URLs
    });

    const savedDeposit = await newDeposit.save();

    return NextResponse.json(
      {
        message: "Deposit created successfully",
        deposit: savedDeposit,
      },
      { status: 201, headers }
    );
  } catch (error) {
    console.error("Create deposit error:", error);
    return NextResponse.json(
      { error: "Failed to create deposit" },
      { status: 500, headers }
    );
  }
}

async function handleUpdateDeposit(req, headers, id, body) {
  try {
    // Update the deposit record
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

      // Add deposit amount to balance
      wallet.balanceUSD += Number(updatedDeposit.amount);
      await wallet.save();
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

    return NextResponse.json(deletedDeposit, { status: 200, headers });
  } catch (error) {
    console.error("Delete deposit error:", error);
    return NextResponse.json(
      { error: "Failed to delete deposit" },
      { status: 500, headers }
    );
  }
}

async function handleGetUserDeposits(req, headers, userId) {
  try {
    const deposits = await Deposit.find({ userId: userId });

    if (!deposits || deposits.length === 0) {
      return NextResponse.json(
        { message: "No deposits found", deposits: [], totalAmount: 0 },
        { status: 200, headers }
      );
    }

    // Calculate total amount for this user
    const totalAmount = await Deposit.aggregate([
      { $match: { userId: userId } },
      {
        $group: { _id: null, totalAmount: { $sum: { $toDouble: "$amount" } } },
      },
    ]);

    return NextResponse.json(
      {
        deposits: deposits,
        totalAmount: totalAmount[0]?.totalAmount || 0,
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

async function handleGetAllDeposits(req, headers) {
  try {
    const deposits = await Deposit.find();

    // Calculate total amount deposited
    const totalAmount = await Deposit.aggregate([
      {
        $group: { _id: null, totalAmount: { $sum: { $toDouble: "$amount" } } },
      },
    ]);

    return NextResponse.json(
      {
        deposits: deposits,
        totalAmount: totalAmount[0]?.totalAmount || 0,
      },
      { status: 200, headers }
    );
  } catch (error) {
    console.error("Get all deposits error:", error);
    return NextResponse.json(
      { error: "Failed to fetch deposits" },
      { status: 500, headers }
    );
  }
}

const depositFailedEmailTemplate = (updatedDeposit) => {
  return `
  <!DOCTYPE html>
  <html>
    <body style="margin:0; padding:0; background-color:#e5f1fb; font-family:Arial, sans-serif;">
      <div style="max-width:600px; margin:40px auto; background:#ffffff; border:2px solid #dc2626; border-radius:8px; padding:30px;">

        <div style="text-align:center; margin-bottom:30px;">
          <img src="https://wealthwise-olive.vercel.app/static/media/mobilewealth.8bf93fd7d2dff4d41d7d.png" alt="WealthWise Logo" style="width:150px;">
        </div>

        <h2 style="color:#1c1c1c; text-align:start; margin-bottom:10px;">
          Deposit Update
          <span style="background:#dc2626; color:#fff; padding:2px 6px; border-radius:4px;">Failed</span>
        </h2>

        <p style="color:#1c1c1c; font-size:15px;">Dear <strong>${updatedDeposit.name}</strong>,</p>

        <p style="color:#dc2626; font-weight:600; font-size:15px;">
          Unfortunately, your deposit request could not be processed at this time.
        </p>

        <ul style="color:#1c1c1c; font-size:15px; list-style:none; padding:0; margin:20px 0; line-height:1.6;">
          <li><strong>Amount:</strong> $${updatedDeposit.amount} USD</li>
          <li><strong>Transaction Type:</strong> ${updatedDeposit.transactionType}</li>
          <li><strong>Reference Number:</strong> ${updatedDeposit.referenceNumber}</li>
          <li><strong>Status:</strong> Failed ❌</li>
        </ul>

        <p style="color:#1c1c1c; font-size:15px;">
          Please verify your payment details and try again. If the issue persists, contact support for assistance:
          <a href="mailto:support@wealthwise.com" style="color:#2563eb;">support@wealthwise.com</a>.
        </p>

        <p style="font-weight:bold; color:#004aad;">Sincerely,<br>The WealthWise Team</p>

        <div style="text-align:center; font-size:12px; color:#666; margin-top:30px;">
          &copy; 2025 WealthWise Bank. All rights reserved.
        </div>
      </div>
    </body>
  </html>
  `;
};

const depositApprovedEmailTemplate = (updatedDeposit) => {
  return `
  <!DOCTYPE html>
  <html>
    <body style="margin:0; padding:0; background-color:#e5f1fb; font-family:Arial, sans-serif;">
      <div style="max-width:600px; margin:40px auto; background:#ffffff; border:2px solid #16a34a; border-radius:8px; padding:30px;">

        <div style="text-align:center; margin-bottom:30px;">
          <img src="https://wealthwise-olive.vercel.app/static/media/mobilewealth.8bf93fd7d2dff4d41d7d.png" alt="WealthWise Logo" style="width:150px;">
        </div>

        <h2 style="color:#1c1c1c; text-align:start; margin-bottom:10px;">
          Deposit Update
          <span style="background:#16a34a; color:#fff; padding:2px 6px; border-radius:4px;">Approved</span>
        </h2>

        <p style="color:#1c1c1c; font-size:15px;">Dear <strong>${updatedDeposit.name}</strong>,</p>

        <p style="color:#16a34a; font-weight:600; font-size:15px;">
          Great news! Your deposit has been successfully processed and approved.
        </p>

        <ul style="color:#1c1c1c; font-size:15px; list-style:none; padding:0; margin:20px 0; line-height:1.6;">
          <li><strong>Amount:</strong> $${updatedDeposit.amount} USD</li>
          <li><strong>Transaction Type:</strong> ${updatedDeposit.transactionType}</li>
          <li><strong>Reference Number:</strong> ${updatedDeposit.referenceNumber}</li>
          <li><strong>Status:</strong> Approved ✅</li>
        </ul>

        <p style="color:#1c1c1c; font-size:15px;">
          You can now log in to your dashboard to view your updated balance:
          <a href="https://www.wealthwise.online/login" style="color:#2563eb; text-decoration:none;">Login Here</a>.
        </p>

        <p style="color:#1c1c1c; font-size:15px;">
          For any assistance, feel free to contact us at 
          <a href="mailto:support@wealthwise.online" style="color:#2563eb;">support@wealthwise.online</a>.
        </p>

        <p style="font-weight:bold; color:#004aad;">Best regards,<br>The WealthWise Team</p>

        <div style="text-align:center; font-size:12px; color:#666; margin-top:30px;">
          &copy; 2025 WealthWise Bank. All rights reserved.
        </div>
      </div>
    </body>
  </html>
  `;
};

const depositUploadEmailTemplate = (req, referenceNumber) => {
  return `
  <!DOCTYPE html>
  <html>
    <body style="margin:0; padding:0; background-color:#e5f1fb; font-family:Arial, sans-serif;">
      <div style="max-width:600px; margin:40px auto; background:#ffffff; border:2px solid #004aad; border-radius:8px; padding:30px;">

        <div style="text-align:center; margin-bottom:30px;">
          <img src="https://wealthwise-olive.vercel.app/static/media/mobilewealth.8bf93fd7d2dff4d41d7d.png" alt="WealthWise Logo" style="width:150px;">
        </div>

        <h2 style="color:#1c1c1c; text-align:start; margin-bottom:10px;">
          ${req.body.path === "" ? "Deposit Request " : "Card Deposit Request "}
          <span style="background:#facc15; color:#000; padding:2px 6px; border-radius:4px;">Received</span>
        </h2>

        <p style="color:#1c1c1c; font-size:15px;">Dear <strong>${
          req.body.name
        }</strong>,</p>

        <p style="color:#16a34a; font-weight:600; font-size:15px;">
          Your ${
            req.body.path === "" ? "deposit" : "card deposit"
          } request has been submitted successfully and is currently pending review by our finance team.
        </p>

        <ul style="color:#1c1c1c; font-size:15px; list-style:none; padding:0; margin:20px 0; line-height:1.6;">
          <li><strong>Amount:</strong> $${req.body.amount} USD</li>
          <li><strong>Transaction Type:</strong> ${
            req.body.transactionType
          }</li>
          <li><strong>Reference Number:</strong> ${referenceNumber}</li>
          <li><strong>Status:</strong> Pending Review</li>
        </ul>

        <p style="color:#1c1c1c; font-size:15px;">
          You will receive an update once your deposit has been reviewed and processed. 
          To check the status, please visit your dashboard:
          <a href="https://www.wealthwise.online/login" style="color:#2563eb; text-decoration:none;">Login Here</a>.
        </p>

        <p style="color:#1c1c1c; font-size:15px;">
          If you have any questions, please reach out to our support team at 
          <a href="mailto:support@wealthwise.online" style="color:#2563eb;">support@wealthwise.online</a>.
        </p>

        <p style="color:#1c1c1c; font-size:15px;">
          Thank you for banking with <strong>WealthWise</strong>.
        </p>

        <p style="font-weight:bold; color:#004aad;">Best regards,<br>WealthWise Team</p>

        <div style="text-align:center; font-size:12px; color:#666; margin-top:30px;">
          &copy; 2025 WealthWise Bank. All rights reserved.
        </div>
      </div>
    </body>
  </html>
  `;
};
