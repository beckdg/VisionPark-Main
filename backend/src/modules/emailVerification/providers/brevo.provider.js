const axios = require("axios");
const { env } = require("../../../config/env");
const { logger } = require("../../../common/logger");
const { InternalServerError } = require("../../../common/errors");

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

const TEMPLATES = {
  signup: {
    title: "Email Verification",
    subject: "Verify Your VisionPark Account",
    intro:
      "Use the verification code below to complete your VisionPark driver account setup.",
    footer:
      "If you did not create a VisionPark account, you can safely ignore this email.",
  },
  password_reset: {
    title: "Password Reset",
    subject: "Reset Your VisionPark Password",
    intro: "Use the verification code below to reset your VisionPark account password.",
    footer:
      "If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.",
  },
};

const buildOtpEmailHtml = ({ recipientName, otpCode, templateKey = "signup" }) => {
  const template = TEMPLATES[templateKey] || TEMPLATES.signup;
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${template.subject}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#059669,#10b981);padding:28px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px;">VisionPark</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:14px;">${template.title}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;color:#18181b;font-size:16px;line-height:1.5;">
                Hi${recipientName ? ` ${recipientName}` : ""},
              </p>
              <p style="margin:0 0 24px;color:#52525b;font-size:15px;line-height:1.6;">
                ${template.intro}
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
                ${template.footer} Need help? Contact our support team.
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
};

const sendOtpEmail = async ({ toEmail, recipientName, otpCode, templateKey = "signup" }) => {
  const template = TEMPLATES[templateKey] || TEMPLATES.signup;

  if (env.isTest) {
    logger.info("Brevo OTP email skipped in test environment", {
      module: "emailVerification.brevo",
      toEmail,
      otpCode,
      templateKey,
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
    subject: template.subject,
    htmlContent: buildOtpEmailHtml({ recipientName, otpCode, templateKey }),
    textContent: `Your VisionPark code is: ${otpCode}\n\nThis code expires in 10 minutes. ${template.footer}`,
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
      templateKey,
    });
    throw new InternalServerError(
      "Unable to send email. Please try again later."
    );
  }
};

const ROLE_LABELS = {
  owner: "Parking Owner",
  attendant: "Parking Attendant",
};

const buildWelcomeEmailHtml = ({
  recipientName,
  roleLabel,
  temporaryPassword,
  loginUrl,
}) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to VisionPark</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#059669,#10b981);padding:28px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">VisionPark</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:14px;">Welcome — ${roleLabel}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;color:#18181b;font-size:16px;line-height:1.5;">
                Hi${recipientName ? ` ${recipientName}` : ""},
              </p>
              <p style="margin:0 0 24px;color:#52525b;font-size:15px;line-height:1.6;">
                Your VisionPark ${roleLabel} account has been created. Use the temporary password below to sign in.
                You will be required to set a new password on your first login.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="background:#f0fdf4;border:2px dashed #10b981;border-radius:12px;padding:24px;">
                    <p style="margin:0 0 8px;color:#71717a;font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Temporary password</p>
                    <p style="margin:0;font-size:28px;font-weight:700;letter-spacing:4px;color:#059669;font-family:'Courier New',monospace;">${temporaryPassword}</p>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;color:#71717a;font-size:13px;line-height:1.6;">
                Sign in at: <a href="${loginUrl}" style="color:#059669;font-weight:600;">${loginUrl}</a>
              </p>
              <p style="margin:16px 0 0;color:#a1a1aa;font-size:12px;line-height:1.6;">
                For security, change this password immediately after signing in. Do not share this email.
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

const sendWelcomeEmail = async ({
  toEmail,
  recipientName,
  role,
  temporaryPassword,
}) => {
  const roleLabel = ROLE_LABELS[role] || "VisionPark User";
  const loginUrl = env.frontendAppUrl || "http://localhost:5173/login";

  if (env.isTest) {
    logger.info("Brevo welcome email skipped in test environment", {
      module: "emailVerification.brevo",
      toEmail,
      role,
      temporaryPassword,
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
    subject: `Welcome to VisionPark — Your ${roleLabel} Account`,
    htmlContent: buildWelcomeEmailHtml({
      recipientName,
      roleLabel,
      temporaryPassword,
      loginUrl,
    }),
    textContent: `Welcome to VisionPark.\n\nYour ${roleLabel} account is ready.\nTemporary password: ${temporaryPassword}\nSign in: ${loginUrl}\n\nYou must change your password on first login.`,
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
    logger.error("Brevo welcome email send failed", {
      module: "emailVerification.brevo",
      status: error?.response?.status,
      message: error?.message,
      role,
    });
    throw new InternalServerError(
      "Unable to send welcome email. Account was created but email delivery failed."
    );
  }
};

module.exports = {
  sendOtpEmail,
  sendWelcomeEmail,
  buildOtpEmailHtml,
  TEMPLATES,
};
