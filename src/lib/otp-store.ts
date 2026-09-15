import crypto from "crypto";

export interface OtpRecord {
  email: string;
  username?: string;
  hashedOtp: string;
  expiresAt: number; // timestamp in ms (10 minutes)
  attempts: number; // max 5 attempts
  lastSentAt: number; // for 60s cooldown
  verified: boolean;
}

// Global in-memory cache surviving hot-reloads on Node server
const globalOtpStore = globalThis as unknown as {
  _auxy_otp_store?: Map<string, OtpRecord>;
};

if (!globalOtpStore._auxy_otp_store) {
  globalOtpStore._auxy_otp_store = new Map<string, OtpRecord>();
}

export const otpStore = globalOtpStore._auxy_otp_store;

export function generate4DigitOtp(): string {
  // Cryptographically secure 4-digit numeric code with leading zeros supported
  const buffer = crypto.randomBytes(2);
  const val = buffer.readUInt16BE(0) % 10000;
  return val.toString().padStart(4, "0");
}

export function hashOtp(otp: string): string {
  return crypto.createHash("sha256").update(otp.trim()).digest("hex");
}

export function validatePasswordStrength(password: string): { valid: boolean; reason?: string } {
  if (!password || password.length < 6) {
    return { valid: false, reason: "Password must be at least 6 characters long." };
  }
  return { valid: true };
}
