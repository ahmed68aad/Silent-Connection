import nodemailer from "nodemailer";

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpSecure = String(process.env.SMTP_SECURE || "false") === "true";
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
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

  await transporter.sendMail({
    from: fromAddress,
    to,
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
}

export { hasMailConfig };
