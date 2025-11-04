import { NextResponse } from "next/server";
import dbConnect from "../../../lib/mongodb";
import Deposit from "../../../models/Deposit";
import { withAuth, withAdmin } from "../../../lib/apiHander";
import cloudinary from "../../../utils/cloudinary"; // Your existing cloudinary config
import nodemailer from "nodemailer";
import multer from "multer";
const upload = multer({ dest: "../uploads" });

// CORS headers helper
function getCorsHeaders() {
  return {
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, token, x-requested-with",
    "Access-Control-Allow-Origin": "http://localhost:3001",
    "Access-Control-Allow-Credentials": "true",
    "Content-Type": "application/json",
  };
}

export async function OPTIONS() {
  const headers = getCorsHeaders();
  return new NextResponse(null, {
    status: 200,
    headers: {
      ...headers,
      "Access-Control-Max-Age": "86400",
    },
  });
}

// POST - Create new deposit with FormData (including images)
export async function POST(request) {
  try {
    await dbConnect();

    console.log("📨 Content-Type:", request.headers.get("content-type"));

    const contentType = request.headers.get("content-type");

    if (contentType && contentType.includes("multipart/form-data")) {
      // Handle FormData with files
      const formData = await request.formData();
      return await withAuth(handleCreateDepositWithFormData)(
        request,
        getCorsHeaders(),
        formData
      );
    } else {
      // Handle regular JSON
      const body = await request.json();
      return await withAuth(handleCreateDeposit)(
        request,
        getCorsHeaders(),
        body
      );
    }
  } catch (error) {
    console.error("Deposit POST API Error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

// Handler for FormData with images
async function handleCreateDepositWithFormData(req, headers, formData) {
  try {
    // Extract all fields from FormData
    const depositData = {};
    const imageFiles = [];

    console.log("📋 FormData entries:", req.body);

    // Validate required fields
    const requiredFields = [
      "amount",
      "transactionType",
      "name",
      "email",
      "userId",
    ];
    const missingFields = requiredFields.filter((field) => !depositData[field]);

    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          error: "Missing required fields",
          missingFields: missingFields,
        },
        { status: 400, headers }
      );
    }

    // Upload images to Cloudinary
    const uploadedImageUrls = await handleCloudinaryUploads(imageFiles);

    const referenceNumber = generateReferenceNumber();

    const newDeposit = new Deposit({
      ...depositData,
      referenceNumber: referenceNumber,
      image: uploadedImageUrls, // Array of image URLs from Cloudinary
      status: "pending",
      createdAt: new Date(),
    });

    const savedDeposit = await newDeposit.save();
    console.log("✅ Deposit created successfully with images");

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
      to: req.body.email,
      subject:
        req.body.path === ""
          ? "Deposit Received - Pending Approval"
          : "Card Deposit Received - Pending Approval",
      html: depositUploadEmailTemplate(req, generateReferenceNumber()),
    };

    transport.sendMail(userMailOptions, (error, info) => {
      if (error) {
        console.log("Email error:", error);
      } else {
        console.log("User notified:", info.response);
      }
    });

    const adminTransport = nodemailer.createTransport({
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
      subject: "Deposit Request Submitted",
      html: `A user with the email ${req.body.email} just submitted a deposit request`,
    };

    adminTransport.sendMail(adminMailOptions, (error, info) => {
      if (error) {
        console.log("Email error:", error);
      } else {
        console.log("User notified:", info.response);
      }
    });
    return NextResponse.json(
      {
        message: "Deposit created successfully",
        deposit: savedDeposit,
        referenceNumber: referenceNumber,
        imagesUploaded: uploadedImageUrls.length,
      },
      { status: 201, headers }
    );
  } catch (error) {
    console.error("Create deposit with FormData error:", error);
    return NextResponse.json(
      { error: "Failed to create deposit", details: error.message },
      { status: 500, headers }
    );
  }
}

// Cloudinary upload handler using your existing setup
async function handleCloudinaryUploads(files) {
  const uploadedUrls = [];

  for (const file of files) {
    try {
      console.log(`☁️ Uploading ${file.name} to Cloudinary...`);

      // Convert file to base64 string for Cloudinary
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64String = `data:${file.type};base64,${buffer.toString(
        "base64"
      )}`;

      // Upload to Cloudinary using your existing uploads function
      const result = await cloudinary.uploads(base64String, "deposits");

      uploadedUrls.push({
        url: result.url,
        public_id: result.id,
        uploadedAt: new Date(),
      });

      console.log(`✅ Successfully uploaded: ${result.url}`);
    } catch (error) {
      console.error(`❌ Failed to upload file ${file.name}:`, error);
      // Continue with other files even if one fails
    }
  }

  return uploadedUrls;
}

// Alternative Cloudinary upload using direct cloudinary.uploader
async function handleCloudinaryUploadsDirect(files) {
  const uploadedUrls = [];

  for (const file of files) {
    try {
      console.log(`☁️ Uploading ${file.name} to Cloudinary...`);

      // Convert file to base64
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64String = `data:${file.type};base64,${buffer.toString(
        "base64"
      )}`;

      // Upload using cloudinary.uploader directly
      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload(
          base64String,
          {
            folder: "deposits",
            resource_type: "auto",
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
      });

      uploadedUrls.push({
        url: result.secure_url,
        public_id: result.public_id,
        format: result.format,
        bytes: result.bytes,
        uploadedAt: new Date(),
      });

      console.log(`✅ Successfully uploaded: ${result.secure_url}`);
    } catch (error) {
      console.error(`❌ Failed to upload file ${file.name}:`, error);
    }
  }

  return uploadedUrls;
}

// Original handler for JSON requests (without files)
async function handleCreateDeposit(req, headers, body) {
  try {
    const referenceNumber = generateReferenceNumber();

    const newDeposit = new Deposit({
      ...body,
      referenceNumber: referenceNumber,
      image: body.image || [], // Array of image URLs
      status: "pending",
      createdAt: new Date(),
    });

    const savedDeposit = await newDeposit.save();

    return NextResponse.json(
      {
        message: "Deposit created successfully",
        deposit: savedDeposit,
        referenceNumber: referenceNumber,
      },
      { status: 201, headers }
    );
  } catch (error) {
    console.error("Create deposit error:", error);
    return NextResponse.json(
      { error: "Failed to create deposit", details: error.message },
      { status: 500, headers }
    );
  }
}

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

const depositUploadEmailTemplate = (deposit) => {
  return `

<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Deposit Submission Confirmation - WealthGrower Finance</title>
    <style>
      /* Reset styles for email clients */
      body,
      table,
      td,
      a {
        -webkit-text-size-adjust: 100%;
        -ms-text-size-adjust: 100%;
      }
    
      img {
        -ms-interpolation-mode: bicubic;
        border: 0;
        height: auto;
        line-height: 100%;
        outline: none;
        text-decoration: none;
      }

      /* Main styles */
      body {
        font-family: "Segoe UI", Arial, Helvetica, sans-serif;
        margin: 0;
        padding: 0;
        background-color: #f8fafc;
        color: #333333;
      }

      .email-container {
        max-width: 600px;
        margin: 0 auto;
        background-color: #ffffff;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      }

      .header {
        background-color: #50626a;
        padding: 30px;
        text-align: center;
        border-bottom: 4px solid #3a4a52;
      }

      .logo {
        display: inline-block;
        color: #ffffff;
        font-size: 32px;
        font-weight: 700;
        text-decoration: none;
        letter-spacing: -0.5px;
      }

      .logo span {
        display: block;
        font-size: 16px;
        font-weight: 400;
        margin-top: 8px;
        opacity: 0.9;
      }

      .content {
        padding: 40px;
      }

      .greeting {
        font-size: 20px;
        margin-bottom: 25px;
        color: #50626a;
        font-weight: 600;
      }

      .message {
        line-height: 1.7;
        margin-bottom: 25px;
        font-size: 16px;
        color: #555555;
      }

      .deposit-details {
        background-color: #f8f9fa;
        border-left: 5px solid #50626a;
        padding: 25px;
        margin: 30px 0;
        border-radius: 0 8px 8px 0;
      }

      .detail-row {
        margin-bottom: 12px;
        display: flex;
        align-items: center;
      }

      .detail-label {
        font-weight: 600;
        width: 140px;
        color: #50626a;
        font-size: 15px;
      }

      .detail-value {
        font-weight: 500;
        color: #333333;
        font-size: 15px;
      }

      .status-badge {
        display: inline-block;
        padding: 8px 16px;
        background-color: #fff3cd;
        color: #856404;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 600;
        margin-top: 15px;
        border: 1px solid #ffeaa7;
      }

      .next-steps {
        margin-top: 35px;
        padding-top: 25px;
        border-top: 1px solid #eaeaea;
      }

      .next-steps h3 {
        color: #50626a;
        margin-bottom: 20px;
        font-size: 18px;
        font-weight: 600;
      }

      .steps-list {
        padding-left: 20px;
      }

      .steps-list li {
        margin-bottom: 12px;
        line-height: 1.6;
        color: #555555;
        position: relative;
      }

      .steps-list li:before {
        content: "•";
        color: #50626a;
        font-weight: bold;
        display: inline-block;
        width: 1em;
        margin-left: -1em;
      }

      .support-section {
        background-color: #f0f7ff;
        padding: 20px;
        border-radius: 8px;
        margin-top: 25px;
        border: 1px solid #e1f0ff;
      }

      .support-section h4 {
        color: #50626a;
        margin-bottom: 10px;
        font-size: 16px;
      }

      .footer {
        background-color: #f5f7f9;
        padding: 30px;
        text-align: center;
        font-size: 14px;
        color: #666666;
        border-top: 1px solid #eaeaea;
      }

      .contact-info {
        margin-top: 20px;
        line-height: 1.6;
      }

      .contact-info a {
        color: #50626a;
        text-decoration: none;
        font-weight: 500;
      }

      .security-notice {
        background-color: #fff8e6;
        padding: 15px;
        border-radius: 6px;
        margin-top: 20px;
        font-size: 13px;
        color: #856404;
        border: 1px solid #ffeaa7;
      }

      @media only screen and (max-width: 600px) {
        .content {
          padding: 25px 20px;
        }

        .detail-row {
          flex-direction: column;
          align-items: flex-start;
          margin-bottom: 15px;
        }

        .detail-label {
          width: 100%;
          margin-bottom: 5px;
        }

        .header {
          padding: 25px 20px;
        }

        .logo {
          font-size: 28px;
        }
      }
    </style>
  </head>
    </style>
    <!--[if mso]>
    <style type="text/css">
      table, td {
        mso-table-lspace: 0pt;
        mso-table-rspace: 0pt;
      }
    </style>
    <![endif]-->
  </head>
      role="presentation"
      width="100%"
      cellspacing="0"
      cellpadding="0"
      border="0"
    >
      <tr>
        <td align="center" style="padding: 40px 15px">
          <!-- Email Container -->
          <table
            role="presentation"
            class="email-container"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            border="0"
          >
            <!-- Header -->
            <tr>
              <td class="header">
                <a href="#" class="logo">
                  WealthGrower
                  <span>Finance Bank</span>
                </a>
              </td>
            </tr>

            <!-- Content -->
            <tr>
              <td class="content">
                <h2 class="greeting">Dear ${deposit.name},</h2>

                <p class="message">
                  Thank you for submitting your deposit request. We have
                  successfully received your transaction details and they are
                  now under review by our finance team.
                </p>

                <div class="deposit-details">
                  <h3
                    style="
                      margin-top: 0;
                      color: #50626a;
                      font-size: 18px;
                      margin-bottom: 20px;
                    "
                  >
                    Deposit Details
                  </h3>

                  <div class="detail-row">
                    <div class="detail-label">Reference Number:</div>
                    <div class="detail-value">${deposit.referenceNumber}</div>
                  </div>

                  <div class="detail-row">
                    <div class="detail-label">Amount:</div>
                    <div class="detail-value">$${deposit.amount} USD</div>
                  </div>

                  <div class="detail-row">
                    <div class="detail-label">Transaction Type:</div>
                    <div class="detail-value">${deposit.transactionType}</div>
                  </div>

                  <div class="detail-row">
                    <div class="detail-label">Submission Date:</div>
                    <div class="detail-value">
                      ${new Date().toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>

                  <div class="status-badge">Status: Pending Review</div>
                </div>

                <p class="message">
                  Our team will verify your deposit within 1-2 business hours.
                  You will receive another email notification once your deposit
                  has been processed and the funds are available in your
                  account.
                </p>

                <div class="next-steps">
                  <h3>What to Expect Next</h3>
                  <ul class="steps-list">
                    <li>
                      Our finance team will verify your transaction details
                    </li>
                    <li>We'll confirm the deposit amount and source</li>
                    <li>You'll receive an approval notification email</li>
                    <li>
                      Funds will be credited to your account immediately after
                      approval
                    </li>
                  </ul>
                </div>

                <div class="support-section">
                  <h4>Need Assistance?</h4>
                  <p style="margin: 0; color: #555555; line-height: 1.6">
                    If you have any questions about your deposit or need to
                    update your submission, please contact our support team at
                    <a href="mailto:support@wealthgrowerfinance.org"
                      >support@wealthgrowerfinance.org</a
                    >
                    or call us at +1 (555) 123-4567.
                  </p>
                </div>

                <div class="security-notice">
                  <strong>Security Notice:</strong> For your protection, please
                  do not share your reference number or transaction details with
                  anyone. WealthGrower Finance Bank will never ask for your
                  password or sensitive information via email.
                </div>

                <p class="message" style="margin-top: 25px">
                  Best regards,<br />
                  <strong>The WealthGrower Finance Bank Team</strong>
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td class="footer">
                <p>
                  &copy; ${new Date().getFullYear()} WealthGrower Finance Bank.
                  All rights reserved.
                </p>
                <div class="contact-info">
                  <p>
                    WealthGrower Finance Bank | 123 Financial District, City,
                    Country
                  </p>
                  <p>
                    Email:
                    <a href="mailto:support@wealthgrowerfinance.org"
                      >support@wealthgrowerfinance.org</a
                    >
                    | Phone: +1 (555) 123-4567
                  </p>
                  <p style="margin-top: 15px; font-size: 12px; color: #888">
                    This email was sent automatically. Please do not reply to
                    this message.
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
