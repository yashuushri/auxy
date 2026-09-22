import { NextRequest, NextResponse } from "next/server";

const DEFAULT_ADMIN_PASS = "admin";

function getAdminPassword(): string {
  return (
    process.env.ADMIN_PASSWORD?.trim() ||
    process.env.ADMIN_PASS?.trim() ||
    DEFAULT_ADMIN_PASS
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { password, action, token } = body;

    const expectedPass = getAdminPassword();

    if (action === "verify_token") {
      // Validate session token
      if (token && typeof token === "string" && token.startsWith("auxy_adm_")) {
        return NextResponse.json({ ok: true, authenticated: true });
      }
      return NextResponse.json({ ok: false, authenticated: false }, { status: 401 });
    }

    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { ok: false, error: "Password is required" },
        { status: 400 }
      );
    }

    if (password.trim() === expectedPass) {
      const sessionToken = `auxy_adm_${Buffer.from(`${Date.now()}_${expectedPass}`).toString("base64")}`;
      return NextResponse.json({
        ok: true,
        authenticated: true,
        token: sessionToken,
        message: "Admin authentication successful",
      });
    }

    return NextResponse.json(
      { ok: false, error: "Invalid administrative access key" },
      { status: 401 }
    );
  } catch (err: unknown) {
    console.error("[Admin Auth API] Error:", err);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
