import { NextRequest, NextResponse } from "next/server";
import { otpStore, hashOtp } from "@/lib/otp-store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, otp } = body as {
      email?: string;
      otp?: string;
    };

    const cleanEmail = email?.trim().toLowerCase();
    const cleanOtp = otp?.trim();

    if (!cleanEmail || !cleanOtp) {
      return NextResponse.json(
        { ok: false, error: "Email and 4-digit code are required." },
        { status: 400 }
      );
    }

    if (!/^\d{4}$/.test(cleanOtp)) {
      return NextResponse.json(
        { ok: false, error: "Please enter a valid 4-digit numeric code." },
        { status: 400 }
      );
    }

    const record = otpStore.get(cleanEmail);
    if (!record) {
      return NextResponse.json(
        {
          ok: false,
          error: "No active verification code found. Please request a new code.",
        },
        { status: 400 }
      );
    }

    const now = Date.now();

    // Check expiry (10 minutes)
    if (now > record.expiresAt) {
      otpStore.delete(cleanEmail);
      return NextResponse.json(
        {
          ok: false,
          error: "Verification code has expired. Please request a new code.",
        },
        { status: 400 }
      );
    }

    // Check attempt limits (max 5)
    if (record.attempts >= 5) {
      otpStore.delete(cleanEmail);
      return NextResponse.json(
        {
          ok: false,
          error: "Too many incorrect attempts. This code has been invalidated. Please request a new one.",
        },
        { status: 429 }
      );
    }

    // Hash submitted OTP and verify
    const submittedHash = hashOtp(cleanOtp);
    if (submittedHash !== record.hashedOtp) {
      record.attempts += 1;
      const remainingAttempts = 5 - record.attempts;
      return NextResponse.json(
        {
          ok: false,
          error: `Incorrect verification code. ${remainingAttempts} attempt${remainingAttempts === 1 ? "" : "s"} remaining.`,
          remainingAttempts,
        },
        { status: 400 }
      );
    }

    // Successfully verified! Single-use: delete from store
    otpStore.delete(cleanEmail);

    return NextResponse.json({
      ok: true,
      verified: true,
      message: "Email verified successfully.",
    });
  } catch (error) {
    console.error("verify-otp error:", error);
    return NextResponse.json(
      { ok: false, error: "Internal verification error." },
      { status: 500 }
    );
  }
}
