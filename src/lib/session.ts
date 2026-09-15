import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export const SESSION_COOKIE = "mp_session";
const THIRTY_DAYS = 60 * 60 * 24 * 30;

type SessionPayload = {
  u: string;
  exp: number;
};

function secret() {
  return process.env.SESSION_SECRET || "mp-default-session-secret-key-438927498";
}

function sign(payload: SessionPayload) {
  const key = secret();
  if (!key) throw new Error("SESSION_SECRET is missing.");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = createHmac("sha256", key).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function readSession(token: string | undefined) {
  if (!token) return null;
  const key = secret();
  if (!key) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = createHmac("sha256", key).update(body).digest("base64url");
  const left = Buffer.from(expected);
  const right = Buffer.from(mac);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionPayload;
    if (!payload.u || payload.exp < Date.now()) return null;
    return payload.u;
  } catch {
    return null;
  }
}

function cookieOptions() {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.VERCEL === "1",
    path: "/",
    maxAge: THIRTY_DAYS,
  };
}

export function withSession(response: NextResponse, username: string) {
  const token = sign({ u: username, exp: Date.now() + THIRTY_DAYS * 1000 });
  response.cookies.set(SESSION_COOKIE, token, cookieOptions());
  return response;
}

export function clearSession(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
  return response;
}
