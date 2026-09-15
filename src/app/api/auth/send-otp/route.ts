import { NextRequest, NextResponse } from "next/server";
import { sendOtpEmailViaBrevo } from "@/lib/brevo";
import {
  otpStore,
  generate4DigitOtp,
  hashOtp,
  validatePasswordStrength,
} from "@/lib/otp-store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, username, mode, password } = body as {
      email?: string;
      username?: string;
      mode?: "register" | "login" | "forgot";
      password?: string;
    };

    const cleanEmail = email?.trim().toLowerCase();
    const cleanUsername = username?.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes("@")) {
      return NextResponse.json(
        { ok: false, error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    // Registration specific validations
    if (mode === "register") {
      if (!cleanUsername) {
        return NextResponse.json(
          { ok: false, error: "Please enter a username." },
          { status: 400 }
        );
      }

      if (cleanUsername.length < 2 || cleanUsername.length > 32) {
        return NextResponse.json(
          { ok: false, error: "Username must be between 2 and 32 characters." },
          { status: 400 }
        );
      }

      // Validate password strength: reject 12345678, counting, repetitive, easy passwords
      if (password) {
        const passCheck = validatePasswordStrength(password);
        if (!passCheck.valid) {
          return NextResponse.json(
            { ok: false, error: passCheck.reason },
            { status: 400 }
          );
        }
      }
    }

    // Check rate limit & 60-second cooldown
    const existing = otpStore.get(cleanEmail);
    const now = Date.now();
    if (existing && now - existing.lastSentAt < 60000) {
      const remainingSec = Math.ceil((60000 - (now - existing.lastSentAt)) / 1000);
      return NextResponse.json(
        {
          ok: false,
          error: `Please wait ${remainingSec}s before requesting a new verification code.`,
          cooldown: remainingSec,
        },
        { status: 429 }
      );
    }

    // Generate cryptographically secure 4-digit OTP
    const otp = generate4DigitOtp();
    const hashedOtp = hashOtp(otp);

    // Save in OTP store (10 minute expiry, 0 attempts)
    otpStore.set(cleanEmail, {
      email: cleanEmail,
      username: cleanUsername,
      hashedOtp,
      expiresAt: now + 10 * 60 * 1000, // 10 minutes
      attempts: 0,
      lastSentAt: now,
      verified: false,
    });

    // Send via Brevo Transactional Email
    const result = await sendOtpEmailViaBrevo({
      toEmail: cleanEmail,
      recipientName: cleanUsername || "Listener",
      otp,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error || "Failed to deliver email. Please try again.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Verification code sent to your email.",
      expiresInMinutes: 10,
    });
  } catch (error) {
    console.error("send-otp error:", error);
    return NextResponse.json(
      { ok: false, error: "Internal error processing verification request." },
      { status: 500 }
    );
  }
}
