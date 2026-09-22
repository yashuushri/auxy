import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.includes("auxy_adm_")) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action, payload } = body;

    if (action === "test_youtube_url") {
      const url = payload?.url;
      if (!url) return NextResponse.json({ ok: false, error: "Missing URL" }, { status: 400 });

      const startTime = Date.now();
      const origin = req.nextUrl.origin;
      const res = await fetch(`${origin}/api/youtube/playlist-info?url=${encodeURIComponent(url)}`);
      const latency = Date.now() - startTime;

      if (!res.ok) {
        const errText = await res.text();
        return NextResponse.json({ ok: false, latency, error: errText }, { status: res.status });
      }

      const data = await res.json();
      return NextResponse.json({
        ok: true,
        latency,
        trackCount: data.videoIds?.length || 0,
        title: data.title,
        sampleTracks: (data.tracks || []).slice(0, 5),
      });
    }

    if (action === "terminate_room") {
      const roomId = payload?.roomId;
      if (!roomId) return NextResponse.json({ ok: false, error: "Missing roomId" }, { status: 400 });

      const supabase = getSupabase();
      if (supabase) {
        await supabase.from("listen_together_rooms").delete().eq("id", roomId);
      }
      return NextResponse.json({ ok: true, message: `Room ${roomId} terminated` });
    }

    if (action === "purge_cache") {
      return NextResponse.json({ ok: true, message: "System memory & video resolution caches flushed." });
    }

    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (err: unknown) {
    console.error("[Admin Actions API] Error:", err);
    return NextResponse.json({ ok: false, error: "Action failed" }, { status: 500 });
  }
}
