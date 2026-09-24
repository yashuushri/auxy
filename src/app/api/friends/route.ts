import { NextRequest, NextResponse } from "next/server";
import {
  getUserFriends,
  getUserPendingRequests,
  createFriendRequest,
  respondToFriendRequest,
  cancelFriendRequest,
  removeFriendship,
  searchUsersWithFriendStatus,
  getFriendshipStatus,
} from "@/lib/server-store";
import { searchSupabaseProfiles } from "@/lib/supabase-db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const username = (searchParams.get("username") || "").trim().toLowerCase();
    const search = searchParams.get("search");
    const target = (searchParams.get("target") || "").trim().toLowerCase();

    // If searching users
    if (search !== null) {
      const current = (searchParams.get("current") || username || "").trim().toLowerCase();
      const localResults = searchUsersWithFriendStatus(search, current);
      const remoteResults = await searchSupabaseProfiles(search, current);

      const map = new Map<string, {
        username: string;
        displayName: string;
        avatar: string;
        bio?: string;
        isOnline: boolean;
        friendStatus: "friends" | "pending_sent" | "pending_received" | "none";
        requestId?: string;
      }>();

      // First populate remote profiles
      for (const r of remoteResults) {
        const uKey = r.username.toLowerCase().trim();
        const status = getFriendshipStatus(current, r.username);
        map.set(uKey, {
          ...r,
          friendStatus: status,
        });
      }

      // Then override/merge with local in-memory results
      for (const l of localResults) {
        const uKey = l.username.toLowerCase().trim();
        map.set(uKey, l);
      }

      return NextResponse.json({ success: true, users: Array.from(map.values()) });
    }

    if (!username) {
      return NextResponse.json({ error: "Username is required" }, { status: 400 });
    }

    // Check specific friendship status between username and target
    if (target) {
      const status = getFriendshipStatus(username, target);
      return NextResponse.json({ success: true, status });
    }

    const friends = getUserFriends(username);
    const pending = getUserPendingRequests(username);

    return NextResponse.json({
      success: true,
      friends,
      pending,
    });
  } catch (err) {
    console.error("[Friends API] GET Error:", err);
    return NextResponse.json({ error: "Failed to fetch friends data" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      const text = await req.text();
      body = text ? JSON.parse(text) : {};
    }

    const action = String(body.action || "").trim();

    if (action === "request") {
      const fromUsername = String(body.fromUsername || "").trim();
      const toUsername = String(body.toUsername || "").trim();
      const fromDisplayName = typeof body.fromDisplayName === "string" ? body.fromDisplayName : undefined;
      const fromAvatar = typeof body.fromAvatar === "string" ? body.fromAvatar : undefined;

      if (!fromUsername || !toUsername) {
        return NextResponse.json({ error: "fromUsername and toUsername required" }, { status: 400 });
      }

      const res = createFriendRequest({ username: fromUsername, displayName: fromDisplayName, avatar: fromAvatar }, toUsername);
      return NextResponse.json({ success: res.success, status: res.status, error: res.error });
    }

    if (action === "respond") {
      const requestId = String(body.requestId || "").trim();
      const responseAction = body.response === "accept" ? "accept" : "decline";

      if (!requestId) {
        return NextResponse.json({ error: "requestId required" }, { status: 400 });
      }

      const ok = respondToFriendRequest(requestId, responseAction);
      return NextResponse.json({ success: ok });
    }

    if (action === "cancel") {
      const fromUsername = String(body.fromUsername || "").trim();
      const toUsername = typeof body.toUsername === "string" ? body.toUsername.trim() : undefined;
      const requestId = typeof body.requestId === "string" ? body.requestId.trim() : undefined;

      if (!fromUsername && !requestId) {
        return NextResponse.json({ error: "fromUsername or requestId required" }, { status: 400 });
      }

      const ok = cancelFriendRequest(fromUsername, toUsername, requestId);
      return NextResponse.json({ success: ok });
    }

    if (action === "remove") {
      const user1 = String(body.user1 || "").trim();
      const user2 = String(body.user2 || "").trim();

      if (!user1 || !user2) {
        return NextResponse.json({ error: "user1 and user2 required" }, { status: 400 });
      }

      removeFriendship(user1, user2);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: `Unknown action "${action}"` }, { status: 400 });
  } catch (err) {
    console.error("[Friends API] POST Error:", err);
    return NextResponse.json({ error: "Failed to process friend action" }, { status: 500 });
  }
}
