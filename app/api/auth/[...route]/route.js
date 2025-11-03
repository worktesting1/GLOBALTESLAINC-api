import { NextResponse } from "next/server";
import dbConnect from "../../../../lib/mongodb";
import User from "../../../../models/Users";
import Admin from "../../../../models/Admin";
import Wallet from "../../../../models/Wallet";
import CryptoJS from "crypto-js";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { v4 as uuidv4 } from "uuid";

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

  // Check if the origin is allowed
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
      "Access-Control-Max-Age": "86400", // 24 hours
    },
  });
}

// Main POST handler for all auth routes
export async function POST(request, { params }) {
  try {
    // Await the params Promise
    const { route } = await params;
    const [action] = route || [];

    await dbConnect();
    const body = await request.json();
    const headers = getCorsHeaders(request);

    // Route to appropriate handler based on action
    switch (action) {
      case "register":
        return await handleRegister(body, headers);
      case "adminRegister":
        return await handleAdminRegister(body, headers);
      case "login":
        return await handleLogin(body, headers);
      case "admin":
        return await handleAdminLogin(body, headers);
      case "forget":
        return await handleForgetPassword(body, headers);
      case "reset":
        return await handleResetPassword(body, headers);
      default:
        return NextResponse.json(
          { error: "Endpoint not found" },
          { status: 404, headers }
        );
    }
  } catch (error) {
    console.error("Auth API Error:", error);
    const headers = getCorsHeaders(request);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers }
    );
  }
}

// User Registration Handler
async function handleRegister(body, headers) {
  try {
    const newUser = new User({
      firstName: body.firstName,
      lastName: body.lastName,
      userName: body.userName,
      email: body.email,
      country: body.country,
      phone: body.phone,
      accountNum: body.accountNum,
      zipCode: body.zipCode,
      address: body.address,
      userOtp: 0,
      password: CryptoJS.AES.encrypt(
        body.password,
        process.env.PASS_SEC
      ).toString(),
      confirmpassword: CryptoJS.AES.encrypt(
        body.confirmpassword,
        process.env.PASS_SEC
      ).toString(),
    });

    const savedUser = await newUser.save();

    // Create wallet for the new user
    const newWallet = new Wallet({
      userId: savedUser._id,
    });
    await newWallet.save();

    // Send emails (fire and forget)
    sendWelcomeEmail(savedUser, body.email);
    sendAdminNotification(body.email);

    return NextResponse.json(
      { message: "Success", savedUser: savedUser },
      { status: 201, headers }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Registration failed" },
      { status: 500, headers }
    );
  }
}

// User Login Handler
async function handleLogin(body, headers) {
  try {
    const user = await User.findOne({ email: body.email });
    if (!user) {
      return NextResponse.json("Wrong credentials", { status: 401, headers });
    }

    const hashedPassword = CryptoJS.AES.decrypt(
      user.password,
      process.env.PASS_SEC
    );
    const originalPassword = hashedPassword.toString(CryptoJS.enc.Utf8);

    if (originalPassword !== body.password) {
      return NextResponse.json("Wrong credentials", { status: 401, headers });
    }

    const accessToken = jwt.sign(
      {
        id: user._id,
        isAdmin: user.isAdmin,
      },
      process.env.JWT_SEC,
      { expiresIn: "3d" }
    );

    const { password, confirmpassword, ...others } = user._doc;
    return NextResponse.json(
      { ...others, accessToken },
      { status: 200, headers }
    );
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Login failed" },
      { status: 500, headers }
    );
  }
}

// Admin Registration Handler
async function handleAdminRegister(body, headers) {
  try {
    if (body.secretKey !== `adminRegKey1!`) {
      return NextResponse.json(
        { msg: `Wrong Admin Key` },
        { status: 401, headers }
      );
    }

    const newAdmin = new Admin({
      email: body.email,
      password: CryptoJS.AES.encrypt(
        body.password,
        process.env.PASS_SEC
      ).toString(),
      confirmpassword: CryptoJS.AES.encrypt(
        body.confirmpassword,
        process.env.PASS_SEC
      ).toString(),
    });

    const savedAdmin = await newAdmin.save();
    return NextResponse.json(savedAdmin, { status: 201, headers });
  } catch (error) {
    console.error("Admin registration error:", error);
    return NextResponse.json(
      { error: "Admin registration failed" },
      { status: 500, headers }
    );
  }
}

// Admin Login Handler
async function handleAdminLogin(body, headers) {
  try {
    const admin = await Admin.findOne({ email: body.email });
    if (!admin) {
      return NextResponse.json("Wrong credentials", { status: 401, headers });
    }

    const hashedPassword = CryptoJS.AES.decrypt(
      admin.password,
      process.env.PASS_SEC
    );
    const originalPassword = hashedPassword.toString(CryptoJS.enc.Utf8);

    if (originalPassword !== body.password) {
      return NextResponse.json("Wrong credentials", { status: 401, headers });
    }

    const accessToken = jwt.sign(
      {
        id: admin._id,
        isAdmin: admin.isAdmin,
      },
      process.env.JWT_SEC,
      { expiresIn: "3d" }
    );

    const { password, cpassword, ...others } = admin._doc;
    return NextResponse.json(
      { ...others, accessToken },
      { status: 200, headers }
    );
  } catch (error) {
    console.error("Admin login error:", error);
    return NextResponse.json(
      { error: "Admin login failed" },
      { status: 500, headers }
    );
  }
}

// Forgot Password Handler
async function handleForgetPassword(body, headers) {
  try {
    const user = await User.findOne({ email: body.email });
    if (!user) {
      return NextResponse.json("Wrong credentials", { status: 401, headers });
    }

    const token = uuidv4();
    const expiryDate = new Date(Date.now() + 3600000);

    await User.updateOne(
      { email: body.email },
      {
        $set: {
          resetToken: token,
          resetTokenExpiry: expiryDate,
        },
      }
    );

    // Send reset email
    await sendResetEmail(body.email, token);

    return NextResponse.json("Mail Sent", { status: 200, headers });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "Password reset request failed" },
      { status: 500, headers }
    );
  }
}

// Reset Password Handler
async function handleResetPassword(body, headers) {
  try {
    const { password, confirmpassword, resetToken } = body;

    if (password !== confirmpassword) {
      return NextResponse.json("Passwords do not match", {
        status: 400,
        headers,
      });
    }

    const user = await User.findOne({
      resetToken,
      resetTokenExpiry: { $gt: Date.now() },
    });

    if (!user) {
      return NextResponse.json("Invalid token or token has expired", {
        status: 400,
        headers,
      });
    }

    const hashedPassword = CryptoJS.AES.encrypt(
      password,
      process.env.PASS_SEC
    ).toString();
    const cpassword = CryptoJS.AES.encrypt(
      confirmpassword,
      process.env.PASS_SEC
    ).toString();

    user.password = hashedPassword;
    user.confirmpassword = cpassword;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;

    await user.save();

    return NextResponse.json("Password reset successful", {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { error: "Password reset failed" },
      { status: 500, headers }
    );
  }
}

// Email sending functions (keep the same)
async function sendWelcomeEmail(user, email) {
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
      to: email,
      subject: "Welcome to WealthWise – Your Account is Ready",
      html: signupEmailTemplate(user),
    };

    await transport.sendMail(userMailOptions);
    console.log("User welcome email sent");
  } catch (error) {
    console.error("Error sending welcome email:", error);
  }
}

async function sendAdminNotification(email) {
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

    const adminMailOptions = {
      from: process.env.MAIL_USER,
      to: process.env.ADMIN_MAIL,
      subject: "New user registration",
      text: `A new user: ${email} has signed up on your platform`,
    };

    await transport.sendMail(adminMailOptions);
    console.log("Admin notification email sent");
  } catch (error) {
    console.error("Error sending admin notification:", error);
  }
}

async function sendResetEmail(email, token) {
  try {
    const transport = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: 465,
      secure: true,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASSWORD,
      },
    });

    const userMailOptions = {
      from: process.env.MAIL_USER,
      to: email,
      subject: "Password Reset Link",
      text: `Dear ${email} You have initiated a password reset \n Please click on the link to reset your password. \n https://capitalflowfinance.com/reset/${token}`,
    };

    await transport.sendMail(userMailOptions);
  } catch (error) {
    console.error("Error sending reset email:", error);
    throw new Error("Error sending email");
  }
}

// Email template (keep the same)
function signupEmailTemplate(user) {
  return `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>Welcome to WealthWise</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f0f4f8;">
      <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); overflow: hidden;">

        <!-- Header -->
        <div style="background-color: #004aad; padding: 30px; text-align: center;">
          <img src="https://wealthwise-olive.vercel.app/static/media/mobilewealth.8bf93fd7d2dff4d41d7d.png" alt="WealthWise Logo" style="width: 160px;" />
          <h1 style="color: #ffffff; font-size: 24px; margin-top: 20px;">Welcome to WealthWise!</h1>
        </div>

        <!-- Body -->
        <div style="padding: 30px;">
          <p style="font-size: 16px; color: #333;">
            Dear <strong>${user.firstName} ${user.lastName}</strong>,
          </p>

          <p style="font-size: 15px; color: #444;">
            🎉 Welcome to <strong>WealthWise</strong> — your gateway to secure, modern, and convenient online banking.
            Your account has been successfully created, and you're now ready to take full control of your financial journey.
          </p>

          <!-- Account Info -->
          <div style="margin: 25px 0;">
            <h3 style="color: #004aad;">Your Account Details:</h3>
            <table style="width: 100%; font-size: 14px; color: #333;">
              <tr>
                <td><strong>Username:</strong></td>
                <td>${user.userName}</td>
              </tr>
              <tr>
                <td><strong>Email:</strong></td>
                <td>${user.email}</td>
              </tr>
              <tr>
                <td><strong>Country:</strong></td>
                <td>${user.country}</td>
              </tr>
              <tr>
                <td><strong>Phone:</strong></td>
                <td>${user.phone}</td>
              </tr>
              <tr>
                <td><strong>Account Number:</strong></td>
                <td>${user.accountNum}</td>
              </tr>
            </table>
          </div>

          <!-- Highlights -->
          <div style="margin-top: 30px;">
            <h3 style="color: #004aad;">Here's what you can do with your WealthWise account:</h3>
            <ul style="font-size: 15px; color: #444; line-height: 1.6; padding-left: 20px;">
              <li>💼 View and manage your wallet, balances, and transactions in real-time</li>
              <li>🔁 Deposit, transfer, and withdraw funds securely</li>
              <li>💳 Request a WealthWise debit card for global access</li>
              <li>📈 Taking of Loans for your business and other activities</li>
              <li>📨 Receive instant alerts on all activity</li>
            </ul>
          </div>

          <!-- Security Reminder -->
          <div style="margin-top: 30px;">
            <h3 style="color: #004aad;">Your Security is Our Priority</h3>
            <p style="font-size: 15px; color: #444;">
              Please do not share your login details with anyone. WealthWise will never ask for your password or OTP via email or phone.
              For additional security tips, visit our <a href="https://www.wealthwise.online/faq" style="color: #2563eb;">Security Center</a>.
            </p>
          </div>

          <!-- CTA Button -->
          <div style="text-align: center; margin: 40px 0;">
            <a href="https://www.wealthwise.online/login" style="display: inline-block; background-color: #004aad; color: white; padding: 14px 30px; border-radius: 5px; text-decoration: none; font-weight: bold;">
              Go to Your Dashboard
            </a>
          </div>

          <!-- Support Info -->
          <p style="font-size: 15px; color: #444;">
            If you have any questions or concerns, our support team is here to help you 24/7. Reach out to us at 
            <a href="mailto:support@wealthwise.online" style="color: #2563eb;">support@wealthwise.online</a> or visit our 
          </p>

          <!-- Closing -->
          <p style="font-size: 15px; color: #444;">
            Thank you for choosing <strong>WealthWise</strong>. We're honored to serve you.
          </p>

          <p style="font-weight: bold; color: #004aad;">Sincerely,<br/>The WealthWise Team</p>
        </div>

        <!-- Footer -->
        <div style="background-color: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #666;">
          &copy; 2025 WealthWise Bank. All rights reserved.<br/>
          This message was sent to ${user.email}.<br/>
          <a href="https://www.wealthwise.online" style="color: #2563eb;">Visit our website</a> | 
          <a href="https://www.wealthwise.online/privacy" style="color: #2563eb;">Privacy Policy</a>
        </div>

      </div>
    </body>
  </html>
  `;
}
