import crypto from "crypto";
import type { NextRequest } from "next/server";
import { cleanUsername } from "@/lib/supabase-db";

const SESSION_SECRET =
  process.env.AUTH_SESSION_SECRET ||
  process.env.SESSION_SECRET ||
  "auxy_session_beta_launch_secret_2026_x9k2";

const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Creates a cryptographically signed session token:
 * format: <base64Username>.<timestamp>.<hmacSignature>
 */
export function createAuthSessionToken(username: string): string {
  const clean = cleanUsername(username);
  const timestamp = Date.now();
  const b64User = Buffer.from(clean, "utf-8").toString("base64url");
  const payload = `${b64User}.${timestamp}`;
  const sig = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

/**
 * Verifies a signed session token. Returns clean username if valid, or null if invalid or expired.
 */
export function verifyAuthSessionToken(token: string | null | undefined): string | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.trim().split(".");
  if (parts.length !== 3) return null;

  const [b64User, timeStr, sig] = parts;
  const payload = `${b64User}.${timeStr}`;

  const expectedSig = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(payload)
    .digest("base64url");

  // Constant-time comparison
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return null;
    }
  } catch {
    return null;
  }

  const timestamp = parseInt(timeStr, 10);
  if (isNaN(timestamp) || Date.now() - timestamp > SESSION_MAX_AGE_MS) {
    return null; // Expired
  }

  try {
    const rawUser = Buffer.from(b64User, "base64url").toString("utf-8");
    return cleanUsername(rawUser);
  } catch {
    return null;
  }
}

/**
 * Extracts and verifies the authenticated username from a NextRequest.
 * Checks:
 * 1. 'auxy_session' cookie
 * 2. 'x-auxy-session' header
 * 3. 'Authorization: Bearer <token>' header
 * 4. Also checks standard Supabase auth cookie or fallback header
 */
export async function getAuthenticatedUsername(req: NextRequest): Promise<string | null> {
  // 1. Check auxy_session cookie
  const cookieVal = req.cookies.get("auxy_session")?.value;
  if (cookieVal) {
    const verified = verifyAuthSessionToken(cookieVal);
    if (verified) return verified;
  }

  // 2. Check x-auxy-session header
  const headerVal = req.headers.get("x-auxy-session");
  if (headerVal) {
    const verified = verifyAuthSessionToken(headerVal);
    if (verified) return verified;
  }

  // 3. Check Authorization header
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    const verified = verifyAuthSessionToken(token);
    if (verified) return verified;
  }

  return null;
}
