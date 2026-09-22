import { NextRequest, NextResponse } from "next/server";
import { sendOtpEmailViaBrevo } from "@/lib/brevo";
import {
  otpStore,
  generate4DigitOtp,
  hashOtp,
  validatePasswordStrength,
} from "@/lib/otp-store";
import {
  getUserByIdentifierFromServerStore,
  getUserByEmailFromServerStore,
  getUserFromServerStore,
} from "@/lib/server-store";

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

      const emailTaken = getUserByEmailFromServerStore(cleanEmail);
      if (emailTaken) {
        return NextResponse.json(
          { ok: false, error: "This email is already registered. Please sign in instead." },
          { status: 400 }
        );
      }

      const userTaken = getUserFromServerStore(cleanUsername);
      if (userTaken) {
        return NextResponse.json(
          { ok: false, error: "This username is already taken. Please choose another username." },
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

    // Login and Forgot-password validations: ensure account actually exists!
    let existingUser = null;
    if (mode === "login" || mode === "forgot") {
      existingUser = getUserByIdentifierFromServerStore(cleanEmail);
      if (!existingUser && cleanUsername) {
        existingUser = getUserByIdentifierFromServerStore(cleanUsername);
      }

      if (!existingUser) {
        return NextResponse.json(
          { ok: false, error: "No account found with this email or username. Please check your credentials or register." },
          { status: 404 }
        );
      }

      if (mode === "login" && password && existingUser.password && existingUser.password !== password) {
        return NextResponse.json(
          { ok: false, error: "Incorrect password. Please try again." },
          { status: 400 }
        );
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

    const targetUsername = existingUser?.username || cleanUsername || "user";

    // Save in OTP store (10 minute expiry, 0 attempts)
    otpStore.set(cleanEmail, {
      email: cleanEmail,
      username: targetUsername,
      hashedOtp,
      expiresAt: now + 10 * 60 * 1000, // 10 minutes
      attempts: 0,
      lastSentAt: now,
      verified: false,
    });

    // Send via Brevo Transactional Email
    let emailDelivered = false;
    try {
      const result = await sendOtpEmailViaBrevo({
        toEmail: cleanEmail,
        recipientName: existingUser?.displayName || targetUsername,
        otp,
      });
      emailDelivered = result.success;
      if (!result.success) {
        console.warn("Brevo email warning:", result.error);
      }
    } catch (deliveryError) {
      console.warn("Brevo email exception:", deliveryError);
    }

    return NextResponse.json({
      ok: true,
      message: emailDelivered
        ? "Verification code sent to your email."
        : "Verification code generated.",
      emailDelivered,
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
