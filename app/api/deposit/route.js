import { NextResponse } from "next/server";
import dbConnect from "../../../lib/mongodb";
import Deposit from "../../../models/Deposit";
import { corsHeaders, handleOptions } from "../../../lib/cors";
import { uploadToCloudinary } from "../../../utils/cloudinary";
import nodemailer from "nodemailer";
import { withAdmin } from "../../../lib/apiHander";

export async function OPTIONS(request) {
  return handleOptions(request);
}

// GET - Retrieve all deposits with optional filtering (Admin only)
export const GET = withAdmin(async (request) => {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page")) || 1;
    const limit = parseInt(searchParams.get("limit")) || 20;
    const status = searchParams.get("status");
    const userId = searchParams.get("userId");
    const email = searchParams.get("email");
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    // Build filter object
    const filter = {};

    if (status && status !== "all") {
      filter.status = status;
    }

    if (userId) {
      filter.userId = userId;
    }

    if (email) {
      filter.email = { $regex: email, $options: "i" };
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Execute query with pagination
    const [deposits, totalCount] = await Promise.all([
      Deposit.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .select("-__v") // Exclude version key
        .lean(), // Convert to plain JavaScript objects
      Deposit.countDocuments(filter),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    return NextResponse.json(
      {
        message: "Deposits retrieved successfully",
        deposits,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          hasNext,
          hasPrev,
          limit,
        },
      },
      { status: 200, headers: corsHeaders(request) }
    );
  } catch (error) {
    console.error("Get deposits API Error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve deposits", details: error.message },
      { status: 500, headers: corsHeaders(request) }
    );
  }
});

// POST - Create new deposit with FormData
export async function POST(request) {
  try {
    await dbConnect();

    const contentType = request.headers.get("content-type");

    if (contentType && contentType.includes("multipart/form-data")) {
      return await handleFormDataDeposit(request);
    } else {
      return await handleJsonDeposit(request);
    }
  } catch (error) {
    console.error("Deposit POST API Error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500, headers: corsHeaders(request) }
    );
  }
}

// Handle FormData with images
async function handleFormDataDeposit(request) {
  try {
    const formData = await request.formData();

    // Extract all fields
    const depositData = {
      amount: formData.get("amount"),
      transactionType: formData.get("transactionType"),
      name: formData.get("name"),
      email: formData.get("email"),
      userId: formData.get("userId"),
      path: formData.get("path") || "",
    };

    // Get image files
    const imageFiles = formData.getAll("image");

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
        { error: "Missing required fields", missingFields },
        { status: 400, headers: corsHeaders(request) }
      );
    }

    if (!imageFiles || imageFiles.length === 0) {
      return NextResponse.json(
        { error: "At least one image is required" },
        { status: 400, headers: corsHeaders(request) }
      );
    }

    // Upload images to Cloudinary
    const uploadedImages = await handleCloudinaryUploads(imageFiles);

    const referenceNumber = generateReferenceNumber();

    const newDeposit = new Deposit({
      ...depositData,
      referenceNumber,
      image: uploadedImages,
      status: "pending",
    });

    const savedDeposit = await newDeposit.save();
    console.log("✅ Deposit created successfully with images");

    // Send emails
    await sendDepositEmails(depositData, referenceNumber);

    return NextResponse.json(
      {
        message: "Deposit created successfully",
        deposit: savedDeposit,
        referenceNumber,
        imagesUploaded: uploadedImages.length,
      },
      { status: 201, headers: corsHeaders(request) }
    );
  } catch (error) {
    console.error("Create deposit with FormData error:", error);
    return NextResponse.json(
      { error: "Failed to create deposit", details: error.message },
      { status: 500, headers: corsHeaders(request) }
    );
  }
}

// Handle JSON requests
async function handleJsonDeposit(request) {
  try {
    const body = await request.json();
    const referenceNumber = generateReferenceNumber();

    const newDeposit = new Deposit({
      ...body,
      referenceNumber,
      image: body.image || [],
      status: "pending",
    });

    const savedDeposit = await newDeposit.save();

    return NextResponse.json(
      {
        message: "Deposit created successfully",
        deposit: savedDeposit,
        referenceNumber,
      },
      { status: 201, headers: corsHeaders(request) }
    );
  } catch (error) {
    console.error("Create deposit error:", error);
    return NextResponse.json(
      { error: "Failed to create deposit", details: error.message },
      { status: 500, headers: corsHeaders(request) }
    );
  }
}

// Cloudinary upload handler - UPDATED
async function handleCloudinaryUploads(files) {
  const uploadedUrls = [];

  for (const file of files) {
    try {
      console.log(`☁️ Uploading ${file.name} to Cloudinary...`);

      // Convert file to buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Convert to base64 for Cloudinary
      const base64String = `data:${file.type};base64,${buffer.toString(
        "base64"
      )}`;

      // Use the named export directly
      const result = await uploadToCloudinary(base64String, "deposits");

      uploadedUrls.push({
        url: result.url,
        public_id: result.id,
        uploadedAt: new Date(),
      });

      console.log(`✅ Successfully uploaded: ${result.url}`);
    } catch (error) {
      console.error(`❌ Failed to upload file ${file.name}:`, error);
      throw error;
    }
  }

  return uploadedUrls;
}

// Email sending function
async function sendDepositEmails(depositData, referenceNumber) {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: process.env.MAIL_PORT,
      name: "Wealth Grower Finance",
      secure: true,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASSWORD,
      },
    });

    // User email
    const userMailOptions = {
      from: process.env.MAIL_USER,
      to: depositData.email,
      subject:
        depositData.path === ""
          ? "Deposit Received - Pending Approval"
          : "Card Deposit Received - Pending Approval",
      html: depositUploadEmailTemplate({ ...depositData, referenceNumber }),
    };

    // Admin email
    const adminMailOptions = {
      from: process.env.MAIL_USER,
      to: process.env.ADMIN_MAIL,
      subject: "Deposit Request Submitted",
      html: `A user with email ${depositData.email} just submitted a deposit request with reference number ${referenceNumber}`,
    };

    // Send both emails
    await Promise.all([
      transporter.sendMail(userMailOptions),
      transporter.sendMail(adminMailOptions),
    ]);

    console.log("📧 Emails sent successfully");
  } catch (error) {
    console.error("Email sending error:", error);
    // Don't throw error to avoid breaking deposit creation
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
              <h2 style="font-size: 20px; margin-bottom: 25px; color: #50626a; font-weight: 600;">Dear ${
                deposit.name
              },</h2>

              <p style="line-height: 1.7; margin-bottom: 25px; font-size: 16px; color: #555555;">
                Thank you for submitting your deposit request. We have
                successfully received your transaction details and they are
                now under review by our finance team.
              </p>

              <div style="background-color: #f8f9fa; border-left: 5px solid #50626a; padding: 25px; margin: 30px 0; border-radius: 0 8px 8px 0;">
                <h3 style="margin-top: 0; color: #50626a; font-size: 18px; margin-bottom: 20px;">Deposit Details</h3>

                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Reference Number:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">${
                    deposit.referenceNumber
                  }</div>
                </div>

                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Amount:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">$${
                    deposit.amount
                  } USD</div>
                </div>

                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Transaction Type:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">${
                    deposit.transactionType
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
                Our team will verify your deposit within 1-2 business hours.
                You will receive another email notification once your deposit
                has been processed and the funds are available in your
                account.
              </p>

              <div style="margin-top: 35px; padding-top: 25px; border-top: 1px solid #eaeaea;">
                <h3 style="color: #50626a; margin-bottom: 20px; font-size: 18px; font-weight: 600;">What to Expect Next</h3>
                <ul style="padding-left: 20px; margin: 0;">
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #555555; position: relative;">
                    Our finance team will verify your transaction details
                  </li>
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #555555; position: relative;">
                    We'll confirm the deposit amount and source
                  </li>
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #555555; position: relative;">
                    You'll receive an approval notification email
                  </li>
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #555555; position: relative;">
                    Funds will be credited to your account immediately after
                    approval
                  </li>
                </ul>
              </div>

              <div style="background-color: #f0f7ff; padding: 20px; border-radius: 8px; margin-top: 25px; border: 1px solid #e1f0ff;">
                <h4 style="color: #50626a; margin-bottom: 10px; font-size: 16px;">Need Assistance?</h4>
                <p style="margin: 0; color: #555555; line-height: 1.6;">
                  If you have any questions about your deposit or need to
                  update your submission, please contact our support team at
                  <a href="mailto:support@wealthgrowerfinance.org" style="color: #50626a; text-decoration: none; font-weight: 500;">support@wealthgrowerfinance.org</a>
                  or call us at +1 (555) 123-4567.
                </p>
              </div>

              <div style="background-color: #fff8e6; padding: 15px; border-radius: 6px; margin-top: 20px; font-size: 13px; color: #856404; border: 1px solid #ffeaa7;">
                <strong>Security Notice:</strong> For your protection, please
                do not share your reference number or transaction details with
                anyone. WealthGrower Finance Bank will never ask for your
                password or sensitive information via email.
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
