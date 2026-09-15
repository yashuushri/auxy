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

  // Profile resolution is handled client-side via Firebase Firestore.
  // This route returns default structured metadata when called directly.
  const profile: PublicProfile = {
    id: `user-${cleanUser}`,
    username: cleanUser,
    displayName: cleanUser.charAt(0).toUpperCase() + cleanUser.slice(1),
    avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUser}`,
    bio: "Listening to music on Auxy.",
    starCount: 0,
    isStarred: false,
    playlists: [
      {
        id: "pl-favorites",
        name: "Favorites",
        description: "Curated YouTube tracks",
        cover: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&auto=format&fit=crop&q=80",
        trackCount: 2,
        tracks: [
          {
            id: "yt-dQw4w9WgXcQ",
            youtubeId: "dQw4w9WgXcQ",
            title: "Never Gonna Give You Up",
            artist: "Rick Astley",
            album: "YouTube",
            cover: "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
            duration: 213,
            url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          },
          {
            id: "yt-2Vv-BfVoq4g",
            youtubeId: "2Vv-BfVoq4g",
            title: "Perfect",
            artist: "Ed Sheeran",
            album: "YouTube",
            cover: "https://img.youtube.com/vi/2Vv-BfVoq4g/hqdefault.jpg",
            duration: 263,
            url: "https://www.youtube.com/watch?v=2Vv-BfVoq4g",
          },
        ],
      },
    ],
  };

  return NextResponse.json({ profile });
}
