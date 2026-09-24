import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getSupabaseFriendshipStatus, cleanUsername, logSupabaseDiagnostic } from "@/lib/supabase-db";
import type { RoomRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get("roomId");
    const requestId = searchParams.get("requestId");
    const checkRoom = searchParams.get("checkRoom");
    const supabase = getSupabase(true);

    if (requestId) {
      if (supabase) {
        const { data: r } = await supabase
          .from("listen_together_requests")
          .select("*")
          .eq("id", requestId)
          .maybeSingle();

        if (r) {
          const reqItem: RoomRequest = {
            id: r.id,
            roomId: r.room_id,
            userId: r.user_id || r.requester_id || r.username,
            username: r.username || r.requester_username || r.user_id,
            displayName: r.display_name || r.requester_display_name || r.username,
            avatar: r.avatar || r.requester_avatar || "",
            status: (r.status === "rejected" ? "declined" : r.status) as "pending" | "accepted" | "declined",
            createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
          };
          return NextResponse.json({ success: true, request: reqItem });
        }
      }
      return NextResponse.json({ success: true, request: null });
    }

    if (roomId) {
      if (supabase) {
        const { data: rows, error: rErr } = await supabase
          .from("listen_together_requests")
          .select("*")
          .eq("room_id", roomId)
          .order("created_at", { ascending: false });

        if (rErr) {
          logSupabaseDiagnostic("api/requests:GET:roomId", "listen_together_requests", "select", rErr);
        }

        const requests: RoomRequest[] = (rows || []).map((r) => ({
          id: r.id,
          roomId: r.room_id,
          userId: r.user_id || r.requester_id || r.username,
          username: r.username || r.requester_username || r.user_id,
          displayName: r.display_name || r.requester_display_name || r.username,
          avatar: r.avatar || r.requester_avatar || "",
          status: (r.status === "rejected" ? "declined" : r.status) as "pending" | "accepted" | "declined",
          createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
        }));
        return NextResponse.json({ success: true, requests });
      }
      return NextResponse.json({ success: true, requests: [] });
    }

    if (checkRoom) {
      if (supabase) {
        const cleanHost = cleanUsername(checkRoom.replace(/^room_/, ""));
        const { data: room } = await supabase
          .from("listen_together_rooms")
          .select("enabled, privacy, auto_accept")
          .or(`room_id.eq.${checkRoom},host_username.eq.${cleanHost}`)
          .maybeSingle();

        const settings = {
          enabled: room ? room.enabled !== false : true,
          privacy: (room?.privacy as "public" | "friends") || "public",
          autoAccept: room ? room.auto_accept !== false : true,
        };
        return NextResponse.json({ success: true, settings });
      }
      return NextResponse.json({
        success: true,
        settings: { enabled: true, privacy: "public", autoAccept: true },
      });
    }

    return NextResponse.json({ success: true, requests: [] });
  } catch (err) {
    console.error("[Requests API] GET error:", err);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      const text = await req.text();
      body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    }

    const action = typeof body.action === "string" ? body.action : "create";
    const supabase = getSupabase(true);

    if (action === "settings") {
      const roomId = typeof body.roomId === "string" ? body.roomId.trim() : "";
      const settings = (body.settings as Record<string, unknown>) || {};
      if (roomId && supabase) {
        const cleanHost = cleanUsername(roomId.replace(/^room_/, ""));
        const updatePayload: Record<string, unknown> = {
          room_id: roomId,
          host_id: cleanHost,
          host_username: cleanHost,
          updated_at: new Date().toISOString(),
        };
        if (settings.enabled !== undefined) updatePayload.enabled = Boolean(settings.enabled);
        if (settings.privacy !== undefined) updatePayload.privacy = settings.privacy;
        if (settings.autoAccept !== undefined) updatePayload.auto_accept = Boolean(settings.autoAccept);

        const { error: sErr } = await supabase
          .from("listen_together_rooms")
          .upsert(updatePayload, { onConflict: "room_id" });

        if (sErr) {
          logSupabaseDiagnostic("api/requests:POST:settings", "listen_together_rooms", "upsert", sErr);
        }
      }
      return NextResponse.json({ success: true });
    }

    if (action === "cancel") {
      const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
      if (requestId && supabase) {
        const { error: cErr } = await supabase
          .from("listen_together_requests")
          .delete()
          .eq("id", requestId);
        if (cErr) {
          logSupabaseDiagnostic("api/requests:POST:cancel", "listen_together_requests", "delete", cErr);
        }
      }
      return NextResponse.json({ success: true });
    }

    if (action === "respond") {
      const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
      const status = body.status === "declined" ? "declined" : "accepted";
      if (requestId && supabase) {
        const { error: respErr } = await supabase
          .from("listen_together_requests")
          .update({
            status,
            updated_at: new Date().toISOString(),
          })
          .eq("id", requestId);
        if (respErr) {
          logSupabaseDiagnostic("api/requests:POST:respond", "listen_together_requests", "update", respErr);
        }
      }
      return NextResponse.json({ success: true });
    }

    // Default: action === "create"
    const roomId = typeof body.roomId === "string" ? body.roomId.trim() : "";
    const user = (body.user as Record<string, unknown>) || {};
    const username = cleanUsername(typeof user.username === "string" ? user.username : "");

    if (!roomId || !username) {
      return NextResponse.json({ error: "Room ID and username are required" }, { status: 400 });
    }

    if (supabase) {
      const cleanHost = cleanUsername(roomId.replace(/^room_/, ""));
      const { data: roomData } = await supabase
        .from("listen_together_rooms")
        .select("enabled, privacy, auto_accept")
        .or(`room_id.eq.${roomId},host_username.eq.${cleanHost}`)
        .maybeSingle();

      if (roomData) {
        if (roomData.enabled === false) {
          return NextResponse.json({ status: "disabled", roomId });
        }

        if (roomData.privacy === "friends") {
          const friendStatus = await getSupabaseFriendshipStatus(cleanHost, username);
          if (friendStatus !== "friends") {
            return NextResponse.json(
              {
                error: "This room is Friends Only. You must be mutual friends with the host to join.",
                privacyBlocked: true,
              },
              { status: 403 }
            );
          }
        }

        if (roomData.auto_accept === true) {
          return NextResponse.json({ status: "auto_accepted", roomId });
        }
      }
    }

    // Room requires host manual approval
    const reqId =
      typeof body.requestId === "string" && body.requestId
        ? body.requestId
        : `req_${username}_${Date.now()}`;

    if (supabase) {
      const uId = String(user.id || username);
      const dName = String(user.displayName || username);
      const av = String(user.avatar || "");
      const now = new Date().toISOString();

      // Adaptive insert: populates standard columns, with fallback
      const { error: insErr } = await supabase.from("listen_together_requests").upsert(
        {
          id: reqId,
          room_id: roomId,
          user_id: uId,
          username,
          display_name: dName,
          avatar: av,
          status: "pending",
          created_at: now,
          updated_at: now,
        },
        { onConflict: "id" }
      );

      if (insErr && (insErr.code === "42703" || insErr.message?.includes("column"))) {
        // Fallback schema with requester_id
        await supabase.from("listen_together_requests").upsert(
          {
            id: reqId,
            room_id: roomId,
            requester_id: uId,
            requester_username: username,
            requester_display_name: dName,
            requester_avatar: av,
            status: "pending",
            created_at: now,
            updated_at: now,
          },
          { onConflict: "id" }
        );
      }
    }

    return NextResponse.json({
      status: "pending",
      requestId: reqId,
      roomId,
    });
  } catch (err) {
    console.error("[Requests API] POST error:", err);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}

