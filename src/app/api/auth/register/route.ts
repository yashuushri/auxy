import { NextResponse } from "next/server";
import { createAccountRecord } from "@/lib/account-store";
import { withSession } from "@/lib/session";
import { isValidUsername } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { username?: string; password?: string; confirm?: string };
  try {
    body = (await request.json()) as { username?: string; password?: string; confirm?: string };
  } catch {
    return NextResponse.json({ error: "Could not read that form." }, { status: 400 });
  }

  const username = body.username?.trim() ?? "";
  const password = body.password ?? "";
  const confirm = body.confirm ?? "";

  if (!isValidUsername(username)) {
    return NextResponse.json(
      { error: "Username must be 3-20 letters, numbers, dots, or underscores." },
      { status: 400 }
    );
  }
  if (password.length < 4) {
    return NextResponse.json({ error: "Password must be at least 4 characters." }, { status: 400 });
  }
  if (password !== confirm) {
    return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
  }

  try {
    const account = await createAccountRecord(username, password);
    if (!account) {
      return NextResponse.json(
        { error: "That username is taken. Pick a different one." },
        { status: 409 }
      );
    }
    return withSession(NextResponse.json({ username: account.username }), account.username);
  } catch {
    return NextResponse.json({ error: "Could not create that account. Try again." }, { status: 500 });
  }
}
