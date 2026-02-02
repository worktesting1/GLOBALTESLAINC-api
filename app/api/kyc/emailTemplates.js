export const kycApprovedTemplate = (kyc) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>KYC Approved - GlobalTeslaInc</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, Helvetica, sans-serif; background-color: #f8fafc; color: #333333; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <table width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc;">
    <tr>
      <td align="center" style="padding: 40px 15px;">
        <table width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);">
          <tr>
            <td style="background-color: #50626a; padding: 30px; text-align: center; border-bottom: 4px solid #3a4a52;">
              <a href="#" style="display: inline-block; color: #ffffff; font-size: 32px; font-weight: 700; text-decoration: none; letter-spacing: -0.5px;">
                GlobalTeslaInc
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <div style="font-size: 48px; margin-bottom: 20px;">✅</div>
                <h2 style="font-size: 28px; margin-bottom: 15px; color: #27ae60; font-weight: 700;">KYC Verification Approved!</h2>
                <p style="font-size: 18px; color: #7913e5; margin: 0;">Your account is now fully verified</p>
              </div>

              <h2 style="font-size: 20px; margin-bottom: 25px; color: #50626a; font-weight: 600;">Dear ${
                kyc.name
              },</h2>

              <p style="line-height: 1.7; margin-bottom: 25px; font-size: 16px; color: #7913e5;">
                We are pleased to inform you that your KYC verification has been successfully completed and approved. Your account is now fully verified with GlobalTeslaInc.
              </p>

              <div style="background-color: #f8f9fa; border-left: 5px solid #27ae60; padding: 25px; margin: 30px 0; border-radius: 0 8px 8px 0;">
                <h3 style="margin-top: 0; color: #50626a; font-size: 18px; margin-bottom: 20px;">Verification Details</h3>

                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Document Type:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">${
                    kyc.idName
                  }</div>
                </div>

                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Approval Date:</div>
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

                <div style="display: inline-block; padding: 8px 16px; background-color: #d4edda; color: #155724; border-radius: 6px; font-size: 14px; font-weight: 600; margin-top: 15px; border: 1px solid #c3e6cb;">
                  Status: Verified ✅
                </div>
              </div>

              <div style="margin-top: 35px; padding-top: 25px; border-top: 1px solid #eaeaea;">
                <h3 style="color: #50626a; margin-bottom: 20px; font-size: 18px; font-weight: 600;">Full Account Access Unlocked</h3>
                <ul style="padding-left: 20px; margin: 0;">
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #7913e5;">
                    ✅ Higher transaction limits
                  </li>
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #7913e5;">
                    ✅ Full withdrawal capabilities
                  </li>
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #7913e5;">
                    ✅ Access to premium features
                  </li>
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #7913e5;">
                    ✅ Enhanced security protection
                  </li>
                </ul>
              </div>

              <div style="background-color: #f0f7ff; padding: 20px; border-radius: 8px; margin-top: 25px; border: 1px solid #e1f0ff;">
                <h4 style="color: #50626a; margin-bottom: 10px; font-size: 16px;">Start Banking With Confidence</h4>
                <p style="margin: 0; color: #7913e5; line-height: 1.6;">
                  With your verified account, you can now enjoy all the benefits of GlobalTeslaInc. Explore our full range of financial services and investment opportunities.
                </p>
              </div>

              <p style="line-height: 1.7; margin-top: 25px; font-size: 16px; color: #7913e5;">
                Thank you for completing the verification process with us.<br />
                <strong>The GlobalTeslaInc Team</strong>
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color: #f5f7f9; padding: 30px; text-align: center; font-size: 14px; color: #666666; border-top: 1px solid #eaeaea;">
              <p style="margin: 0;">
                &copy; ${new Date().getFullYear()} GlobalTeslaInc. All rights reserved.
              </p>
              <div style="margin-top: 20px; line-height: 1.6;">
                <p style="margin: 0;">
                  GlobalTeslaInc | 123 Financial District, City, Country
                </p>
                <p style="margin: 0;">
                  Email:
                  <a href="mailto:support@globalteslainc.online" style="color: #50626a; text-decoration: none; font-weight: 500;">support@globalteslainc.online</a>
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

export const kycRejectedTemplate = (kyc, reason) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>KYC Update - GlobalTeslaInc</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, Helvetica, sans-serif; background-color: #f8fafc; color: #333333; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <table width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc;">
    <tr>
      <td align="center" style="padding: 40px 15px;">
        <table width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);">
          <tr>
            <td style="background-color: #50626a; padding: 30px; text-align: center; border-bottom: 4px solid #3a4a52;">
              <a href="#" style="display: inline-block; color: #ffffff; font-size: 32px; font-weight: 700; text-decoration: none; letter-spacing: -0.5px;">
                GlobalTeslaInc
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
                <h2 style="font-size: 28px; margin-bottom: 15px; color: #e74c3c; font-weight: 700;">KYC Verification Update</h2>
                <p style="font-size: 18px; color: #7913e5; margin: 0;">Additional Information Required</p>
              </div>

              <h2 style="font-size: 20px; margin-bottom: 25px; color: #50626a; font-weight: 600;">Dear ${
                kyc.name
              },</h2>

              <p style="line-height: 1.7; margin-bottom: 25px; font-size: 16px; color: #7913e5;">
                We've reviewed your KYC submission, but we need additional information or clarification to complete your verification process.
              </p>

              <div style="background-color: #f8f9fa; border-left: 5px solid #e74c3c; padding: 25px; margin: 30px 0; border-radius: 0 8px 8px 0;">
                <h3 style="margin-top: 0; color: #50626a; font-size: 18px; margin-bottom: 20px;">Verification Status</h3>

                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Document Type:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">${
                    kyc.idName
                  }</div>
                </div>

                ${
                  reason
                    ? `
                <div style="margin-bottom: 12px; display: flex; align-items: center;">
                  <div style="font-weight: 600; width: 140px; color: #50626a; font-size: 15px;">Reason:</div>
                  <div style="font-weight: 500; color: #333333; font-size: 15px;">${reason}</div>
                </div>
                `
                    : ""
                }

                <div style="display: inline-block; padding: 8px 16px; background-color: #f8d7da; color: #721c24; border-radius: 6px; font-size: 14px; font-weight: 600; margin-top: 15px; border: 1px solid #f5c6cb;">
                  Status: Additional Information Required
                </div>
              </div>

              <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #ffeaa7;">
                <h4 style="color: #856404; margin-bottom: 10px; font-size: 16px;">Common Issues & Solutions</h4>
                <ul style="padding-left: 20px; margin: 0; color: #856404;">
                  <li style="margin-bottom: 8px; line-height: 1.5;">Blurry or unclear document images</li>
                  <li style="margin-bottom: 8px; line-height: 1.5;">Expired identification document</li>
                  <li style="margin-bottom: 8px; line-height: 1.5;">Name mismatch with account records</li>
                  <li style="margin-bottom: 8px; line-height: 1.5;">Incomplete document submission</li>
                </ul>
              </div>

              <div style="margin-top: 35px; padding-top: 25px; border-top: 1px solid #eaeaea;">
                <h3 style="color: #50626a; margin-bottom: 20px; font-size: 18px; font-weight: 600;">Next Steps</h3>
                <ul style="padding-left: 20px; margin: 0;">
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #7913e5;">
                    Review the reason provided above
                  </li>
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #7913e5;">
                    Prepare clear, high-quality document images
                  </li>
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #7913e5;">
                    Ensure all information matches your account details
                  </li>
                  <li style="margin-bottom: 12px; line-height: 1.6; color: #7913e5;">
                    Resubmit your KYC documents when ready
                  </li>
                </ul>
              </div>

              <div style="background-color: #f0f7ff; padding: 20px; border-radius: 8px; margin-top: 25px; border: 1px solid #e1f0ff;">
                <h4 style="color: #50626a; margin-bottom: 10px; font-size: 16px;">Need Help Resubmitting?</h4>
                <p style="margin: 0; color: #7913e5; line-height: 1.6;">
                  Our support team is here to help you through the verification process. Contact us at
                  <a href="mailto:support@globalteslainc.online" style="color: #50626a; text-decoration: none; font-weight: 500;">support@globalteslainc.online</a>
                  for guidance.
                </p>
              </div>

              <p style="line-height: 1.7; margin-top: 25px; font-size: 16px; color: #7913e5;">
                We appreciate your cooperation in completing the verification process.<br />
                <strong>The GlobalTeslaInc Team</strong>
              </p>
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
