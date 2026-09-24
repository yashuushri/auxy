import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import {
  cleanUsername,
  syncUserProfileOnly,
  isTableMissingError,
  isTableMarkedMissing,
} from "@/lib/supabase-db";
import { DEFAULT_BACKGROUND } from "@/lib/backgrounds";
import type { Background, ExploreUser, Track } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabase();
    if (!supabase || isTableMarkedMissing("profiles")) {
      return NextResponse.json({ success: true, users: [] });
    }

    // 1. Fetch persistent profiles from Supabase
    const { data: profiles, error: pErr } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar, bio, pronouns, background_id, background_metadata, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(100);

    if (pErr) {
      if (!isTableMissingError(pErr)) {
        console.warn("[Explore API] Error fetching profiles:", pErr);
      }
      return NextResponse.json({ success: true, users: [] });
    }

    // 2. Fetch active rooms from Supabase
    const { data: roomsData } = await supabase
      .from("listen_together_rooms")
      .select("*")
      .eq("enabled", true);

    const activeRooms = new Map<string, Record<string, unknown>>();
    if (Array.isArray(roomsData)) {
      roomsData.forEach((r) => {
        const host = cleanUsername(String(r.host_username || r.host_id || ""));
        if (host) activeRooms.set(host, r);
      });
    }

    const users: ExploreUser[] = [];
    if (Array.isArray(profiles)) {
      for (const p of profiles) {
        if (!p || !p.username) continue;
        const uClean = cleanUsername(p.username);
        const activeRoom = activeRooms.get(uClean);
        const currentTrack = (activeRoom?.current_track as Track) || undefined;
        const bg = (p.background_metadata as Background) || {
          kind: "preset",
          value: p.background_id || "lava",
        };

        users.push({
          id: p.id || uClean,
          username: p.username,
          displayName: p.display_name || p.username,
          pronouns: p.pronouns || undefined,
          avatar:
            p.avatar ||
            `https://api.dicebear.com/7.x/bottts/svg?seed=${uClean}`,
          bio: p.bio || "",
          background: bg || DEFAULT_BACKGROUND,
          starCount: 0,
          isOnline: !!activeRoom,
          isLive: !!activeRoom,
          hasLiveRoom: !!activeRoom,
          isPlaying: activeRoom ? !!activeRoom.is_playing : false,
          currentTrack,
          roomId: activeRoom
            ? String(activeRoom.room_id || `room_${uClean}`)
            : `room_${uClean}`,
          listenTogetherEnabled: activeRoom
            ? activeRoom.enabled !== false
            : true,
          lastSeen: new Date(p.updated_at || p.created_at || Date.now()).getTime(),
        });
      }
    }

    // Sort: live rooms with tracks first, then recent
    users.sort((a, b) => {
      if (a.isPlaying && !b.isPlaying) return -1;
      if (!a.isPlaying && b.isPlaying) return 1;
      if (a.hasLiveRoom && !b.hasLiveRoom) return -1;
      if (!a.hasLiveRoom && b.hasLiveRoom) return 1;
      return (b.lastSeen || 0) - (a.lastSeen || 0);
    });

    return NextResponse.json({ success: true, users });
  } catch (err) {
    console.error("[Explore API] Error fetching explore users:", err);
    return NextResponse.json(
      { error: "Failed to fetch explore users", users: [] },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body && body.username) {
      await syncUserProfileOnly(body);
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Explore API] Error registering profile:", err);
    return NextResponse.json(
      { error: "Failed to update profile", success: false },
      { status: 500 }
    );
  }
}
