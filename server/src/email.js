import nodemailer from "nodemailer";

function getTransporter() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
}

export async function sendApprovalEmail({ to, fullName }) {
  const transporter = getTransporter();
  if (!transporter) return; // email not configured — skip silently

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  await transporter.sendMail({
    from: `"BookingSolutions" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Your BookingSolutions account is ready!",
    text: `Hi ${fullName},\n\nGreat news! Your account request has been approved. You can now log in using your email and the password you set during registration.\n\nLogin here: ${frontendUrl}/login\n\nWelcome to the team!\nBookingSolutions`,
    html: `<p>Hi <strong>${fullName}</strong>,</p><p>Great news! Your account request has been approved. You can now log in using your email and the password you set during registration.</p><p><a href="${frontendUrl}/login">Log in now →</a></p><p>Welcome to the team!<br/>BookingSolutions</p>`,
  });
}
