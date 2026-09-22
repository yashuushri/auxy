import { NextRequest, NextResponse } from "next/server";
import { fetchPublicProfileFromSupabase } from "@/lib/supabase-db";
import { getPublicProfileFromServerStore } from "@/lib/server-store";
import type { PublicProfile } from "@/lib/types";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    if (!username) {
      return NextResponse.json({ error: "Username is required" }, { status: 400 });
    }

    const cleanUser = username.trim().toLowerCase();

    // 1. Attempt to fetch public profile from Supabase PostgreSQL
    const supabaseProfile = await fetchPublicProfileFromSupabase(cleanUser);
    if (supabaseProfile) {
      return NextResponse.json({ success: true, profile: supabaseProfile });
    }

    // 2. Check server-side store
    const serverStoreProfile = getPublicProfileFromServerStore(cleanUser);
    if (serverStoreProfile) {
      return NextResponse.json({ success: true, profile: serverStoreProfile });
    }

    // 3. Profile metadata fallback when user is freshly registered or warming up
    const fallbackProfile: PublicProfile = {
      id: `user-${cleanUser}`,
      username: cleanUser,
      displayName: cleanUser,
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUser}`,
      bio: "",
      background: { kind: "preset", value: "lava" },
      starCount: 0,
      isStarred: false,
      playlists: [],
    };

    return NextResponse.json({ success: true, profile: fallbackProfile });
  } catch (err) {
    console.error("Profile route error:", err);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}
