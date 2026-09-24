import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getServerStore } from "@/lib/server-store";
import {
  cleanUsername,
  deleteSupabaseUserCompletely,
  isTableMissingError,
  isTableMarkedMissing,
  markTableMissing,
} from "@/lib/supabase-db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const authHeader =
      req.headers.get("authorization") || req.nextUrl.searchParams.get("token");
    if (!authHeader || !authHeader.includes("auxy_adm_")) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabase();
    const usersMap = new Map<string, Record<string, unknown>>();

    // 1. Authoritative: Fetch profiles from Supabase PostgreSQL
    if (supabase && !isTableMarkedMissing("profiles")) {
      try {
        const { data: profiles, error: pErr } = await supabase
          .from("profiles")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(1000);

        if (pErr) {
          if (isTableMissingError(pErr)) {
            markTableMissing("profiles");
          }
          console.warn("[Admin Users API] Error loading Supabase profiles:", pErr);
        } else if (Array.isArray(profiles)) {
          for (const p of profiles) {
            const clean = cleanUsername(p.username || p.id || "");
            if (!clean) continue;

            usersMap.set(clean, {
              id: p.id || `usr_${clean}`,
              username: p.username || clean,
              displayName: p.display_name || p.username || clean,
              email: `${clean}@auxy.app`,
              avatar:
                p.avatar ||
                `https://api.dicebear.com/7.x/bottts/svg?seed=${clean}`,
              bio: p.bio || "",
              pronouns: p.pronouns || "",
              starCount: 0,
              isOnline: false,
              isPlaying: false,
              currentTrack: null,
              roomId: `room_${clean}`,
              playlistsCount: 1,
              source: "supabase",
              createdAt: p.created_at ? new Date(p.created_at).getTime() : Date.now(),
              updatedAt: p.updated_at || p.created_at,
            });
          }
        }
      } catch (err) {
        console.warn("[Admin Users API] Supabase query exception:", err);
      }
    }

    // 2. Enrich with live rooms from Supabase listen_together_rooms
    if (supabase && !isTableMarkedMissing("listen_together_rooms")) {
      try {
        const { data: rooms } = await supabase
          .from("listen_together_rooms")
          .select("room_id, host_username, enabled, is_playing, current_track")
          .eq("enabled", true);

        if (Array.isArray(rooms)) {
          for (const r of rooms) {
            const hostClean = cleanUsername(String(r.host_username || ""));
            const existing = usersMap.get(hostClean);
            if (existing) {
              existing.isOnline = true;
              existing.isPlaying = Boolean(r.is_playing);
              existing.currentTrack = r.current_track || null;
              existing.roomId = r.room_id || `room_${hostClean}`;
            }
          }
        }
      } catch {}
    }

    // 3. Enrich with any live in-memory presence if active on this instance
    const store = getServerStore();
    for (const [clean, pres] of store.presence.entries()) {
      const existing = usersMap.get(clean);
      if (existing) {
        const isRecent = pres.isOnline && Date.now() - (pres.lastSeen || 0) < 65000;
        if (isRecent) {
          existing.isOnline = true;
          existing.isPlaying = Boolean(pres.isPlaying);
          if (pres.currentTrack) existing.currentTrack = pres.currentTrack;
        }
      }
    }

    // Sort: Online/Live first, then by username
    const usersList = Array.from(usersMap.values());
    usersList.sort((a, b) => {
      if (a.isOnline && !b.isOnline) return -1;
      if (!a.isOnline && b.isOnline) return 1;
      return String(a.username || "").localeCompare(String(b.username || ""));
    });

    return NextResponse.json({
      ok: true,
      users: usersList,
      totalCount: usersList.length,
    });
  } catch (err: unknown) {
    console.error("[Admin Users API] Error:", err);
    return NextResponse.json({ ok: false, users: [] }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Maintained for backward compatibility, returns the authoritative list
  return GET(req);
}

export async function DELETE(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.includes("auxy_adm_")) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const username = cleanUsername(searchParams.get("username") || "");

    if (!username) {
      return NextResponse.json({ ok: false, error: "Username is required" }, { status: 400 });
    }

    // 1. Authoritative: Delete user persistently from Supabase database
    const deletedInSupabase = await deleteSupabaseUserCompletely(username);
    if (!deletedInSupabase) {
      console.warn(`[Admin Users API] Supabase delete returned false for ${username}`);
    }

    // 2. Clean up local memory presence/rooms
    const store = getServerStore();
    store.users.delete(username);
    store.presence.delete(username);
    store.rooms.delete(`room_${username}`);
    store.liveRooms.delete(`room_${username}`);
    store.liveRooms.delete(username);

    return NextResponse.json({
      ok: true,
      message: `User @${username} removed successfully from Supabase and system.`,
    });
  } catch (err: unknown) {
    console.error("[Admin Users DELETE API] Error:", err);
    return NextResponse.json({ ok: false, error: "Failed to delete user" }, { status: 500 });
  }
}
