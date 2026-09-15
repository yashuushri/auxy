import { NextRequest, NextResponse } from "next/server";
import type { PublicProfile } from "@/lib/types";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  if (!username) {
    return NextResponse.json({ error: "Username is required" }, { status: 400 });
  }

  const cleanUser = username.trim().toLowerCase();

  // Profile metadata fallback when client-side Firestore is warming up
  const profile: PublicProfile = {
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

  return NextResponse.json({ profile });
}
