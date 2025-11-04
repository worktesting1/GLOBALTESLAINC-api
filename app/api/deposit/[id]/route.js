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

// Email transporter
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: process.env.MAIL_PORT,
  secure: true,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASSWORD,
  },
});

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

// Email sending function and templates (copy from previous code)
async function sendDepositEmail(deposit, status) {
  // ... your email sending code
}

const depositFailedEmailTemplate = (deposit) => {
  // ... your template
};

const depositApprovedEmailTemplate = (deposit) => {
  // ... your template
};
