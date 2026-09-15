import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { applyAccountClean, getAccount, getRoomProfile, saveRoomProfile, type RoomProfile } from "@/lib/account-store";
import { readSession, SESSION_COOKIE } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function currentUsername() {
  await applyAccountClean();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const username = readSession(token);
  if (!username) return null;
  const account = await getAccount(username);
  return account?.username ?? null;
}

function isProfile(value: unknown): value is RoomProfile {
  if (!value || typeof value !== "object") return false;
  const profile = value as RoomProfile;
  return (
    typeof profile.displayName === "string" &&
    typeof profile.avatar === "string" &&
    typeof profile.volume === "number" &&
    typeof profile.createdAt === "number" &&
    Array.isArray(profile.playlists) &&
    Array.isArray(profile.library) &&
    Boolean(profile.background) &&
    typeof profile.background.kind === "string" &&
    typeof profile.background.value === "string"
  );
}

export async function GET() {
  const username = await currentUsername();
  if (!username) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const profile = await getRoomProfile(username);
  return NextResponse.json({ profile });
}

export async function PUT(request: Request) {
  const username = await currentUsername();
  if (!username) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: { profile?: unknown };
  try {
    body = (await request.json()) as { profile?: unknown };
  } catch {
    return NextResponse.json({ error: "Could not read that room." }, { status: 400 });
  }

  if (!isProfile(body.profile)) {
    return NextResponse.json({ error: "That room data is not valid." }, { status: 400 });
  }

  try {
    await saveRoomProfile(username, body.profile);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not save your room. Try again." }, { status: 500 });
  }
}
