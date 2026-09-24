import { NextRequest, NextResponse } from "next/server";
import {
  getAllExploreUsersFromServerStore,
  registerOrUpdateUserInServerStore,
} from "@/lib/server-store";
import {
  fetchExploreUsersFromSupabase,
  normalizeAndSyncUserProfileToSupabase,
} from "@/lib/supabase-db";

export async function GET() {
  try {
    const remoteUsers = await fetchExploreUsersFromSupabase();
    const localUsers = getAllExploreUsersFromServerStore();

    const map = new Map<string, typeof remoteUsers[0]>();
    for (const u of remoteUsers) {
      if (u && u.username) {
        map.set(u.username.toLowerCase(), u);
      }
    }
    for (const u of localUsers) {
      if (u && u.username && !map.has(u.username.toLowerCase())) {
        map.set(u.username.toLowerCase(), u as unknown as typeof remoteUsers[0]);
      }
    }

    return NextResponse.json({ success: true, users: Array.from(map.values()) });
  } catch (err) {
    console.error("[Explore API] Error fetching explore users:", err);
    return NextResponse.json({ error: "Failed to fetch explore users", users: [] }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body && body.username) {
      registerOrUpdateUserInServerStore(body);
      try {
        await normalizeAndSyncUserProfileToSupabase(body, true);
      } catch {}
    }
    const users = getAllExploreUsersFromServerStore();
    return NextResponse.json({ success: true, users });
  } catch (err) {
    console.error("[Explore API] Error registering explore user:", err);
    return NextResponse.json({ error: "Failed to update explore user" }, { status: 500 });
  }
}
