import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import type { Room } from "@/lib/types";

export async function GET() {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ rooms: [] });
    }

    const { data, error } = await supabase
      .from("listen_together_rooms")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error || !data) {
      return NextResponse.json({ rooms: [] });
    }

    const rooms: Room[] = data.map((d) => ({
      id: d.id,
      name: d.name || `${d.host_username}'s Room`,
      hostId: d.host_id,
      hostUsername: d.host_username,
      currentTrack: d.current_track,
      isPlaying: d.is_playing ?? false,
      position: d.position_seconds ?? 0,
      participantCount: d.participant_count ?? 1,
      createdAt: d.created_at ? new Date(d.created_at).getTime() : Date.now(),
      updatedAt: d.updated_at ? new Date(d.updated_at).getTime() : Date.now(),
      listenTogetherEnabled: d.listen_together_enabled ?? true,
      privacy: d.privacy || "public",
      autoAccept: d.auto_accept ?? true,
    }));

    return NextResponse.json({ success: true, rooms });
  } catch (err) {
    console.error("Failed to fetch rooms:", err);
    return NextResponse.json({ error: "Failed to fetch rooms", rooms: [] }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, host, initialTrack } = body;

    if (!host || !host.username) {
      return NextResponse.json({ error: "Host details required" }, { status: 400 });
    }

    const supabase = getSupabase();
    const roomId = `room-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = Date.now();

    const room: Room = {
      id: roomId,
      name: name?.trim() || `${host.displayName || host.username}'s Room`,
      hostId: host.id || host.username,
      hostUsername: host.username,
      currentTrack: initialTrack || null,
      isPlaying: false,
      position: 0,
      participantCount: 1,
      createdAt: now,
      updatedAt: now,
    };

    if (supabase) {
      try {
        await supabase.from("listen_together_rooms").upsert({
          id: roomId,
          host_id: host.id || host.username,
          host_username: host.username,
          name: room.name,
          current_track: initialTrack || null,
          is_playing: false,
          position_seconds: 0,
          participant_count: 1,
          listen_together_enabled: true,
          privacy: "public",
          auto_accept: true,
          updated_at: new Date(now).toISOString(),
        });
      } catch (upsertErr) {
        console.warn("[Rooms API] Could not persist room doc to Supabase:", upsertErr);
      }
    }

    return NextResponse.json({ success: true, room });
  } catch (err) {
    console.error("Failed to create room:", err);
    return NextResponse.json({ error: "Failed to create room" }, { status: 500 });
  }
}
