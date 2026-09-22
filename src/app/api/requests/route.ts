import { NextRequest, NextResponse } from "next/server";
import {
  saveRoomRequest,
  getRoomRequests,
  getSingleRoomRequest,
  updateRoomRequestStatus,
  deleteRoomRequest,
  getServerRoomSettings,
  updateServerRoomSettings,
  getFriendshipStatus,
} from "@/lib/server-store";
import type { RoomRequest } from "@/lib/types";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get("roomId");
    const requestId = searchParams.get("requestId");
    const checkRoom = searchParams.get("checkRoom");

    if (requestId) {
      const request = getSingleRoomRequest(requestId);
      return NextResponse.json({ success: true, request });
    }

    if (roomId) {
      const requests = getRoomRequests(roomId);
      return NextResponse.json({ success: true, requests });
    }

    if (checkRoom) {
      const settings = getServerRoomSettings(checkRoom);
      return NextResponse.json({ success: true, settings });
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

    if (action === "settings") {
      const roomId = typeof body.roomId === "string" ? body.roomId.trim() : "";
      const settings = (body.settings as Record<string, unknown>) || {};
      if (roomId) {
        updateServerRoomSettings(roomId, {
          enabled: settings.enabled !== undefined ? Boolean(settings.enabled) : undefined,
          privacy: (settings.privacy as "public" | "friends") || undefined,
          autoAccept: settings.autoAccept !== undefined ? Boolean(settings.autoAccept) : undefined,
        });
      }
      return NextResponse.json({ success: true });
    }

    if (action === "cancel") {
      const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
      if (requestId) {
        deleteRoomRequest(requestId);
      }
      return NextResponse.json({ success: true });
    }

    if (action === "respond") {
      const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
      const status = body.status === "declined" ? "declined" : "accepted";
      if (requestId) {
        updateRoomRequestStatus(requestId, status);
      }
      return NextResponse.json({ success: true });
    }

    // Default: action === "create"
    const roomId = typeof body.roomId === "string" ? body.roomId.trim() : "";
    const user = (body.user as Record<string, unknown>) || {};
    const username = typeof user.username === "string" ? user.username.trim() : "";

    if (!roomId || !username) {
      return NextResponse.json({ error: "Room ID and username are required" }, { status: 400 });
    }

    const settings = getServerRoomSettings(roomId);
    if (settings.enabled === false) {
      return NextResponse.json({ status: "disabled", roomId });
    }

    if (settings.privacy === "friends") {
      const hostUsername = roomId.replace(/^room_/, "").trim().toLowerCase();
      const status = getFriendshipStatus(hostUsername, username);
      if (status !== "friends") {
        return NextResponse.json(
          {
            error: "This room is Friends Only. You must be mutual friends with the host to join.",
            privacyBlocked: true,
          },
          { status: 403 }
        );
      }
    }

    if (settings.autoAccept === true) {
      return NextResponse.json({ status: "auto_accepted", roomId });
    }

    // Room requires host manual approval
    const reqId =
      typeof body.requestId === "string" && body.requestId
        ? body.requestId
        : `req_${username}_${Date.now()}`;

    const newRequest: RoomRequest = {
      id: reqId,
      roomId,
      userId: typeof user.id === "string" ? user.id : username,
      username,
      displayName: typeof user.displayName === "string" ? user.displayName : username,
      avatar: typeof user.avatar === "string" ? user.avatar : "",
      status: "pending",
      createdAt: Date.now(),
    };

    saveRoomRequest(newRequest);

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
