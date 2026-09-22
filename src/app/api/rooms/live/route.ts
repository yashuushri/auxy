import { NextRequest, NextResponse } from "next/server";
import { getLiveRoomState, updateLiveRoomState } from "@/lib/server-store";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get("roomId");
    const hostUsername = searchParams.get("hostUsername");

    const target = roomId || hostUsername;
    if (!target) {
      return NextResponse.json({ error: "roomId or hostUsername required" }, { status: 400 });
    }

    const state = getLiveRoomState(target);
    if (!state) {
      return NextResponse.json({ success: false, room: null }, { status: 404 });
    }

    return NextResponse.json({ success: true, room: state });
  } catch (err) {
    console.error("[Live Room API] GET error:", err);
    return NextResponse.json({ error: "Failed to get live room state" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { roomId, hostUsername, currentTrack, isPlaying, positionSeconds, playlistTracks, playlistName, playlistId, background } = body;

    if (!roomId || !hostUsername) {
      return NextResponse.json({ error: "roomId and hostUsername required" }, { status: 400 });
    }

    const updated = updateLiveRoomState({
      roomId,
      hostUsername,
      currentTrack,
      isPlaying: typeof isPlaying === "boolean" ? isPlaying : undefined,
      positionSeconds: typeof positionSeconds === "number" ? positionSeconds : undefined,
      playlistTracks: Array.isArray(playlistTracks) ? playlistTracks : undefined,
      playlistName,
      playlistId,
      background,
    });

    return NextResponse.json({ success: true, room: updated });
  } catch (err) {
    console.error("[Live Room API] POST error:", err);
    return NextResponse.json({ error: "Failed to update live room state" }, { status: 500 });
  }
}
