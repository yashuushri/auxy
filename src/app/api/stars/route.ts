import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { starredUserId, userId } = await req.json();

    if (!starredUserId) {
      return NextResponse.json({ error: "Missing starredUserId" }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: "Must be signed in to star a user" }, { status: 401 });
    }

    // Direct stars state toggle
    return NextResponse.json({ success: true, starred: true });
  } catch (err) {
    console.error("Star error:", err);
    return NextResponse.json({ error: "Failed to update star" }, { status: 500 });
  }
}
