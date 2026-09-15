import { NextResponse } from "next/server";
import { getAccount, getRoomProfile, passwordsMatch } from "@/lib/account-store";
import { withSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { username?: string; password?: string };
  try {
    body = (await request.json()) as { username?: string; password?: string };
  } catch {
    return NextResponse.json({ error: "Could not read that form." }, { status: 400 });
  }

  const username = body.username?.trim() ?? "";
  const password = body.password ?? "";
  if (!username || !password) {
    return NextResponse.json({ error: "Enter a username and password." }, { status: 400 });
  }

  try {
    const account = await getAccount(username);
    if (!account) {
      return NextResponse.json({ error: "No account with that username." }, { status: 401 });
    }
    if (!passwordsMatch(password, account)) {
      return NextResponse.json({ error: "Wrong password." }, { status: 401 });
    }
    return withSession(
      NextResponse.json({
        username: account.username,
        profile: await getRoomProfile(account.username),
      }),
      account.username
    );
  } catch {
    return NextResponse.json({ error: "Could not sign in. Try again." }, { status: 500 });
  }
}
