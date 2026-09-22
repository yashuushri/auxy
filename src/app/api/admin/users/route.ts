import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getSupabase } from "@/lib/supabase";
import { getServerStore, registerOrUpdateUserInServerStore } from "@/lib/server-store";
import { withTimeout } from "@/lib/utils";
import {
  isTableMarkedMissing,
  markTableMissing,
  isTableMissingError,
} from "@/lib/supabase-db";
import type { UserAccount } from "@/lib/types";

export const dynamic = "force-dynamic";

function collectAllUsers(): Record<string, unknown>[] {
  const store = getServerStore();
  const usersMap = new Map<string, Record<string, unknown>>();

  // 0. Ensure all users from persisted state are synced into store.users
  try {
    const filePath = path.join(process.cwd(), ".data", "server-state.json");
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.users)) {
        for (const u of parsed.users) {
          if (u && u.username) {
            const clean = String(u.username).trim().toLowerCase();
            if (clean && !store.users.has(clean)) {
              store.users.set(clean, u);
            }
          }
        }
      }
    }
  } catch {}

  // 1. Gather all users from server store accounts
  for (const [clean, u] of store.users.entries()) {
    if (!clean) continue;
    const presence = store.presence.get(clean);
    const room = store.rooms.get(`room_${clean}`) || store.rooms.get(presence?.roomId || "");
    const live = store.liveRooms.get(room?.id || `room_${clean}`) || store.liveRooms.get(clean);

    const hasLiveSession = Boolean(live && live.isPlaying && live.currentTrack);
    const isRecentlyActive = Boolean(presence?.isOnline && Date.now() - (presence.lastSeen || 0) < 65000);
    const isOnline = isRecentlyActive || hasLiveSession;
    const isPlaying = Boolean((presence?.isPlaying && isRecentlyActive) || hasLiveSession);

    usersMap.set(clean, {
      id: u.id || `usr_${clean}`,
      username: u.username || clean,
      displayName: u.displayName || u.username || clean,
      email: u.email || `${clean}@auxy.app`,
      avatar: u.avatar || presence?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${clean}`,
      bio: u.bio || presence?.bio || "",
      pronouns: u.pronouns || presence?.pronouns || "",
      starCount: presence?.starCount ?? 0,
      isOnline,
      isPlaying,
      currentTrack: presence?.currentTrack || live?.currentTrack || null,
      roomId: room?.id || presence?.roomId || `room_${clean}`,
      playlistsCount: u.playlists?.length ?? 1,
      createdAt: u.createdAt || Date.now(),
      source: "server_store",
    });
  }

  // 2. Gather any additional users from presence records
  for (const [clean, pres] of store.presence.entries()) {
    if (!clean) continue;
    const existing = usersMap.get(clean);
    const isRecentlyActive = Boolean(pres.isOnline && Date.now() - (pres.lastSeen || 0) < 65000);

    if (!existing) {
      usersMap.set(clean, {
        id: pres.id || `usr_${clean}`,
        username: pres.username || clean,
        displayName: pres.displayName || pres.username || clean,
        email: `${clean}@auxy.app`,
        avatar: pres.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${clean}`,
        bio: pres.bio || "",
        pronouns: pres.pronouns || "",
        starCount: pres.starCount ?? 0,
        isOnline: isRecentlyActive,
        isPlaying: Boolean(isRecentlyActive && pres.isPlaying),
        currentTrack: pres.currentTrack || null,
        roomId: pres.roomId || `room_${clean}`,
        playlistsCount: 1,
        createdAt: Date.now(),
        source: "presence",
      });
    } else {
      if (isRecentlyActive) {
        existing.isOnline = true;
        existing.isPlaying = Boolean(pres.isPlaying);
        existing.currentTrack = pres.currentTrack || existing.currentTrack || null;
      }
      if (pres.starCount) existing.starCount = pres.starCount;
    }
  }

  // 3. Gather any additional room hosts
  for (const room of store.rooms.values()) {
    const clean = (room.hostUsername || "").trim().toLowerCase();
    if (!clean) continue;
    if (!usersMap.has(clean)) {
      usersMap.set(clean, {
        id: room.hostId || `usr_${clean}`,
        username: clean,
        displayName: room.hostDisplayName || clean,
        email: `${clean}@auxy.app`,
        avatar: room.hostAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${clean}`,
        bio: "Live Community DJ",
        pronouns: "",
        starCount: 0,
        isOnline: true,
        isPlaying: Boolean(room.isPlaying),
        currentTrack: room.currentTrack || null,
        roomId: room.id,
        playlistsCount: 1,
        createdAt: room.createdAt || Date.now(),
        source: "room_host",
      });
    }
  }

  return Array.from(usersMap.values());
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") || req.nextUrl.searchParams.get("token");
    if (!authHeader || !authHeader.includes("auxy_adm_")) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const memoryUsers = collectAllUsers();
    const usersMap = new Map<string, Record<string, unknown>>();

    for (const u of memoryUsers) {
      const key = String(u.username || "").toLowerCase();
      if (key) usersMap.set(key, u);
    }

    // Fetch from Supabase PostgreSQL profiles ONLY if table is not marked missing
    const supabase = getSupabase();
    if (supabase && !isTableMarkedMissing("profiles")) {
      try {
        const remoteProfiles = await withTimeout(
          (async () => {
            const { data, error } = await supabase
              .from("profiles")
              .select("*")
              .limit(500);
            if (error) {
              if (isTableMissingError(error)) {
                markTableMissing("profiles");
              }
              return [];
            }
            return Array.isArray(data) ? data : [];
          })(),
          1500,
          []
        );

        for (const p of remoteProfiles) {
          const key = String(p.username || p.id || "").toLowerCase();
          if (!key) continue;
          const existing = usersMap.get(key) || {};
          usersMap.set(key, {
            ...existing,
            id: p.id || existing.id || key,
            username: p.username || key,
            displayName: p.display_name || existing.displayName || p.username || key,
            avatar: p.avatar || (existing.avatar as string) || `https://api.dicebear.com/7.x/bottts/svg?seed=${key}`,
            bio: p.bio || (existing.bio as string) || "",
            pronouns: p.pronouns || (existing.pronouns as string) || "",
            starCount: p.star_count ?? (existing.starCount as number) ?? 0,
            updatedAt: p.updated_at || p.created_at || existing.updatedAt,
            source: "supabase",
          });
        }
      } catch (err) {
        if (isTableMissingError(err)) {
          markTableMissing("profiles");
        }
        console.warn("[Admin Users API] Supabase profiles fetch skipped:", err);
      }
    }

    const usersList = Array.from(usersMap.values());
    // Sort: Online/Live first, then by username
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
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.includes("auxy_adm_")) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const clientUsers = Array.isArray(body.localUsers) ? (body.localUsers as UserAccount[]) : [];

    for (const u of clientUsers) {
      if (u && u.username) {
        registerOrUpdateUserInServerStore(u);
      }
    }

    const memoryUsers = collectAllUsers();
    return NextResponse.json({
      ok: true,
      users: memoryUsers,
      totalCount: memoryUsers.length,
    });
  } catch (err: unknown) {
    console.error("[Admin Users POST API] Error:", err);
    return NextResponse.json({ ok: false, users: [] }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.includes("auxy_adm_")) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const username = (searchParams.get("username") || "").trim().toLowerCase();

    if (!username) {
      return NextResponse.json({ ok: false, error: "Username is required" }, { status: 400 });
    }

    const store = getServerStore();
    store.users.delete(username);
    store.presence.delete(username);
    store.rooms.delete(`room_${username}`);
    store.liveRooms.delete(`room_${username}`);
    store.liveRooms.delete(username);

    // Also persist deletion
    try {
      const filePath = path.join(process.cwd(), ".data", "server-state.json");
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, "utf-8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.users)) {
          parsed.users = parsed.users.filter(
            (u: { username?: string }) => String(u.username || "").toLowerCase() !== username
          );
          fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2), "utf-8");
        }
      }
    } catch {}

    const memoryUsers = collectAllUsers();
    return NextResponse.json({
      ok: true,
      message: `User ${username} removed successfully`,
      users: memoryUsers,
      totalCount: memoryUsers.length,
    });
  } catch (err: unknown) {
    console.error("[Admin Users DELETE API] Error:", err);
    return NextResponse.json({ ok: false, error: "Failed to delete user" }, { status: 500 });
  }
}

