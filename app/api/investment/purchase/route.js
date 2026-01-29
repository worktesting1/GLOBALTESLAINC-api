import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import InvestmentPlan from "@/models/InvestmentPlan";
import InvestmentHolding from "@/models/InvestmentHolding";
import InvestmentTransaction from "@/models/InvestmentTransaction";
import Wallet from "@/models/Wallet";
import { withAuth } from "@/lib/apiHander";
import { corsHeaders, handleOptions } from "@/lib/cors";
import mongoose from "mongoose";

// Handle CORS preflight
export async function OPTIONS(request) {
  return handleOptions(request);
}

// Main investment purchase endpoint
export const POST = withAuth(async (request) => {
  try {
    await dbConnect();

    const body = await request.json();
    const {
      planId,
      investmentAmount,
      units,
      processingFee = 0,
      userEmail,
    } = body;

    const userId = request.userId;

    // Validate input
    if (!planId || !investmentAmount || !units) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: planId, investmentAmount, units",
        },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    if (investmentAmount <= 0 || units <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Investment amount and units must be greater than zero",
        },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    // Calculate total cost
    const totalCost = investmentAmount + processingFee;

    // Start MongoDB transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    let transaction;
    let wallet;
    let holding;
    let plan;

    try {
      // Check wallet balance first
      wallet = await Wallet.findOne({ userId }).session(session);

      if (!wallet) {
        await session.abortTransaction();
        session.endSession();
        return NextResponse.json(
          {
            success: false,
            error: "Wallet not found",
          },
          { status: 404, headers: corsHeaders(request) },
        );
      }

      // Get investment plan
      plan = await InvestmentPlan.findById(planId).session(session);

      if (!plan) {
        await session.abortTransaction();
        session.endSession();
        return NextResponse.json(
          {
            success: false,
            error: "Investment plan not found",
          },
          { status: 404, headers: corsHeaders(request) },
        );
      }

      // Check if plan is active
      if (plan.status !== "active") {
        await session.abortTransaction();
        session.endSession();
        return NextResponse.json(
          {
            success: false,
            error: "This investment plan is not currently available",
          },
          { status: 400, headers: corsHeaders(request) },
        );
      }

      // Check minimum investment
      if (investmentAmount < plan.minInvestment) {
        await session.abortTransaction();
        session.endSession();
        return NextResponse.json(
          {
            success: false,
            error: `Minimum investment is $${plan.minInvestment}`,
            minInvestment: plan.minInvestment,
          },
          { status: 400, headers: corsHeaders(request) },
        );
      }

      // Check if user has sufficient balance
      if (wallet.balanceUSD < totalCost) {
        await session.abortTransaction();
        session.endSession();
        return NextResponse.json(
          {
            success: false,
            error: "Insufficient funds",
            required: totalCost,
            available: wallet.balanceUSD,
            shortfall: totalCost - wallet.balanceUSD,
          },
          { status: 400, headers: corsHeaders(request) },
        );
      }

      // Calculate NAV per unit (this should be the purchase price)
      const navPerUnit = investmentAmount / units;

      // Deduct amount from wallet
      const previousBalance = wallet.balanceUSD;
      wallet.balanceUSD -= totalCost;
      await wallet.save({ session });

      // Update total invested in wallet
      wallet.totalInvested += investmentAmount;
      await wallet.save({ session });

      // Find existing investment holding (using simplified schema)
      holding = await InvestmentHolding.findOne({
        userId,
        planId,
      }).session(session);

      if (holding) {
        // Calculate new average price (weighted average) - same as stock holdings
        const existingCost = holding.totalInvested;
        const newCost = investmentAmount + processingFee;
        const newTotalUnits = holding.units + units;
        const newAvgPrice = (existingCost + newCost) / newTotalUnits;

        // Update existing holding using simplified schema
        holding.units = newTotalUnits;
        holding.avgPurchasePrice = newAvgPrice;
        holding.totalInvested = existingCost + newCost;

        holding.purchaseHistory.push({
          date: new Date(),
          units: units,
          nav: navPerUnit, // Store NAV as price per unit
          fees: processingFee,
        });

        await holding.save({ session });
      } else {
        // Create new investment holding using simplified schema
        holding = new InvestmentHolding({
          userId,
          planId,
          planName: plan.name,
          units: units,
          avgPurchasePrice: (investmentAmount + processingFee) / units,
          totalInvested: investmentAmount + processingFee,
          purchaseHistory: [
            {
              date: new Date(),
              units: units,
              nav: navPerUnit,
              fees: processingFee,
            },
          ],
          currency: "USD",
        });

        await holding.save({ session });
      }

      // Create investment transaction record
      transaction = new InvestmentTransaction({
        userId,
        type: "INVESTMENT_BUY",
        planId,
        planName: plan.name,
        units,
        nav: navPerUnit, // Use calculated NAV per unit
        investmentAmount,
        processingFee,
        totalCost,
        status: "COMPLETED",
        currency: "USD",
      });

      await transaction.save({ session });

      // Commit transaction
      await session.commitTransaction();
      session.endSession();

      // Calculate current value for response (units * current plan NAV)
      const currentValue = holding.units * plan.nav;

      // Return success response
      return NextResponse.json(
        {
          success: true,
          message: `Successfully invested in ${plan.name}`,
          data: {
            investment: {
              id: holding._id.toString(),
              planId: plan._id.toString(),
              planName: plan.name,
              category: plan.category,
              riskLevel: plan.riskLevel,
              units: units,
              totalUnits: holding.units,
              investmentAmount,
              totalInvested: holding.totalInvested,
              averageCost: holding.avgPurchasePrice,
              currentValue: currentValue,
              gainLoss: currentValue - holding.totalInvested,
              gainLossPercentage:
                holding.totalInvested > 0
                  ? ((currentValue - holding.totalInvested) /
                      holding.totalInvested) *
                    100
                  : 0,
              nav: plan.nav, // Current NAV
              oneYearReturn: plan.oneYearReturn,
              minInvestment: plan.minInvestment,
              formattedNav: `$${plan.nav.toFixed(4)}`,
              formattedReturn: `${
                plan.oneYearReturn >= 0 ? "+" : ""
              }${plan.oneYearReturn.toFixed(2)}%`,
            },
            transaction: {
              id: transaction.transactionId || transaction._id.toString(),
              type: transaction.type,
              amount: investmentAmount,
              fee: processingFee,
              totalAmount: totalCost,
              units,
              nav: navPerUnit,
              timestamp: transaction.createdAt,
            },
            wallet: {
              newBalance: wallet.balanceUSD,
              previousBalance,
              deducted: totalCost,
              change: -totalCost,
            },
            emailSent: false, // Email skipped for now
          },
        },
        {
          status: 200,
          headers: corsHeaders(request),
        },
      );
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error) {
    console.error("Investment purchase error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to process investment purchase",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      },
      {
        status: 500,
        headers: corsHeaders(request),
      },
    );
  }
});
// // Configure Nodemailer transporter (same as stock purchase)
// const transporter = nodemailer.createTransport({
//   host: process.env.MAIL_HOST,
//   port: process.env.MAIL_PORT,
//   secure: true,
//   auth: {
//     user: process.env.MAIL_USER,
//     pass: process.env.MAIL_PASSWORD,
//   },
// });

// // Function to send investment purchase confirmation email
// async function sendInvestmentConfirmationEmail(userEmail, purchaseData) {
//   const teslaColors = {
//     primary: "#CC0000",
//     secondary: "#000000",
//     accent: "#FFFFFF",
//     background: "#F5F5F5",
//     textDark: "#333333",
//     textLight: "#666666",
//     border: "#E0E0E0",
//   };

//   const emailHtml = `
//   <!DOCTYPE html>
//   <html>
//   <head>
//       <meta charset="UTF-8">
//       <meta name="viewport" content="width=device-width, initial-scale=1.0">
//       <title>Investment Purchase Confirmation - GlobalTeslaInc</title>
//       <style>
//           body {
//               font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
//               line-height: 1.6;
//               color: ${teslaColors.textDark};
//               margin: 0;
//               padding: 0;
//               background-color: ${teslaColors.background};
//           }
//           .container {
//               max-width: 600px;
//               margin: 0 auto;
//               background-color: ${teslaColors.accent};
//               border-radius: 8px;
//               overflow: hidden;
//               box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
//           }
//           .header {
//               background: ${teslaColors.primary};
//               color: ${teslaColors.accent};
//               padding: 40px 20px;
//               text-align: center;
//           }
//           .logo {
//               font-size: 32px;
//               font-weight: bold;
//               margin-bottom: 10px;
//               letter-spacing: 1px;
//           }
//           .logo-text {
//               font-size: 18px;
//               opacity: 0.9;
//               font-weight: 300;
//           }
//           .content {
//               padding: 40px 30px;
//           }
//           .purchase-header {
//               color: ${teslaColors.primary};
//               border-bottom: 2px solid ${teslaColors.border};
//               padding-bottom: 20px;
//               margin-bottom: 30px;
//           }
//           .purchase-details {
//               background: ${teslaColors.background};
//               border-radius: 6px;
//               padding: 25px;
//               margin-bottom: 30px;
//           }
//           .detail-row {
//               display: flex;
//               justify-content: space-between;
//               padding: 12px 0;
//               border-bottom: 1px solid ${teslaColors.border};
//           }
//           .detail-row:last-child {
//               border-bottom: none;
//           }
//           .detail-label {
//               color: ${teslaColors.textLight};
//               font-weight: 500;
//           }
//           .detail-value {
//               color: ${teslaColors.textDark};
//               font-weight: 600;
//           }
//           .highlight {
//               color: ${teslaColors.primary};
//               font-weight: 700;
//           }
//           .transaction-id {
//               background: ${teslaColors.secondary};
//               color: ${teslaColors.accent};
//               padding: 12px 20px;
//               border-radius: 4px;
//               font-family: monospace;
//               font-size: 14px;
//               margin: 20px 0;
//               text-align: center;
//           }
//           .wallet-info {
//               background: ${teslaColors.background};
//               border-left: 4px solid ${teslaColors.primary};
//               padding: 20px;
//               margin: 25px 0;
//               border-radius: 4px;
//           }
//           .plan-info {
//               background: ${teslaColors.background};
//               border-radius: 6px;
//               padding: 20px;
//               margin: 20px 0;
//           }
//           .footer {
//               text-align: center;
//               padding: 30px;
//               background: ${teslaColors.secondary};
//               color: ${teslaColors.accent};
//               margin-top: 30px;
//           }
//           .footer-links {
//               margin-top: 20px;
//           }
//           .footer-links a {
//               color: ${teslaColors.accent};
//               text-decoration: none;
//               margin: 0 15px;
//               opacity: 0.8;
//               transition: opacity 0.3s;
//           }
//           .footer-links a:hover {
//               opacity: 1;
//               text-decoration: underline;
//           }
//           .success-icon {
//               color: #4CAF50;
//               font-size: 48px;
//               text-align: center;
//               margin-bottom: 20px;
//           }
//           .button {
//               display: inline-block;
//               background: ${teslaColors.primary};
//               color: ${teslaColors.accent};
//               padding: 14px 28px;
//               text-decoration: none;
//               border-radius: 4px;
//               font-weight: 600;
//               margin: 20px 0;
//               transition: background 0.3s;
//           }
//           .button:hover {
//               background: #B30000;
//           }
//           @media (max-width: 600px) {
//               .content {
//                   padding: 20px;
//               }
//               .detail-row {
//                   flex-direction: column;
//               }
//               .detail-value {
//                   margin-top: 5px;
//               }
//           }
//       </style>
//   </head>
//   <body>
//       <div class="container">
//           <div class="header">
//               <div class="logo">GLOBAL TESLA INC</div>
//               <div class="logo-text">Accelerating the World's Transition to Sustainable Investment</div>
//           </div>

//           <div class="content">
//               <div class="success-icon">✓</div>

//               <h1 class="purchase-header">Investment Purchase Confirmation</h1>

//               <p>Dear Investor,</p>

//               <p>Your investment purchase has been successfully processed. Here are the details of your transaction:</p>

//               <div class="plan-info">
//                   <h3 style="color: ${teslaColors.primary}; margin-top: 0;">Investment Plan</h3>
//                   <p><strong>Plan Name:</strong> ${purchaseData.planName}</p>
//                   <p><strong>Category:</strong> ${purchaseData.category}</p>
//                   <p><strong>Risk Level:</strong> ${purchaseData.riskLevel}</p>
//               </div>

//               <div class="purchase-details">
//                   <div class="detail-row">
//                       <span class="detail-label">Investment Amount</span>
//                       <span class="detail-value">$${purchaseData.investmentAmount.toFixed(2)}</span>
//                   </div>
//                   <div class="detail-row">
//                       <span class="detail-label">Units Purchased</span>
//                       <span class="detail-value">${purchaseData.units.toFixed(4)}</span>
//                   </div>
//                   <div class="detail-row">
//                       <span class="detail-label">NAV at Purchase</span>
//                       <span class="detail-value">$${purchaseData.nav.toFixed(4)}</span>
//                   </div>
//                   <div class="detail-row">
//                       <span class="detail-label">Processing Fee</span>
//                       <span class="detail-value">$${purchaseData.processingFee.toFixed(2)}</span>
//                   </div>
//                   <div class="detail-row">
//                       <span class="detail-label">Total Cost</span>
//                       <span class="detail-value highlight">$${purchaseData.totalCost.toFixed(2)}</span>
//                   </div>
//               </div>

//               <div class="wallet-info">
//                   <h3 style="color: ${teslaColors.primary}; margin-top: 0;">Wallet Update</h3>
//                   <p><strong>Amount Deducted:</strong> $${purchaseData.totalCost.toFixed(2)}</p>
//                   <p><strong>New Balance:</strong> $${purchaseData.newBalance.toFixed(2)}</p>
//                   <p><strong>Transaction Date:</strong> ${new Date().toLocaleDateString(
//                     "en-US",
//                     {
//                       weekday: "long",
//                       year: "numeric",
//                       month: "long",
//                       day: "numeric",
//                     },
//                   )}</p>
//               </div>

//               <div class="transaction-id">
//                   Transaction ID: ${purchaseData.transactionId}
//               </div>

//               <p style="text-align: center;">
//                   <a href="https://globalteslainc.online/dashboard/investments" class="button">View Investment Portfolio</a>
//               </p>

//               <p>This investment will appear in your portfolio immediately. You can view your holdings and transaction history at any time in your dashboard.</p>

//               <p><strong>Important:</strong> Please keep this email for your records. If you have any questions about this transaction, contact our support team at support@globalteslainc.online.</p>
//           </div>

//           <div class="footer">
//               <div style="margin-bottom: 20px;">
//                   <strong>GlobalTeslaInc</strong><br>
//                   Accelerating Sustainable Investment Worldwide
//               </div>

//               <div class="footer-links">
//                   <a href="https://globalteslainc.online">Website</a>
//                   <a href="https://globalteslainc.online/dashboard">Dashboard</a>
//                   <a href="https://globalteslainc.online/support">Support</a>
//                   <a href="https://globalteslainc.online/privacy">Privacy Policy</a>
//               </div>

//               <div style="margin-top: 20px; font-size: 12px; opacity: 0.7;">
//                   © ${new Date().getFullYear()} GlobalTeslaInc. All rights reserved.<br>
//                   This is an automated message, please do not reply directly to this email.
//               </div>
//           </div>
//       </div>
//   </body>
//   </html>
//   `;

// //   const mailOptions = {
// //     from: `"GlobalTeslaInc" <${process.env.ADMIN_MAIL}>`,
// //     to: userEmail,
// //     subject: `Investment Purchase Confirmation: ${purchaseData.planName}`,
// //     html: emailHtml,
// //     text: `Investment Purchase Confirmation\n\nDear Investor,\n\nYour investment in ${purchaseData.planName} has been successfully processed.\n\nInvestment Amount: $${purchaseData.investmentAmount.toFixed(2)}\nUnits Purchased: ${purchaseData.units.toFixed(4)}\nNAV at Purchase: $${purchaseData.nav.toFixed(4)}\nProcessing Fee: $${purchaseData.processingFee.toFixed(2)}\nTotal Cost: $${purchaseData.totalCost.toFixed(2)}\nNew Wallet Balance: $${purchaseData.newBalance.toFixed(2)}\nTransaction ID: ${purchaseData.transactionId}\n\nView your investment portfolio: https://globalteslainc.online/dashboard/investments\n\nGlobalTeslaInc\nhttps://globalteslainc.online`,
// //   };

// //   try {
// //     await transporter.sendMail(mailOptions);
// //     console.log(`Investment confirmation email sent to ${userEmail}`);
// //   } catch (error) {
// //     console.error("Error sending email:", error);
// //   }
// }
