import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAccount, getRoomProfile } from "@/lib/account-store";
import { readSession, SESSION_COOKIE } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const username = readSession(token);
  if (!username) {
    return NextResponse.json({ username: null });
  }

  const account = await getAccount(username);
  if (!account) {
    return NextResponse.json({ username: null });
  }

  return NextResponse.json({
    username: account.username,
    profile: await getRoomProfile(account.username),
  });
}
