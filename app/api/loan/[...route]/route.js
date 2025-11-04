import { NextResponse } from "next/server";
import dbConnect from "../../../../lib/mongodb";
import Loan from "../../../../models/Loan";
import Wallet from "../../../../models/Wallet";
import { withAuth, withAdmin } from "../../../../lib/apiHander";
import nodemailer from "nodemailer";

import { corsHeaders, handleOptions } from "../../../../lib/cors";

export async function OPTIONS(request) {
  return handleOptions(request);
}

// POST handler - Create loan
export async function POST(request, { params }) {
  try {
    const { route } = await params;
    const headers = corsHeaders(request);
    await dbConnect();

    const body = await request.json();

    // Handle loan creation
    if (!route || route.length === 0) {
      return await withAuth(handleCreateLoan)(request, headers, body);
    }

    return NextResponse.json(
      { error: "Endpoint not found" },
      { status: 404, headers }
    );
  } catch (error) {
    console.error("Loan POST API Error:", error);
    const headers = corsHeaders(request);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers }
    );
  }
}

// PUT handler - Update loan
export async function PUT(request, { params }) {
  try {
    const { route } = await params;
    const headers = corsHeaders(request);
    await dbConnect();

    const body = await request.json();

    if (!route || route.length === 0) {
      return NextResponse.json(
        { error: "Endpoint not found" },
        { status: 404, headers }
      );
    }

    const [id] = route;
    return await withAdmin(handleUpdateLoan)(request, headers, id, body);
  } catch (error) {
    console.error("Loan PUT API Error:", error);
    const headers = corsHeaders(request);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers }
    );
  }
}

// DELETE handler - Delete loan
export async function DELETE(request, { params }) {
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

    const [id] = route;
    return await withAdmin(handleDeleteLoan)(request, headers, id);
  } catch (error) {
    console.error("Loan DELETE API Error:", error);
    const headers = corsHeaders(request);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers }
    );
  }
}

// GET handler - Get loans
export async function GET(request, { params }) {
  try {
    const { route } = await params;
    const headers = corsHeaders(request);
    await dbConnect();

    // Handle /api/loan (get all loans - admin only)
    if (!route || route.length === 0) {
      return await withAdmin(handleGetAllLoans)(request, headers);
    }

    // Handle /api/loan/:id (get user's loans)
    const [id] = route;
    return await withAuth(handleGetUserLoans)(request, headers, id);
  } catch (error) {
    console.error("Loan GET API Error:", error);
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

async function handleCreateLoan(req, headers, body) {
  try {
    const referenceNumber = generateReferenceNumber();
    const newLoan = new Loan({
      ...body,
      referenceNumber,
    });

    const savedLoan = await newLoan.save();

    // Send emails (fire and forget)
    sendLoanSubmissionEmails(savedLoan, body.email);

    return NextResponse.json(
      { message: "Loan granted successfully", loan: savedLoan },
      { status: 201, headers }
    );
  } catch (error) {
    console.error("Create loan error:", error);
    return NextResponse.json(
      { error: "Failed to create loan" },
      { status: 500, headers }
    );
  }
}

async function handleUpdateLoan(req, headers, id, body) {
  try {
    const updatedLoan = await Loan.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true }
    );

    if (!updatedLoan) {
      return NextResponse.json(
        { error: "Loan not found" },
        { status: 404, headers }
      );
    }

    // If loan is approved (status === "true"), update wallet
    if (updatedLoan && body.status === "true") {
      const loanAmount = Number(updatedLoan.amount);

      // Update user's wallet balance
      const wallet = await Wallet.findOne({ userId: updatedLoan.userId });

      if (wallet) {
        wallet.balanceUSD += loanAmount;
        await wallet.save();
      } else {
        // If wallet doesn't exist, create one
        await Wallet.create({
          userId: updatedLoan.userId,
          balanceUSD: loanAmount,
        });
      }

      // Send approval email
      await sendLoanApprovalEmail(updatedLoan);
    }

    return NextResponse.json(updatedLoan, { status: 200, headers });
  } catch (error) {
    console.error("Update loan error:", error);
    return NextResponse.json(
      { error: "Failed to update loan" },
      { status: 500, headers }
    );
  }
}

async function handleDeleteLoan(req, headers, id) {
  try {
    const deletedLoan = await Loan.findByIdAndDelete(id);

    if (!deletedLoan) {
      return NextResponse.json(
        { error: "Loan not found" },
        { status: 404, headers }
      );
    }

    return NextResponse.json(deletedLoan, { status: 200, headers });
  } catch (error) {
    console.error("Delete loan error:", error);
    return NextResponse.json(
      { error: "Failed to delete loan" },
      { status: 500, headers }
    );
  }
}

async function handleGetAllLoans(req, headers) {
  try {
    const loans = await Loan.find();

    // Calculate total amount
    const totalAmount = await Loan.aggregate([
      {
        $group: { _id: null, totalAmount: { $sum: { $toDouble: "$amount" } } },
      },
    ]);

    return NextResponse.json(
      {
        loan: loans,
        totalAmount: totalAmount[0]?.totalAmount || 0,
      },
      { status: 200, headers }
    );
  } catch (error) {
    console.error("Get all loans error:", error);
    return NextResponse.json(
      { error: "Failed to fetch loans" },
      { status: 500, headers }
    );
  }
}

async function handleGetUserLoans(req, headers, userId) {
  try {
    const loans = await Loan.find({ userId: userId });

    if (!loans || loans.length === 0) {
      return NextResponse.json(
        { message: "No loans found", loan: [], totalAmount: 0 },
        { status: 200, headers }
      );
    }

    // Calculate total amount for this user
    const totalAmount = await Loan.aggregate([
      { $match: { userId: userId } },
      {
        $group: { _id: null, totalAmount: { $sum: { $toDouble: "$amount" } } },
      },
    ]);

    return NextResponse.json(
      {
        loan: loans,
        totalAmount: totalAmount[0]?.totalAmount || 0,
      },
      { status: 200, headers }
    );
  } catch (error) {
    console.error("Get user loans error:", error);
    return NextResponse.json(
      { error: "Failed to fetch user loans" },
      { status: 500, headers }
    );
  }
}

// Email functions
async function sendLoanSubmissionEmails(loan, userEmail) {
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
      to: userEmail,
      subject: "Loan Application is in Progress",
      html: loanSubmissionTemplate(loan),
    };

    // Admin email
    const adminMailOptions = {
      from: process.env.MAIL_USER,
      to: process.env.ADMIN_MAIL,
      subject: "A New User Is Asking For Loan",
      text: `A User with the name ${loan.name} just submitted a loan application.`,
    };

    await transport.sendMail(userMailOptions);
    await transport.sendMail(adminMailOptions);

    console.log("Loan submission emails sent successfully");
  } catch (error) {
    console.error("Error sending loan submission emails:", error);
  }
}

async function sendLoanApprovalEmail(loan) {
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
      to: loan.email,
      subject: "Loan Application Approved",
      html: loanApprovalTemplate(loan),
    };

    await transport.sendMail(userMailOptions);
    console.log("Loan approval email sent successfully");
  } catch (error) {
    console.error("Error sending loan approval email:", error);
  }
}

// Email template functions (keep the same)
const emailLayout = (title, contentHtml) => {
  return `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8" />
      <title>${title}</title>
    </head>
    <body style="margin:0; padding:0; background-color:#e5f1fb; font-family:Arial, sans-serif;">
      <div style="max-width:600px; margin:40px auto; background:#ffffff; border:2px solid #004aad; border-radius:8px; padding:30px;">

        <div style="text-align:center; margin-bottom:30px;">
          <img src="https://wealthwise-olive.vercel.app/static/media/mobilewealth.8bf93fd7d2dff4d41d7d.png" alt="WealthWise Logo" style="width:150px;">
        </div>

        ${contentHtml}

        <p style="font-size:12px; color:#888; margin-top:20px;">
          If you have any questions or concerns, please contact our support team at 
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

const loanApprovalTemplate = (user) => {
  const content = `
    <h2 style="color:#1c1c1c;">🎉 Loan Approved</h2>
    <p>Dear <strong>${user.firstName}</strong>,</p>
    <p>Congratulations! Your <strong>${user.loanType}</strong> loan of <strong>$${user.amount}</strong> has been approved.</p>
    <p>The funds have been added to your wallet and are now available for use.</p>
    <p>Thank you for choosing <strong>WealthWise</strong>.</p>
  `;
  return emailLayout("Loan Approval Notification", content);
};

const loanSubmissionTemplate = (loan) => {
  const {
    firstName,
    loanType,
    amount,
    term,
    email,
    phone,
    employmentStatus,
    income,
    referenceNumber,
  } = loan;

  const content = `
    <h2 style="color:#1c1c1c;">📨 Loan Application Received</h2>

    <p>Hello <strong>${firstName}</strong>,</p>

    <p>Thank you for submitting your <strong>${loanType}</strong> loan application. We've received your request and our team is currently reviewing it.</p>

    <p style="font-weight:bold;">Application Details:</p>

    <table style="width:100%; border-collapse:collapse; font-size:15px; color:#1c1c1c;">
      <tr><td style="padding:8px; font-weight:bold;">Reference Number:</td><td style="padding:8px;">${referenceNumber}</td></tr>
      <tr><td style="padding:8px; font-weight:bold;">Loan Type:</td><td style="padding:8px;">${loanType}</td></tr>
      <tr><td style="padding:8px; font-weight:bold;">Amount:</td><td style="padding:8px;">$${amount}</td></tr>
      <tr><td style="padding:8px; font-weight:bold;">Term:</td><td style="padding:8px;">${term} months</td></tr>
      <tr><td style="padding:8px; font-weight:bold;">Employment Status:</td><td style="padding:8px;">${employmentStatus}</td></tr>
      <tr><td style="padding:8px; font-weight:bold;">Monthly Income:</td><td style="padding:8px;">$${income}</td></tr>
      <tr><td style="padding:8px; font-weight:bold;">Email:</td><td style="padding:8px;">${email}</td></tr>
      <tr><td style="padding:8px; font-weight:bold;">Phone:</td><td style="padding:8px;">${phone}</td></tr>
    </table>

    <p style="font-size:15px;">
      You'll receive a confirmation once your loan has been reviewed and processed. This may take 1-2 business days.
    </p>

    <p>Thank you for choosing <strong>WealthWise</strong>.</p>
  `;

  return emailLayout("Loan Application Received", content);
};
