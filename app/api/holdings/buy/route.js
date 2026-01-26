import { NextResponse } from "next/server";
import dbConnect from "../../../../lib/mongodb";
import Holding from "../../../../models/Holding";
import Transaction from "../../../../models/Transaction";
import Wallet from "../../../../models/Wallet";
import { withAuth } from "../../../../lib/apiHander";
import { corsHeaders, handleOptions } from "../../../../lib/cors";
import mongoose from "mongoose";
import nodemailer from "nodemailer";

// Handle CORS preflight
export async function OPTIONS(request) {
  return handleOptions(request);
}

// Configure Nodemailer transporter
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: process.env.MAIL_PORT,
  secure: true,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASSWORD,
  },
});

// Function to send purchase confirmation email
async function sendPurchaseConfirmationEmail(userEmail, purchaseData) {
  const teslaColors = {
    primary: "#CC0000", // Tesla Red
    secondary: "#000000", // Tesla Black
    accent: "#FFFFFF", // Tesla White
    background: "#F5F5F5", // Light Gray
    textDark: "#333333",
    textLight: "#666666",
    border: "#E0E0E0",
  };

  const emailHtml = `
  <!DOCTYPE html>
  <html>
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Purchase Confirmation - GlobalTeslaInc</title>
      <style>
          body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
              line-height: 1.6;
              color: ${teslaColors.textDark};
              margin: 0;
              padding: 0;
              background-color: ${teslaColors.background};
          }
          .container {
              max-width: 600px;
              margin: 0 auto;
              background-color: ${teslaColors.accent};
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          }
          .header {
              background: ${teslaColors.primary};
              color: ${teslaColors.accent};
              padding: 40px 20px;
              text-align: center;
          }
          .logo {
              font-size: 32px;
              font-weight: bold;
              margin-bottom: 10px;
              letter-spacing: 1px;
          }
          .logo-text {
              font-size: 18px;
              opacity: 0.9;
              font-weight: 300;
          }
          .content {
              padding: 40px 30px;
          }
          .purchase-header {
              color: ${teslaColors.primary};
              border-bottom: 2px solid ${teslaColors.border};
              padding-bottom: 20px;
              margin-bottom: 30px;
          }
          .purchase-details {
              background: ${teslaColors.background};
              border-radius: 6px;
              padding: 25px;
              margin-bottom: 30px;
          }
          .detail-row {
              display: flex;
              justify-content: space-between;
              padding: 12px 0;
              border-bottom: 1px solid ${teslaColors.border};
          }
          .detail-row:last-child {
              border-bottom: none;
          }
          .detail-label {
              color: ${teslaColors.textLight};
              font-weight: 500;
          }
          .detail-value {
              color: ${teslaColors.textDark};
              font-weight: 600;
          }
          .highlight {
              color: ${teslaColors.primary};
              font-weight: 700;
          }
          .transaction-id {
              background: ${teslaColors.secondary};
              color: ${teslaColors.accent};
              padding: 12px 20px;
              border-radius: 4px;
              font-family: monospace;
              font-size: 14px;
              margin: 20px 0;
              text-align: center;
          }
          .wallet-info {
              background: ${teslaColors.background};
              border-left: 4px solid ${teslaColors.primary};
              padding: 20px;
              margin: 25px 0;
              border-radius: 4px;
          }
          .footer {
              text-align: center;
              padding: 30px;
              background: ${teslaColors.secondary};
              color: ${teslaColors.accent};
              margin-top: 30px;
          }
          .footer-links {
              margin-top: 20px;
          }
          .footer-links a {
              color: ${teslaColors.accent};
              text-decoration: none;
              margin: 0 15px;
              opacity: 0.8;
              transition: opacity 0.3s;
          }
          .footer-links a:hover {
              opacity: 1;
              text-decoration: underline;
          }
          .success-icon {
              color: #4CAF50;
              font-size: 48px;
              text-align: center;
              margin-bottom: 20px;
          }
          .button {
              display: inline-block;
              background: ${teslaColors.primary};
              color: ${teslaColors.accent};
              padding: 14px 28px;
              text-decoration: none;
              border-radius: 4px;
              font-weight: 600;
              margin: 20px 0;
              transition: background 0.3s;
          }
          .button:hover {
              background: #B30000;
          }
          @media (max-width: 600px) {
              .content {
                  padding: 20px;
              }
              .detail-row {
                  flex-direction: column;
              }
              .detail-value {
                  margin-top: 5px;
              }
          }
      </style>
  </head>
  <body>
      <div class="container">
          <div class="header">
              <div class="logo">GLOBAL TESLA INC</div>
              <div class="logo-text">Accelerating the World's Transition to Sustainable Investment</div>
          </div>
          
          <div class="content">
              <div class="success-icon">✓</div>
              
              <h1 class="purchase-header">Purchase Confirmation</h1>
              
              <p>Dear Investor,</p>
              
              <p>Your stock purchase has been successfully processed. Here are the details of your transaction:</p>
              
              <div class="purchase-details">
                  <div class="detail-row">
                      <span class="detail-label">Stock Symbol</span>
                      <span class="detail-value highlight">${purchaseData.symbol}</span>
                  </div>
                  <div class="detail-row">
                      <span class="detail-label">Company Name</span>
                      <span class="detail-value">${purchaseData.assetName}</span>
                  </div>
                  <div class="detail-row">
                      <span class="detail-label">Quantity</span>
                      <span class="detail-value">${purchaseData.quantity} shares</span>
                  </div>
                  <div class="detail-row">
                      <span class="detail-label">Price per Share</span>
                      <span class="detail-value">$${purchaseData.price.toFixed(2)}</span>
                  </div>
                  <div class="detail-row">
                      <span class="detail-label">Total Amount</span>
                      <span class="detail-value">$${purchaseData.totalAmount.toFixed(2)}</span>
                  </div>
                  <div class="detail-row">
                      <span class="detail-label">Transaction Fees</span>
                      <span class="detail-value">$${purchaseData.fees.toFixed(2)}</span>
                  </div>
                  <div class="detail-row">
                      <span class="detail-label">Net Amount</span>
                      <span class="detail-value highlight">$${purchaseData.netAmount.toFixed(2)}</span>
                  </div>
              </div>
              
              <div class="wallet-info">
                  <h3 style="color: ${teslaColors.primary}; margin-top: 0;">Wallet Update</h3>
                  <p><strong>Amount Deducted:</strong> $${purchaseData.netAmount.toFixed(2)}</p>
                  <p><strong>New Balance:</strong> $${purchaseData.newBalance.toFixed(2)}</p>
                  <p><strong>Transaction Date:</strong> ${new Date().toLocaleDateString(
                    "en-US",
                    {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    },
                  )}</p>
              </div>
              
              <div class="transaction-id">
                  Transaction ID: ${purchaseData.transactionId}
              </div>
              
              <p style="text-align: center;">
                  <a href="https://globalteslainc.online/dashboard" class="button">View in Dashboard</a>
              </p>
              
              <p>This transaction will appear in your portfolio immediately. You can view your holdings and transaction history at any time in your dashboard.</p>
              
              <p><strong>Important:</strong> Please keep this email for your records. If you have any questions about this transaction, contact our support team at support@globalteslainc.online.</p>
          </div>
          
          <div class="footer">
              <div style="margin-bottom: 20px;">
                  <strong>GlobalTeslaInc</strong><br>
                  Accelerating Sustainable Investment Worldwide
              </div>
              
              <div class="footer-links">
                  <a href="https://globalteslainc.online">Website</a>
                  <a href="https://globalteslainc.online/dashboard">Dashboard</a>
                  <a href="https://globalteslainc.online/support">Support</a>
                  <a href="https://globalteslainc.online/privacy">Privacy Policy</a>
              </div>
              
              <div style="margin-top: 20px; font-size: 12px; opacity: 0.7;">
                  © ${new Date().getFullYear()} GlobalTeslaInc. All rights reserved.<br>
                  This is an automated message, please do not reply directly to this email.
              </div>
          </div>
      </div>
  </body>
  </html>
  `;

  const mailOptions = {
    from: `"GlobalTeslaInc" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
    to: userEmail,
    subject: `Purchase Confirmation: ${purchaseData.quantity} shares of ${purchaseData.symbol}`,
    html: emailHtml,
    text: `Purchase Confirmation\n\nDear Investor,\n\nYour purchase of ${purchaseData.quantity} shares of ${purchaseData.symbol} (${purchaseData.assetName}) has been successfully processed.\n\nTotal Amount: $${purchaseData.totalAmount.toFixed(2)}\nFees: $${purchaseData.fees.toFixed(2)}\nNet Amount: $${purchaseData.netAmount.toFixed(2)}\nNew Wallet Balance: $${purchaseData.newBalance.toFixed(2)}\nTransaction ID: ${purchaseData.transactionId}\n\nView your portfolio: https://globalteslainc.online/dashboard\n\nGlobalTeslaInc\nhttps://globalteslainc.online`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Purchase confirmation email sent to ${userEmail}`);
  } catch (error) {
    console.error("Error sending email:", error);
    // Don't throw error - email failure shouldn't break the purchase
  }
}

// Main buy endpoint
export const POST = withAuth(async (request) => {
  try {
    await dbConnect();

    const body = await request.json();
    const { symbol, quantity, price, assetName, fees = 0, userEmail } = body;

    const userId = request.userId;

    // Validate input
    if (!symbol || !quantity || !price || !assetName) {
      return NextResponse.json(
        {
          error: "Missing required fields: symbol, quantity, price, assetName",
        },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    if (quantity <= 0 || price <= 0) {
      return NextResponse.json(
        { error: "Quantity and price must be greater than zero" },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    // Calculate amounts
    const totalAmount = quantity * price;
    const netAmount = totalAmount + fees;
    const uppercaseSymbol = symbol.toUpperCase();

    // Start MongoDB transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    let transaction;
    let wallet;
    let holding;

    try {
      // Check wallet balance first
      wallet = await Wallet.findOne({ userId }).session(session);

      if (!wallet) {
        await session.abortTransaction();
        session.endSession();
        return NextResponse.json(
          { error: "Wallet not found" },
          { status: 404, headers: corsHeaders(request) },
        );
      }

      // Check if user has sufficient balance
      if (wallet.balanceUSD < netAmount) {
        await session.abortTransaction();
        session.endSession();
        return NextResponse.json(
          {
            error: "Insufficient funds",
            required: netAmount,
            available: wallet.balanceUSD,
            shortfall: netAmount - wallet.balanceUSD,
          },
          { status: 400, headers: corsHeaders(request) },
        );
      }

      // Deduct amount from wallet
      const previousBalance = wallet.balanceUSD;
      wallet.balanceUSD -= netAmount;
      await wallet.save({ session });

      // Find existing holding
      holding = await Holding.findOne({
        userId,
        symbol: uppercaseSymbol,
      }).session(session);

      if (holding) {
        // Calculate new average price (weighted average)
        const existingCost = holding.totalInvested;
        const newCost = totalAmount + fees;
        const newTotalQuantity = holding.quantity + quantity;
        const newAvgPrice = (existingCost + newCost) / newTotalQuantity;

        holding.quantity = newTotalQuantity;
        holding.avgPurchasePrice = newAvgPrice;
        holding.totalInvested = existingCost + newCost;

        holding.purchaseHistory.push({
          quantity,
          price,
          fees,
        });

        await holding.save({ session });
      } else {
        // Create new holding
        holding = new Holding({
          userId,
          symbol: uppercaseSymbol,
          name: assetName,
          quantity,
          avgPurchasePrice: price,
          totalInvested: totalAmount + fees,
          purchaseHistory: [
            {
              quantity,
              price,
              fees,
            },
          ],
          currency: "USD",
        });

        await holding.save({ session });
      }

      // Create transaction record
      transaction = new Transaction({
        userId,
        type: "BUY",
        symbol: uppercaseSymbol,
        assetName,
        quantity,
        price,
        totalAmount,
        fees,
        netAmount,
        currency: "USD",
        status: "COMPLETED",
      });

      await transaction.save({ session });

      // Commit transaction
      await session.commitTransaction();
      session.endSession();

      // Send confirmation email (don't await - send in background)
      if (userEmail) {
        const purchaseData = {
          symbol: uppercaseSymbol,
          assetName,
          quantity,
          price,
          totalAmount,
          fees,
          netAmount,
          newBalance: wallet.balanceUSD,
          previousBalance,
          transactionId:
            transaction.transactionId || transaction._id.toString(),
        };

        // Send email without awaiting
        sendPurchaseConfirmationEmail(userEmail, purchaseData);
      }

      // Return success response
      return NextResponse.json(
        {
          success: true,
          message: `Successfully purchased ${quantity} shares of ${uppercaseSymbol}`,
          data: {
            symbol: uppercaseSymbol,
            name: assetName,
            price: price,
            change: 0,
            changePercent: 0,
            volume: "0M",
            marketCap: "$0M",
            sector: "Technology",
            industry: "Technology",
            logo: `https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/${uppercaseSymbol}.png`,
            exchange: "NASDAQ",
            country: "US",
            currency: "USD",
            quantity: quantity,
            total: netAmount,
          },
          transaction: {
            id: transaction.transactionId || transaction._id.toString(),
            amount: netAmount,
            fees: fees,
          },
          wallet: {
            newBalance: wallet.balanceUSD,
            previousBalance: previousBalance,
            deducted: netAmount,
          },
          emailSent: !!userEmail,
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
    console.error("Buy stock error:", error);

    return NextResponse.json(
      {
        error: "Failed to process purchase",
        details: error.message,
      },
      {
        status: 500,
        headers: corsHeaders(request),
      },
    );
  }
});
