import { NextResponse } from "next/server";
import dbConnect from "../../../../../lib/mongodb";
import User from "../../../../../models/Users";
import { withAdmin } from "../../../../../lib/apiHander";
import nodemailer from "nodemailer";
import { corsHeaders, handleOptions } from "../../../../../lib/cors";

export async function OPTIONS(request) {
  return handleOptions(request);
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    await dbConnect();
    return await withAdmin(handleUpdateData)(
      request,
      corsHeaders(request),
      id,
      body
    );
  } catch (error) {
    console.error("Update Data PUT API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders(request) }
    );
  }
}

async function handleUpdateData(req, headers, id, body) {
  try {
    const {
      bonus,
      signal,
      profit,
      userOtp,
      otpMessage,
      status,
      transferStep,
      cardAmount,
      cardIssuing,
      firstCode,
      firstMessage,
      secondCode,
      secondMessage,
      thirdCode,
      thirdMessage,
      forthCode,
      forthMessage,
    } = body;

    let updateData = {};
    if (bonus !== undefined) updateData.bonus = bonus;
    if (signal !== undefined) updateData.signal = signal;
    if (profit !== undefined) updateData.profit = profit;
    if (cardIssuing !== undefined) updateData.cardIssuing = cardIssuing;
    if (cardAmount !== undefined) updateData.cardAmount = cardAmount;
    if (userOtp !== undefined) updateData.userOtp = userOtp;
    if (otpMessage !== undefined) updateData.otpMessage = otpMessage;
    if (firstCode !== undefined) updateData.firstCode = firstCode;
    if (firstMessage !== undefined) updateData.firstMessage = firstMessage;
    if (status !== undefined) updateData.status = status;
    if (transferStep !== undefined) updateData.transferStep = transferStep;
    if (secondCode !== undefined) updateData.secondCode = secondCode;
    if (secondMessage !== undefined) updateData.secondMessage = secondMessage;
    if (forthCode !== undefined) updateData.forthCode = forthCode;
    if (forthMessage !== undefined) updateData.forthMessage = forthMessage;
    if (thirdCode !== undefined) updateData.thirdCode = thirdCode;
    if (thirdMessage !== undefined) updateData.thirdMessage = thirdMessage;

    const user = await User.findByIdAndUpdate(id, updateData, { new: true });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404, headers }
      );
    }

    // Send OTP email if userOtp was updated
    if (userOtp !== undefined) {
      await sendOtpEmail(user, userOtp, otpMessage);
    }

    return NextResponse.json(
      { message: "User data updated" },
      { status: 200, headers }
    );
  } catch (error) {
    console.error("Update user data error:", error);
    return NextResponse.json(
      { error: "Failed to update user data" },
      { status: 500, headers }
    );
  }
}

async function sendOtpEmail(user, userOtp, otpMessage) {
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
      to: user.email,
      subject: `Here is your OTP for ${otpMessage || "verification"}`,
      html: `${otpMessage || "OTP"}: ${userOtp}`,
    };

    const adminMailOptions = {
      from: process.env.MAIL_USER,
      to: process.env.ADMIN_MAIL,
      subject: "OTP Successfully Sent",
      text: `User: ${user.firstName} ${user.lastName} has Received the OTP`,
    };

    await transport.sendMail(userMailOptions);
    await transport.sendMail(adminMailOptions);

    console.log("OTP emails sent successfully");
  } catch (error) {
    console.error("Error sending OTP emails:", error);
  }
}
