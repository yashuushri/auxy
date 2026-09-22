import { NextRequest, NextResponse } from "next/server";
import { toggleStarInSupabase, getStarStateFromSupabase } from "@/lib/supabase-db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const starredUserId = searchParams.get("starredUserId");
    const userId = searchParams.get("userId");

    if (!starredUserId) {
      return NextResponse.json({ error: "Missing starredUserId" }, { status: 400 });
    }

    const state = await getStarStateFromSupabase(userId, starredUserId);
    return NextResponse.json({ success: true, ...state });
  } catch (err) {
    console.error("Star fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch star state" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { starredUserId, userId } = body;

    if (!starredUserId) {
      return NextResponse.json({ error: "Missing starredUserId" }, { status: 400 });
    }

    if (!userId || userId === "anon") {
      return NextResponse.json({ error: "Must be signed in to star a user" }, { status: 401 });
    }

    const result = await toggleStarInSupabase(userId, starredUserId);
    return NextResponse.json({ success: true, starred: result.starred, count: result.count });
  } catch (err) {
    console.error("Star toggle error:", err);
    return NextResponse.json({ error: "Failed to update star" }, { status: 500 });
  }
}
