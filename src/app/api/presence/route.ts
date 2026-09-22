import { NextRequest, NextResponse } from "next/server";
import { recordPresenceHeartbeat, getAllExploreUsersFromServerStore } from "@/lib/server-store";
import type { Background, Track } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      const text = await req.text();
      body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    }

    const username = typeof body.username === "string" ? body.username.trim() : "";
    if (!username) {
      return NextResponse.json({ error: "Username is required" }, { status: 400 });
    }

    recordPresenceHeartbeat({
      username,
      userId: typeof body.userId === "string" ? body.userId : undefined,
      displayName: typeof body.displayName === "string" ? body.displayName : undefined,
      avatar: typeof body.avatar === "string" ? body.avatar : undefined,
      bio: typeof body.bio === "string" ? body.bio : undefined,
      pronouns: typeof body.pronouns === "string" ? body.pronouns : undefined,
      background: body.background as Background | undefined,
      isPlaying: Boolean(body.isPlaying),
      currentTrack: (body.currentTrack as Track | null) || null,
      roomId: typeof body.roomId === "string" ? body.roomId : undefined,
      listenTogetherEnabled: body.listenTogetherEnabled !== false,
      isOffline: Boolean(body.isOffline),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Presence API] Error updating heartbeat:", err);
    return NextResponse.json({ error: "Failed to record presence" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const users = getAllExploreUsersFromServerStore();
    return NextResponse.json({ success: true, users });
  } catch (err) {
    console.error("[Presence API] Error fetching presence:", err);
    return NextResponse.json({ error: "Failed to fetch presence", users: [] }, { status: 500 });
  }
}
