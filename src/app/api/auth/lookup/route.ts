import { NextRequest, NextResponse } from "next/server";
import { getUserByIdentifierFromServerStore } from "@/lib/server-store";
import { fetchUserProfileFromSupabase } from "@/lib/supabase-db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { identifier, password } = body as {
      identifier?: string;
      password?: string;
    };

    const cleanIdentifier = identifier?.trim();
    if (!cleanIdentifier) {
      return NextResponse.json(
        { ok: false, found: false, error: "Username or email is required." },
        { status: 400 }
      );
    }

    // 1. Search in persistent server store (in-memory + .data/server-state.json)
    let user = getUserByIdentifierFromServerStore(cleanIdentifier);

    // 2. Fallback check in Supabase if not found
    if (!user) {
      try {
        const remote = await fetchUserProfileFromSupabase(cleanIdentifier);
        if (remote) {
          user = remote;
        }
      } catch {
        // Ignore Supabase error if not configured
      }
    }

    if (!user) {
      return NextResponse.json({
        ok: true,
        found: false,
        error: "No account found with this username or email.",
      });
    }

    // 3. If password was provided and user has a password, check it
    if (password && user.password && user.password !== password) {
      return NextResponse.json({
        ok: true,
        found: true,
        passwordMatch: false,
        error: "Incorrect password. Please try again.",
      });
    }

    return NextResponse.json({
      ok: true,
      found: true,
      passwordMatch: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName || user.username,
        email: user.email,
        emailVerified: user.emailVerified ?? true,
        avatar: user.avatar,
        bio: user.bio || "",
        pronouns: user.pronouns || "",
        background: user.background,
        volume: user.volume ?? 80,
        playlists: user.playlists || [],
        library: user.library || [],
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error("[Auth Lookup API] Error:", err);
    return NextResponse.json(
      { ok: false, found: false, error: "Failed to lookup account." },
      { status: 500 }
    );
  }
}
