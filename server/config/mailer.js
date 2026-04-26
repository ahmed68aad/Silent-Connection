import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const fromAddress =
  process.env.RESEND_FROM ||
  "Silent Connection <no-reply@silentconnection.app>";

const hasMailConfig = Boolean(resendApiKey && fromAddress);

const resend = hasMailConfig ? new Resend(resendApiKey) : null;

if (hasMailConfig) {
  console.log("Resend email configured:", {
    from: fromAddress,
    provider: "Resend",
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
      "Email sending is not configured. Add RESEND_API_KEY and RESEND_FROM to server/.env.";
    throw error;
  }

  const safeName = escapeHtml(name);
  const safeCode = escapeHtml(verificationCode);

  await resend.emails.send({
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
