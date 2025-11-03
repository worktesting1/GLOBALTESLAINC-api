import { NextResponse } from "next/server";
import dbConnect from "../../../../lib/mongodb";
import User from "../../../../models/Users";
import Admin from "../../../../models/Admin";
import Deposit from "../../../../models/Deposit";
import Transfer from "../../../../models/Transfer";
import CryptoJS from "crypto-js";
import { withAuth, withAdmin } from "../../../../lib/apiHander";
import nodemailer from "nodemailer";

// CORS headers helper
function getCorsHeaders(request) {
  const origin = request.headers.get("origin") || "";
  const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:3001",
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

// GET handler - for getting users
export async function GET(request, { params }) {
  try {
    const { route } = await params;
    console.log("GET Route params:", route); // Debug log

    const headers = getCorsHeaders(request);
    await dbConnect();

    // If no route segments, return all users (admin only)
    if (!route || route.length === 0) {
      return await withAdmin(handleGetAllUsers)(request, headers);
    }

    const [firstSegment, secondSegment] = route;

    // Handle /api/users/stats
    if (firstSegment === "stats") {
      return await withAdmin(handleGetStats)(request, headers);
    }

    // Handle /api/users/admin/:id
    if (firstSegment === "admin" && secondSegment) {
      return await withAdmin(handleGetUserAdmin)(
        request,
        headers,
        secondSegment
      );
    }

    // Handle /api/users/:id (user's own data)
    if (firstSegment && !secondSegment) {
      return await withAuth(handleGetUser)(request, headers, firstSegment);
    }

    return NextResponse.json(
      { error: "Endpoint not found" },
      { status: 404, headers }
    );
  } catch (error) {
    console.error("Users GET API Error:", error);
    const headers = getCorsHeaders(request);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers }
    );
  }
}

// PUT handler - for updating users
export async function PUT(request, { params }) {
  try {
    const { route } = await params;
    console.log("PUT Route params:", route); // Debug log

    const headers = getCorsHeaders(request);
    await dbConnect();
    const body = await request.json();

    if (!route || route.length === 0) {
      return NextResponse.json(
        { error: "Endpoint not found" },
        { status: 404, headers }
      );
    }

    const [firstSegment, secondSegment] = route;

    // Handle /api/users/updatedata/:id
    if (firstSegment === "updatedata" && secondSegment) {
      return await withAdmin(handleUpdateData)(
        request,
        headers,
        secondSegment,
        body
      );
    }

    // Handle /api/users/user/:id
    if (firstSegment === "user" && secondSegment) {
      return await withAuth(handleUpdateUser)(
        request,
        headers,
        secondSegment,
        body
      );
    }

    // Handle /api/users/:userId (basic user data update)
    if (firstSegment && !secondSegment) {
      return await handleChangeUserData(request, headers, firstSegment, body);
    }

    return NextResponse.json(
      { error: "Endpoint not found" },
      { status: 404, headers }
    );
  } catch (error) {
    console.error("Users PUT API Error:", error);
    const headers = getCorsHeaders(request);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers }
    );
  }
}

// DELETE handler
export async function DELETE(request, { params }) {
  try {
    const { route } = await params;
    console.log("DELETE Route params:", route); // Debug log

    const headers = getCorsHeaders(request);
    await dbConnect();

    if (!route || route.length === 0) {
      return NextResponse.json(
        { error: "Endpoint not found" },
        { status: 404, headers }
      );
    }

    const [id] = route;
    return await withAdmin(handleDeleteUser)(request, headers, id);
  } catch (error) {
    console.error("Users DELETE API Error:", error);
    const headers = getCorsHeaders(request);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers }
    );
  }
}

// Handler functions (keep the same as previous)
async function handleGetAllUsers(req, headers) {
  try {
    const users = await User.find(
      { isAdmin: false },
      "-password -confirmPassword"
    );
    return NextResponse.json(users, { status: 200, headers });
  } catch (error) {
    console.error("Get all users error:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500, headers }
    );
  }
}

async function handleGetStats(req, headers) {
  try {
    const users = await User.countDocuments();
    const deposit = await Deposit.countDocuments();
    const transfer = await Transfer.countDocuments();
    const admin = await Admin.countDocuments();
    const verifiedUsers = await User.countDocuments({ status: true });

    const data = {
      users,
      deposit,
      transfer,
      admin,
      verifiedUsers,
    };

    return NextResponse.json(data, { status: 200, headers });
  } catch (error) {
    console.error("Get stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500, headers }
    );
  }
}

async function handleGetUser(req, headers, id) {
  try {
    console.log("Fetching user with ID:", id); // Debug log

    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404, headers }
      );
    }

    const { password, confirmpassword, ...others } = user._doc;
    return NextResponse.json(others, { status: 200, headers });
  } catch (error) {
    console.error("Get user error:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500, headers }
    );
  }
}

async function handleGetUserAdmin(req, headers, id) {
  try {
    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404, headers }
      );
    }

    const { password, confirmpassword, ...others } = user._doc;
    return NextResponse.json(others, { status: 200, headers });
  } catch (error) {
    console.error("Get user admin error:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500, headers }
    );
  }
}

async function handleChangeUserData(req, headers, userId, body) {
  try {
    const {
      firstName,
      lastName,
      userName,
      country,
      phone,
      email,
      gender,
      city,
      address,
      age,
      maritalstatus,
      dob,
    } = body;

    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404, headers }
      );
    }

    // Update user data
    user.firstName = firstName || user.firstName;
    user.lastName = lastName || user.lastName;
    user.userName = userName || user.userName;
    user.country = country || user.country;
    user.phone = phone || user.phone;
    user.email = email || user.email;
    user.gender = gender || user.gender;
    user.city = city || user.city;
    user.address = address || user.address;
    user.age = age || user.age;
    user.maritalstatus = maritalstatus || user.maritalstatus;
    user.dob = dob || user.dob;

    await user.save();

    return NextResponse.json(
      { message: "User data updated successfully" },
      { status: 200, headers }
    );
  } catch (error) {
    console.error("Change user data error:", error);
    return NextResponse.json(
      { error: "Failed to update user data" },
      { status: 500, headers }
    );
  }
}

async function handleUpdateUser(req, headers, id, body) {
  try {
    if (body.password) {
      body.password = CryptoJS.AES.encrypt(
        body.password,
        process.env.PASS_SEC
      ).toString();
    }
    if (body.confirmpassword) {
      body.confirmpassword = CryptoJS.AES.encrypt(
        body.confirmpassword,
        process.env.PASS_SEC
      ).toString();
    }

    const updatedUser = await User.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true }
    );

    if (!updatedUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404, headers }
      );
    }

    return NextResponse.json(updatedUser, { status: 200, headers });
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500, headers }
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

async function handleDeleteUser(req, headers, id) {
  try {
    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404, headers }
      );
    }

    return NextResponse.json(
      { message: "User has been deleted" },
      { status: 200, headers }
    );
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500, headers }
    );
  }
}

// Email function
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

    // User email
    const userMailOptions = {
      from: process.env.MAIL_USER,
      to: user.email,
      subject: `Here is your OTP for ${otpMessage || "verification"}`,
      html: `${otpMessage || "OTP"}: ${userOtp}`,
    };

    // Admin email
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
