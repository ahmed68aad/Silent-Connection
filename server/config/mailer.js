import nodemailer from "nodemailer";

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpSecure = String(process.env.SMTP_SECURE || "false") === "true";
const smtpUser = process.env.SMTP_USER?.trim();
const smtpPass = process.env.SMTP_PASS?.replace(/\s/g, "");
const smtpTimeout = Number(process.env.SMTP_TIMEOUT_MS || 15000);
const fromAddress =
  process.env.SMTP_FROM ||
  (smtpUser ? `Silent Connection <${smtpUser}>` : "");

const hasMailConfig = Boolean(smtpHost && smtpPort && smtpUser && smtpPass);

const transporter = hasMailConfig
  ? nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      connectionTimeout: smtpTimeout,
      greetingTimeout: smtpTimeout,
      socketTimeout: smtpTimeout,
    })
  : null;

if (hasMailConfig) {
  console.log("SMTP email configured:", {
    from: fromAddress,
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
  });
}

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export async function sendVerificationEmail({ to, name, verificationCode }) {
  if (!hasMailConfig) {
    const error = new Error("Email sending is not configured");
    error.statusCode = 503;
    error.publicMessage =
      "Email sending is not configured. Add SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS to server/.env.";
    throw error;
  }

  const safeName = escapeHtml(name);
  const safeCode = escapeHtml(verificationCode);
  const recipient = String(to).trim();

  try {
    console.log("Sending verification email with SMTP", {
      to: recipient,
      from: fromAddress,
    });

    const info = await transporter.sendMail({
      from: fromAddress,
      to: recipient,
      subject: "Verify your Silent Connection email",
      text: `Hi ${name},\n\nUse this verification code to activate your Silent Connection account:\n${verificationCode}\n\nThis code expires in 15 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #241713;">
          <h2>Verify your email</h2>
          <p>Hi ${safeName},</p>
          <p>Use this code in the app to activate your Silent Connection account:</p>
          <p style="display: inline-block; margin: 8px 0 12px; padding: 14px 18px; background: #f7efe6; border: 1px solid #eadbd2; border-radius: 10px; font-size: 28px; font-weight: 700; letter-spacing: 6px;">
            ${safeCode}
          </p>
          <p>This code expires in 15 minutes.</p>
        </div>
      `,
    });

    console.log("SMTP verification email sent", {
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
    });
  } catch (error) {
    console.error("SMTP send error", {
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
    });
    error.statusCode = error.statusCode || 502;
    error.publicMessage =
      error.code === "ETIMEDOUT"
        ? "Could not connect to the SMTP server. Railway may be blocking outbound SMTP on this plan."
        : "Could not send the verification email. Check your SMTP email and app password.";
    throw error;
  }
}

export { hasMailConfig };
