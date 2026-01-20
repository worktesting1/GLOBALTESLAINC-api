import { NextResponse } from "next/server";
import dbConnect from "../../../../lib/mongodb";
import User from "../../../../models/Users";
import Admin from "../../../../models/Admin";
import Wallet from "../../../../models/Wallet";
import CryptoJS from "crypto-js";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { v4 as uuidv4 } from "uuid";
import { corsHeaders, handleOptions } from "../../../../lib/cors";

export async function OPTIONS(request) {
  return handleOptions(request);
}

export async function POST(request, { params }) {
  let headers;

  try {
    // Set CORS headers immediately
    headers = corsHeaders(request);

    const { route } = await params;
    const [action] = route || [];

    await dbConnect();
    const body = await request.json();

    // Route to appropriate handler
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
          { status: 404, headers },
        );
    }
  } catch (error) {
    console.error("Auth API Error:", error);

    // Ensure we have headers even in error cases
    if (!headers) {
      headers = corsHeaders(request);
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers },
    );
  }
}

// User Registration Handler
async function handleRegister(body, headers) {
  try {
    const newUser = new User({
      fullName: body.fullName,
      email: body.email,
      country: body.country,
      phone: body.phone,
      zipCode: body.zipCode,
      address: body.address,
      userOtp: 0,
      password: CryptoJS.AES.encrypt(
        body.password,
        process.env.PASS_SEC,
      ).toString(),
      confirmpassword: CryptoJS.AES.encrypt(
        body.confirmpassword,
        process.env.PASS_SEC,
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
      { status: 201, headers },
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Registration failed" },
      { status: 500, headers },
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
      process.env.PASS_SEC,
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
      { expiresIn: "3d" },
    );

    const { password, confirmpassword, ...others } = user._doc;
    return NextResponse.json(
      { ...others, accessToken },
      { status: 200, headers },
    );
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Login failed" },
      { status: 500, headers },
    );
  }
}

// Admin Registration Handler
async function handleAdminRegister(body, headers) {
  try {
    if (body.secretKey !== `adminRegKey1!`) {
      return NextResponse.json(
        { msg: `Wrong Admin Key` },
        { status: 401, headers },
      );
    }

    const newAdmin = new Admin({
      email: body.email,
      password: CryptoJS.AES.encrypt(
        body.password,
        process.env.PASS_SEC,
      ).toString(),
      confirmpassword: CryptoJS.AES.encrypt(
        body.confirmpassword,
        process.env.PASS_SEC,
      ).toString(),
    });

    const savedAdmin = await newAdmin.save();
    return NextResponse.json(savedAdmin, { status: 201, headers });
  } catch (error) {
    console.error("Admin registration error:", error);
    return NextResponse.json(
      { error: "Admin registration failed" },
      { status: 500, headers },
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
      process.env.PASS_SEC,
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
      { expiresIn: "3d" },
    );

    const { password, cpassword, ...others } = admin._doc;
    return NextResponse.json(
      { ...others, accessToken },
      { status: 200, headers },
    );
  } catch (error) {
    console.error("Admin login error:", error);
    return NextResponse.json(
      { error: "Admin login failed" },
      { status: 500, headers },
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
      },
    );

    // Send reset email
    await sendResetEmail(body.email, token);

    return NextResponse.json("Mail Sent", { status: 200, headers });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "Password reset request failed" },
      { status: 500, headers },
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
      process.env.PASS_SEC,
    ).toString();
    const cpassword = CryptoJS.AES.encrypt(
      confirmpassword,
      process.env.PASS_SEC,
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
      { status: 500, headers },
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
      subject: "Welcome to GlobalTeslaInc Finance – Your Account is Ready",
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
      text: `Dear ${email} You have initiated a password reset \n Please click on the link to reset your password. \n http://localhost:5173/reset/${token}`,
    };

    await transport.sendMail(userMailOptions);
  } catch (error) {
    console.error("Error sending reset email:", error);
    throw new Error("Error sending email");
  }
}

function signupEmailTemplate(user) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to Tesla Finance</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, Helvetica, sans-serif; background-color: #000000; color: #ffffff; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <table width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #000000;">
    <tr>
      <td align="center" style="padding: 40px 15px;">
        <!-- Email Container -->
        <table width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #000000; border-radius: 8px; overflow: hidden; border: 1px solid #333333;">
          <!-- Header -->
          <tr>
            <td style="background-color: #000000; padding: 30px; text-align: center; border-bottom: 1px solid #333333;">
              <div style="color: #ffffff; font-size: 36px; font-weight: 700; text-decoration: none; letter-spacing: -1px;">
                GlobalTeslaInc
                <span style="display: block; font-size: 16px; font-weight: 400; margin-top: 8px; color: #cccccc;">FINANCE & INVESTMENTS</span>
              </div>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <div style="font-size: 48px; margin-bottom: 20px;">⚡</div>
                <h2 style="font-size: 28px; margin-bottom: 15px; color: #ffffff; font-weight: 700; letter-spacing: -0.5px;">Welcome to GlobalTeslaInc Finance</h2>
                <p style="font-size: 18px; color: #cccccc; margin: 0;">Your investment account is now active</p>
              </div>

              <h2 style="font-size: 20px; margin-bottom: 25px; color: #ffffff; font-weight: 600;">Dear ${user.fullName},</h2>

              <p style="line-height: 1.7; margin-bottom: 25px; font-size: 16px; color: #cccccc;">
                Welcome to <strong>GlobalTeslaInc Finance</strong> — your platform for stocks, investments, cryptocurrency, and vehicle financing. 
                Your account has been successfully created and you're now ready to accelerate your financial future.
              </p>

              <div style="background-color: #111111; padding: 25px; margin: 30px 0; border-radius: 8px; border: 1px solid #333333;">
                <h3 style="margin-top: 0; color: #ffffff; font-size: 18px; margin-bottom: 20px; font-weight: 600;">Your Account Profile</h3>

                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #ffffff; font-size: 15px;">Full Name:</div>
                  <div style="font-weight: 500; color: #cccccc; font-size: 15px;">${user.fullName}</div>
                </div>

                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #ffffff; font-size: 15px;">Email:</div>
                  <div style="font-weight: 500; color: #cccccc; font-size: 15px;">${user.email}</div>
                </div>

                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #ffffff; font-size: 15px;">Country:</div>
                  <div style="font-weight: 500; color: #cccccc; font-size: 15px;">${user.country}</div>
                </div>

                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #ffffff; font-size: 15px;">Phone:</div>
                  <div style="font-weight: 500; color: #cccccc; font-size: 15px;">${user.phone}</div>
                </div>

                <div style="display: inline-block; padding: 8px 16px; background-color: #000000; color: #00cc00; border-radius: 6px; font-size: 14px; font-weight: 600; margin-top: 15px; border: 1px solid #333333;">
                  Status: Account Active ⚡
                </div>
              </div>

              <div style="margin-top: 35px; padding-top: 25px; border-top: 1px solid #333333;">
                <h3 style="color: #ffffff; margin-bottom: 20px; font-size: 18px; font-weight: 600;">Start Your Investment Journey</h3>
                <ul style="padding-left: 20px; margin: 0;">
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #cccccc;">
                    📈 <strong>Stock Trading</strong> - Trade Tesla and other tech stocks with zero commission
                  </li>
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #cccccc;">
                    💰 <strong>Crypto Portfolio</strong> - Buy, sell, and manage Bitcoin, Ethereum, and Dogecoin
                  </li>
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #cccccc;">
                    🚗 <strong>Vehicle Financing</strong> - Finance your Tesla with competitive rates
                  </li>
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #cccccc;">
                    📊 <strong>Investment Funds</strong> - Access curated portfolios for sustainable energy
                  </li>
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #cccccc;">
                    🔄 <strong>Auto-Invest</strong> - Set up recurring investments in your favorite assets
                  </li>
                </ul>
              </div>

              <div style="background-color: #111111; padding: 25px; border-radius: 8px; margin-top: 25px; border: 1px solid #333333;">
                <h4 style="color: #ffffff; margin-bottom: 10px; font-size: 16px; font-weight: 600;">Ready to Accelerate?</h4>
                <p style="margin: 0 0 20px 0; color: #cccccc; line-height: 1.6;">
                  Fund your account and start trading within minutes. Get $10 in GlobalTeslaInc stock when you deposit $100 or more.
                </p>
                <div style="text-align: center;">
                  <a href="https://globalteslainc.online/dashboard" style="display: inline-block; background-color: #ffffff; color: #000000; padding: 14px 30px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px; letter-spacing: -0.3px;">
                    Go to Dashboard
                  </a>
                </div>
              </div>

              <div style="background-color: #000000; padding: 15px; border-radius: 6px; margin-top: 20px; font-size: 13px; color: #cccccc; border: 1px solid #333333;">
                <strong style="color: #ffffff;">Security First:</strong> GlobalTeslaInc Finance uses bank-level encryption and multi-factor authentication. 
                We will never ask for your password via email. Enable 2FA for enhanced security.
              </div>

              <p style="line-height: 1.7; margin-top: 25px; font-size: 16px; color: #cccccc;">
                Welcome to the future of finance.<br />
                <strong style="color: #ffffff;">The GlobalTeslaInc Finance Team</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #000000; padding: 30px; text-align: center; font-size: 14px; color: #999999; border-top: 1px solid #333333;">
              <p style="margin: 0;">
                &copy; ${new Date().getFullYear()} GlobalTeslaInc Finance. All rights reserved.
              </p>
              <div style="margin-top: 20px; line-height: 1.6;">
                <p style="margin: 0; color: #999999;">
                  GlobalTeslaInc Finance | 1 Tesla Road, Austin, TX 78725
                </p>
                <p style="margin: 0; color: #999999;">
                  Email: <a href="mailto:support@globalteslainc.online" style="color: #ffffff; text-decoration: none; font-weight: 500;">support@globalteslainc.online</a>
                  | Phone: +1 (512) 387-0500
                </p>
                <p style="margin-top: 15px; font-size: 12px; color: #666666;">
                  This email was sent to ${user.email}. GlobalTeslaInc Finance is a division of Tesla, Inc.
                </p>
                <div style="margin-top: 20px; font-size: 12px; color: #666666;">
                  <p style="margin: 0;">Investing involves risk. Past performance is no guarantee of future results.</p>
                </div>
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
}
