/**
 * Brevo Transactional Email Service
 * Uses official Brevo SMTP endpoint: POST https://api.brevo.com/v3/smtp/email
 */

export interface SendOtpEmailParams {
  toEmail: string;
  recipientName?: string;
  otp: string;
}

export async function sendOtpEmailViaBrevo({
  toEmail,
  recipientName = "Listener",
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

  const subject = "Your verification code";
  const textContent = `Your verification code is ${otp}. This code expires in 10 minutes. If you did not request this code, you can safely ignore this email.`;

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your verification code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0b0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0b0b0f; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 480px; background-color: #14141a; border: 1px solid #27272a; border-radius: 16px; padding: 36px 32px; box-shadow: 0 20px 40px rgba(0,0,0,0.6);" cellspacing="0" cellpadding="0">
          <tr>
            <td align="left">
              <!-- Brand Header -->
              <div style="font-size: 20px; font-weight: 700; letter-spacing: -0.5px; color: #ffffff; margin-bottom: 24px;">
                Auxy
              </div>

              <h1 style="font-size: 22px; font-weight: 700; color: #ffffff; margin: 0 0 12px 0; line-height: 1.3;">
                Verify your account
              </h1>
              
              <p style="font-size: 14px; color: #a1a1aa; line-height: 1.6; margin: 0 0 28px 0;">
                Hello ${recipientName},<br>
                Use the following 4-digit verification code to complete your authentication on Auxy.
              </p>

              <!-- 4-Digit OTP Display -->
              <div style="background-color: #1c1c24; border: 1px solid #3f3f46; border-radius: 12px; padding: 24px; text-align: center; margin: 0 0 28px 0;">
                <span style="font-size: 38px; font-weight: 800; letter-spacing: 12px; color: #ffffff; font-family: monospace; display: inline-block; padding-left: 12px;">
                  ${otp}
                </span>
                <div style="font-size: 12px; color: #71717a; margin-top: 10px;">
                  This code expires in <strong>10 minutes</strong>
                </div>
              </div>

              <!-- Security Notice -->
              <p style="font-size: 12px; color: #71717a; line-height: 1.5; margin: 0 0 24px 0;">
                ⚠️ <strong>Never share this code with anyone.</strong> Auxy will never ask you for your verification code.
              </p>

              <hr style="border: none; border-top: 1px solid #27272a; margin: 24px 0;">

              <!-- Footer -->
              <p style="font-size: 11px; color: #52525b; line-height: 1.5; margin: 0;">
                If you did not request this verification code, you can safely ignore this email. Someone may have entered your email address by mistake.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

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
