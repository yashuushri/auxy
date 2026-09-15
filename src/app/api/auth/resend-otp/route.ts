import { NextRequest, NextResponse } from "next/server";
import { sendOtpEmailViaBrevo } from "@/lib/brevo";
import { otpStore, generate4DigitOtp, hashOtp } from "@/lib/otp-store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body as { email?: string };

    const cleanEmail = email?.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      return NextResponse.json(
        { ok: false, error: "Valid email address is required." },
        { status: 400 }
      );
    }

    const existing = otpStore.get(cleanEmail);
    const now = Date.now();

    // Enforce 60s cooldown
    if (existing && now - existing.lastSentAt < 60000) {
      const remainingSec = Math.ceil((60000 - (now - existing.lastSentAt)) / 1000);
      return NextResponse.json(
        {
          ok: false,
          error: `Please wait ${remainingSec}s before requesting a new code.`,
          cooldown: remainingSec,
        },
        { status: 429 }
      );
    }

    const username = existing?.username || "Listener";

    // Invalidate old OTP and generate fresh 4-digit code
    const otp = generate4DigitOtp();
    const hashedOtp = hashOtp(otp);

    otpStore.set(cleanEmail, {
      email: cleanEmail,
      username,
      hashedOtp,
      expiresAt: now + 10 * 60 * 1000, // 10 minutes
      attempts: 0,
      lastSentAt: now,
      verified: false,
    });

    const result = await sendOtpEmailViaBrevo({
      toEmail: cleanEmail,
      recipientName: username,
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
      message: "A new 4-digit verification code has been sent to your email.",
    });
  } catch (error) {
    console.error("resend-otp error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to resend verification code." },
      { status: 500 }
    );
  }
}
