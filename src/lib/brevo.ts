/**
 * Brevo Transactional Email Service
 * Uses official Brevo SMTP endpoint: POST https://api.brevo.com/v3/smtp/email
 */

import { renderVerificationEmailHtml } from "@/lib/email-templates";

export interface SendOtpEmailParams {
  toEmail: string;
  recipientName?: string;
  otp: string;
}

export async function sendOtpEmailViaBrevo({
  toEmail,
  recipientName = "there",
  otp,
}: SendOtpEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.MAIL_FROM || "business.auxy@gmail.com";
  const senderName = process.env.MAIL_FROM_NAME || "Auxy Music";

  if (!apiKey) {
    console.error("Missing BREVO_API_KEY environment variable");
    return {
      success: false,
      error: "Email verification service is currently unconfigured. Please check environment variables.",
    };
  }

  const subject = "Your Auxy verification code";
  const textContent = `Hello ${recipientName || "there"},

Use the verification code below to complete your authentication on Auxy:

${otp}

This code expires in 10 minutes.

If you didn't request this code, you can safely ignore this email.

Thanks,
The Auxy Team`;

  const htmlContent = renderVerificationEmailHtml({
    otp,
    recipientName,
    expiresInMinutes: 10,
  });

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: senderName,
          email: senderEmail,
        },
        to: [
          {
            email: toEmail.trim(),
            name: recipientName,
          },
        ],
        subject,
        htmlContent,
        textContent,
      }),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      console.error("Brevo API error:", response.status, errJson);
      return {
        success: false,
        error: "Failed to send verification code. Please verify your email address and try again.",
      };
    }

    const data = (await response.json().catch(() => ({}))) as { messageId?: string };
    return { success: true, messageId: data.messageId };
  } catch (err) {
    console.error("Brevo request failed:", err);
    return {
      success: false,
      error: "Network error communicating with email provider. Please try again.",
    };
  }
}
