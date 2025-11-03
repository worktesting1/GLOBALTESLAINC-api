// utils/emailTemplates.js
function generateKYCEmailTemplate(data) {
  const { name, kycId, submissionDate, idName, idNumber } = data;

  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>KYC Submission Confirmation</title>
    <style>
      /* Reset styles for email clients */
      body,
      table,
      td,
      a {
        -webkit-text-size-adjust: 100%;
        -ms-text-size-adjust: 100%;
      }
      table,
      td {
        mso-table-lspace: 0pt;
        mso-table-rspace: 0pt;
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
        font-family: Arial, Helvetica, sans-serif;
        margin: 0;
        padding: 0;
        background-color: #f5f7f9;
        color: #333333;
      }

      .email-container {
        max-width: 600px;
        margin: 0 auto;
        background-color: #ffffff;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      }

      .header {
        background-color: #50626a;
        padding: 25px 30px;
        text-align: center;
      }

      .logo {
        display: inline-block;
        color: #ffffff;
        font-size: 28px;
        font-weight: bold;
        text-decoration: none;
      }

      .logo span {
        display: block;
        font-size: 14px;
        font-weight: normal;
        margin-top: 5px;
        opacity: 0.9;
      }

      .content {
        padding: 35px 40px;
      }

      .greeting {
        font-size: 18px;
        margin-bottom: 25px;
        color: #50626a;
      }

      .message {
        line-height: 1.6;
        margin-bottom: 25px;
      }

      .kyc-details {
        background-color: #f8f9fa;
        border-left: 4px solid #50626a;
        padding: 20px;
        margin: 25px 0;
        border-radius: 0 4px 4px 0;
      }

      .detail-row {
        margin-bottom: 10px;
        display: flex;
      }

      .detail-label {
        font-weight: bold;
        width: 120px;
        color: #50626a;
      }

      .status {
        display: inline-block;
        padding: 6px 12px;
        background-color: #fff3cd;
        color: #856404;
        border-radius: 4px;
        font-size: 14px;
        font-weight: bold;
        margin-top: 10px;
      }

      .next-steps {
        margin-top: 30px;
        padding-top: 20px;
        border-top: 1px solid #eaeaea;
      }

      .next-steps h3 {
        color: #50626a;
        margin-bottom: 15px;
      }

      .next-steps ul {
        padding-left: 20px;
      }

      .next-steps li {
        margin-bottom: 10px;
      }

      .footer {
        background-color: #f5f7f9;
        padding: 25px 30px;
        text-align: center;
        font-size: 14px;
        color: #666666;
      }

      .contact-info {
        margin-top: 15px;
      }

      .contact-info a {
        color: #50626a;
        text-decoration: none;
      }

      @media only screen and (max-width: 600px) {
        .content {
          padding: 25px 20px;
        }

        .detail-row {
          flex-direction: column;
          margin-bottom: 15px;
        }

        .detail-label {
          width: 100%;
          margin-bottom: 5px;
        }
      }
    </style>
  </head>
  <body>
    <table
      role="presentation"
      width="100%"
      cellspacing="0"
      cellpadding="0"
      border="0"
    >
      <tr>
        <td align="center" style="padding: 30px 15px">
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
                  wealthgrower
                  <span>finance</span>
                </a>
              </td>
            </tr>

            <!-- Content -->
            <tr>
              <td class="content">
                <h2 class="greeting">Dear ${name},</h2>

                <p class="message">
                  Thank you for submitting your KYC (Know Your Customer)
                  information. We have successfully received your documents and
                  they are now under review.
                </p>

                <div class="kyc-details">
                  <h3 style="margin-top: 0; color: #50626a">
                    KYC Submission Details
                  </h3>

                  <div class="detail-row">
                    <div class="detail-label">Reference ID:</div>
                    <div>${kycId}</div>
                  </div>

                  <div class="detail-row">
                    <div class="detail-label">Submission Date:</div>
                    <div>${submissionDate}</div>
                  </div>

                  <div class="detail-row">
                    <div class="detail-label">ID Type:</div>
                    <div>${idName}</div>
                  </div>

                  <div class="detail-row">
                    <div class="detail-label">ID Number:</div>
                    <div>${idNumber}</div>
                  </div>

                  <div class="status">Status: Pending Review</div>
                </div>

                <p class="message">
                  Our verification team will review your submitted documents.
                  This process typically takes 1-3 business days. You will
                  receive another email notification once your KYC verification
                  is complete.
                </p>

                <div class="next-steps">
                  <h3>What happens next?</h3>
                  <ul>
                    <li>Our team will verify your identity documents</li>
                    <li>
                      We'll check that all information matches our records
                    </li>
                    <li>You'll receive a confirmation email once verified</li>
                    <li>
                      Your account will be fully activated after successful
                      verification
                    </li>
                  </ul>
                </div>

                <p class="message">
                  If you have any questions or need to update your submission,
                  please contact our support team at
                  <a
                    href="mailto:support@wealthgrowerfinance.org"
                    style="color: #50626a"
                    >support@wealthgrowerfinance.org</a
                  >.
                </p>

                <p class="message">
                  Best regards,<br />
                  <strong>The WealthGrower Finance Team</strong>
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td class="footer">
                <p>&copy; ${new Date().getFullYear()} WealthGrower Finance. All rights reserved.</p>
                <div class="contact-info">
                  <p>
                    WealthGrower Finance | 123 Financial District, City, Country
                  </p>
                  <p>
                    Email:
                    <a href="mailto:support@wealthgrowerfinance.org"
                      >support@wealthgrowerfinance.org</a
                    >
                    | Phone: +1 (555) 123-4567
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
}

module.exports = { generateKYCEmailTemplate };
