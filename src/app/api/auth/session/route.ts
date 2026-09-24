import { NextRequest, NextResponse } from "next/server";
import {
  createAuthSessionToken,
  getAuthenticatedUsername,
} from "@/lib/auth-session";
import { cleanUsername } from "@/lib/supabase-db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const username = await getAuthenticatedUsername(req);
  return NextResponse.json({
    ok: true,
    authenticated: Boolean(username),
    username: username || null,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawUsername = typeof body.username === "string" ? body.username : "";
    const username = cleanUsername(rawUsername);

    if (!username) {
      return NextResponse.json(
        { ok: false, error: "Username is required" },
        { status: 400 }
      );
    }

    const token = createAuthSessionToken(username);

    const response = NextResponse.json({
      ok: true,
      username,
      token,
    });

    // Set secure cookie
    response.cookies.set({
      name: "auxy_session",
      value: token,
      httpOnly: false, // allow reading token by client if needed for Authorization header
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return response;
  } catch (err) {
    console.error("[Auth Session API] Error:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to create session" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: "auxy_session",
    value: "",
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
