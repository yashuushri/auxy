/**
 * Generates a clean, professional, table-based light transactional email template
 * for Auxy account security / OTP verification.
 * 
 * Follows GitHub / Linear / Vercel / Stripe design standards:
 * - Table-based email client compatibility (Gmail, Outlook, Apple Mail, Chromium)
 * - Clean white card on subtle off-white canvas (#f8f9fa)
 * - Modern sans-serif typography with robust fallbacks
 * - Minimal, high-contrast bordered code box
 * - Clear, calm security messaging and professional footer
 * - Zero exposure of internal tokens, secrets, or IDs
 */

export interface RenderVerificationEmailOptions {
  otp: string;
  recipientName?: string;
  expiresInMinutes?: number;
}

export function renderVerificationEmailHtml({
  otp,
  recipientName = "there",
  expiresInMinutes = 10,
}: RenderVerificationEmailOptions): string {
  // Safe character spacing for the OTP digits
  const formattedOtp = otp
    .trim()
    .split("")
    .join("&nbsp;&nbsp;");

  const safeName = recipientName && recipientName.trim() ? recipientName.trim() : "there";

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>Your Auxy verification code</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; min-width: 100%; background-color: #f8f9fa; }
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; max-width: 100% !important; border-radius: 0 !important; border-left: none !important; border-right: none !important; }
      .content-padding { padding: 32px 20px !important; }
      .outer-wrapper { padding: 0 !important; }
      .otp-code { font-size: 32px !important; letter-spacing: 6px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f8f9fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #111827; -webkit-font-smoothing: antialiased;">
  <!-- Preheader text (Hidden in email body, visible in inbox list preview) -->
  <div style="display: none; font-size: 1px; color: #f8f9fa; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all;">
    Your Auxy verification code is ${otp}. Use this code to complete your verification.
    &#847; &zwnj; &nbsp; &#8199; &shy; &#847; &zwnj; &nbsp; &#8199; &shy; &#847; &zwnj; &nbsp; &#8199; &shy; &#847; &zwnj; &nbsp; &#8199; &shy;
  </div>

  <!-- Outer wrapper table -->
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" class="outer-wrapper" style="background-color: #f8f9fa; padding: 48px 16px 64px 16px;">
    <tr>
      <td align="center" valign="top">
        
        <!-- Main Card Container (560px max width) -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" class="email-container" style="max-width: 560px; width: 100%; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);">
          <tr>
            <td align="left" class="content-padding" style="padding: 40px 40px 36px 40px;">
              
              <!-- Brand Header / Wordmark -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 28px;">
                <tr>
                  <td align="left" valign="middle">
                    <table role="presentation" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td align="left" valign="middle" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 18px; font-weight: 700; letter-spacing: -0.4px; color: #000000; line-height: 1;">
                          Auxy
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Main Heading -->
              <h1 style="margin: 0 0 16px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 22px; font-weight: 600; line-height: 1.35; color: #111827; letter-spacing: -0.3px;">
                Verify your account
              </h1>

              <!-- Greeting & Introduction -->
              <p style="margin: 0 0 24px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #374151;">
                Hello ${safeName},<br />
                Use the verification code below to complete your authentication on Auxy.
              </p>

              <!-- Verification Code Container -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0;">
                <tr>
                  <td align="center" style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px 16px; text-align: center;">
                    
                    <!-- Formatted OTP -->
                    <div class="otp-code" style="font-family: 'SF Mono', SFMono-Regular, ui-monospace, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: 34px; font-weight: 700; line-height: 1; color: #111827; letter-spacing: 8px; margin-bottom: 10px; user-select: all; -webkit-user-select: all;">
                      ${formattedOtp}
                    </div>

                    <!-- Expiration Note -->
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; line-height: 1.4; color: #6b7280; font-weight: 400;">
                      This code expires in ${expiresInMinutes} minutes.
                    </div>

                  </td>
                </tr>
              </table>

              <!-- Security Notice -->
              <p style="margin: 0 0 28px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; line-height: 1.55; color: #6b7280;">
                If you didn't request this code, you can safely ignore this email. Someone may have typed your email address by mistake.
              </p>

              <!-- Subtle Divider -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="border-top: 1px solid #e5e7eb; height: 1px; font-size: 1px; line-height: 1px;">&nbsp;</td>
                </tr>
              </table>

              <!-- Sign-off -->
              <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #374151;">
                Thanks,<br />
                <strong style="font-weight: 600; color: #111827;">The Auxy Team</strong>
              </p>

            </td>
          </tr>
        </table>

        <!-- Muted Footer -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; margin-top: 24px;">
          <tr>
            <td align="center" style="padding: 0 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; line-height: 1.5; color: #9ca3af; text-align: center;">
              You're receiving this email because a verification code was requested for your Auxy account.
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}
