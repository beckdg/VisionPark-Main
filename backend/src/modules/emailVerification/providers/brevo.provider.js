const axios = require("axios");
const { env } = require("../../../config/env");
const { logger } = require("../../../common/logger");
const { InternalServerError } = require("../../../common/errors");

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

const buildOtpEmailHtml = ({ recipientName, otpCode }) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify Your VisionPark Account</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#059669,#10b981);padding:28px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px;">VisionPark</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:14px;">Email Verification</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;color:#18181b;font-size:16px;line-height:1.5;">
                Hi${recipientName ? ` ${recipientName}` : ""},
              </p>
              <p style="margin:0 0 24px;color:#52525b;font-size:15px;line-height:1.6;">
                Use the verification code below to complete your VisionPark driver account setup.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="background:#f0fdf4;border:2px dashed #10b981;border-radius:12px;padding:24px;">
                    <p style="margin:0 0 8px;color:#71717a;font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Your verification code</p>
                    <p style="margin:0;font-size:36px;font-weight:700;letter-spacing:8px;color:#059669;font-family:'Courier New',monospace;">${otpCode}</p>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;color:#71717a;font-size:13px;line-height:1.6;">
                This code expires in <strong>10 minutes</strong>. Do not share it with anyone.
              </p>
              <p style="margin:16px 0 0;color:#a1a1aa;font-size:12px;line-height:1.6;">
                If you did not create a VisionPark account, you can safely ignore this email.
                Need help? Contact our support team.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background:#fafafa;border-top:1px solid #e4e4e7;text-align:center;">
              <p style="margin:0;color:#a1a1aa;font-size:11px;">&copy; ${new Date().getFullYear()} VisionPark. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const sendOtpEmail = async ({ toEmail, recipientName, otpCode }) => {
  if (env.isTest) {
    logger.info("Brevo OTP email skipped in test environment", {
      module: "emailVerification.brevo",
      toEmail,
      otpCode,
    });
    return { messageId: "test-skip" };
  }

  if (!env.brevoApiKey || !env.brevoSenderEmail) {
    throw new InternalServerError(
      "Email service is not configured. Please contact support."
    );
  }

  const payload = {
    sender: {
      name: env.brevoSenderName || "VisionPark",
      email: env.brevoSenderEmail,
    },
    to: [{ email: toEmail, name: recipientName || toEmail }],
    subject: "Verify Your VisionPark Account",
    htmlContent: buildOtpEmailHtml({ recipientName, otpCode }),
    textContent: `Your VisionPark verification code is: ${otpCode}\n\nThis code expires in 10 minutes. If you did not sign up, ignore this email.`,
  };

  try {
    const response = await axios.post(BREVO_API_URL, payload, {
      headers: {
        "api-key": env.brevoApiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      timeout: 15_000,
    });
    return response.data;
  } catch (error) {
    logger.error("Brevo email send failed", {
      module: "emailVerification.brevo",
      status: error?.response?.status,
      message: error?.message,
    });
    throw new InternalServerError(
      "Unable to send verification email. Please try again later."
    );
  }
};

module.exports = {
  sendOtpEmail,
  buildOtpEmailHtml,
};
