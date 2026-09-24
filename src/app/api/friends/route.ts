import { NextRequest, NextResponse } from "next/server";
import {
  getSupabaseFriendships,
  getSupabasePendingRequests,
  getSupabaseFriendshipStatus,
  searchSupabaseProfiles,
  createSupabaseFriendRequest,
  respondSupabaseFriendRequest,
  cancelSupabaseFriendRequest,
  removeSupabaseFriendship,
  cleanUsername,
} from "@/lib/supabase-db";
import { getAuthenticatedUsername, createAuthSessionToken } from "@/lib/auth-session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawUsername = searchParams.get("username") || "";
    const username = cleanUsername(rawUsername);
    const search = searchParams.get("search");
    const target = cleanUsername(searchParams.get("target") || "");
    const sessionUser = await getAuthenticatedUsername(req);

    // 1. User Search within Explore/Friends dialog
    if (search !== null) {
      const current = cleanUsername(
        searchParams.get("current") || username || sessionUser || ""
      );
      const users = await searchSupabaseProfiles(search, current);
      return NextResponse.json({ success: true, users });
    }

    const effectiveUser = username || sessionUser;
    if (!effectiveUser) {
      return NextResponse.json(
        { error: "Username is required" },
        { status: 400 }
      );
    }

    // 2. Target check: status between effectiveUser and target
    if (target) {
      const status = await getSupabaseFriendshipStatus(effectiveUser, target);
      return NextResponse.json({ success: true, status });
    }

    // 3. Complete friends list & pending requests from authoritative Supabase tables
    const [friends, pending] = await Promise.all([
      getSupabaseFriendships(effectiveUser),
      getSupabasePendingRequests(effectiveUser),
    ]);

    return NextResponse.json({
      success: true,
      friends,
      pending,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[Friends API] GET Error from Supabase:", err);
    return NextResponse.json(
      { error: "Failed to fetch friends data from database", details: errorMsg },
      { status: 500 }
    );
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
    const verifiedSessionUser = await getAuthenticatedUsername(req);

    // ACTION 1: SEND FRIEND REQUEST
    if (action === "request") {
      const toUsername = cleanUsername(String(body.toUsername || ""));
      const bodyFrom = cleanUsername(String(body.fromUsername || ""));

      // Determine currentUser from authenticated session; fallback to bodyFrom if cookie absent
      const currentUser = verifiedSessionUser || bodyFrom;
      if (!currentUser) {
        return NextResponse.json(
          { success: false, error: "Please sign in to send a friend request." },
          { status: 401 }
        );
      }

      if (!toUsername) {
        return NextResponse.json(
          { success: false, error: "Target username is required." },
          { status: 400 }
        );
      }

      const res = await createSupabaseFriendRequest(
        { username: currentUser },
        toUsername
      );

      const response = NextResponse.json({
        success: res.success,
        status: res.status,
        requestId: res.requestId,
        error: res.error,
        message: res.message,
      });

      // Ensure session cookie is set
      if (!req.cookies.get("auxy_session")?.value && currentUser) {
        response.cookies.set({
          name: "auxy_session",
          value: createAuthSessionToken(currentUser),
          path: "/",
          sameSite: "lax",
          maxAge: 30 * 24 * 60 * 60,
        });
      }

      return response;
    }

    // ACTION 2: RESPOND TO FRIEND REQUEST (ACCEPT / DECLINE)
    if (action === "respond") {
      const requestId = String(body.requestId || "").trim();
      const responseAction = body.response === "accept" ? "accept" : "decline";
      const bodyUsername = cleanUsername(String(body.username || ""));
      const currentUser = verifiedSessionUser || bodyUsername;

      if (!requestId) {
        return NextResponse.json({ success: false, error: "requestId required" }, { status: 400 });
      }

      if (!currentUser) {
        return NextResponse.json(
          { success: false, error: "Authentication required to respond to friend requests." },
          { status: 401 }
        );
      }

      const res = await respondSupabaseFriendRequest(
        requestId,
        currentUser,
        responseAction
      );

      if (!res.success) {
        return NextResponse.json(
          { success: false, error: res.error || "Failed to process request." },
          { status: 400 }
        );
      }

      return NextResponse.json({ success: true });
    }

    // ACTION 3: CANCEL OUTGOING FRIEND REQUEST
    if (action === "cancel") {
      const requestId = typeof body.requestId === "string" ? body.requestId.trim() : undefined;
      const toUsername = typeof body.toUsername === "string" ? cleanUsername(body.toUsername) : undefined;
      const bodyFrom = cleanUsername(String(body.fromUsername || ""));
      const currentUser = verifiedSessionUser || bodyFrom;

      if (!currentUser) {
        return NextResponse.json(
          { success: false, error: "Authentication required to cancel request." },
          { status: 401 }
        );
      }

      const res = await cancelSupabaseFriendRequest(
        currentUser,
        requestId,
        toUsername
      );

      return NextResponse.json({ success: res.success, error: res.error });
    }

    // ACTION 4: REMOVE EXISTING FRIENDSHIP
    if (action === "remove") {
      const user1 = cleanUsername(String(body.user1 || ""));
      const user2 = cleanUsername(String(body.user2 || ""));
      const currentUser = verifiedSessionUser || user1;

      if (!user1 || !user2) {
        return NextResponse.json({ success: false, error: "user1 and user2 required." }, { status: 400 });
      }

      if (!currentUser) {
        return NextResponse.json(
          { success: false, error: "Authentication required to remove friendship." },
          { status: 401 }
        );
      }

      const res = await removeSupabaseFriendship(user1, user2, currentUser);
      return NextResponse.json({ success: res.success, error: res.error });
    }

    return NextResponse.json({ success: false, error: `Unknown action "${action}"` }, { status: 400 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[Friend Request Error]", err);
    return NextResponse.json(
      { success: false, error: "Failed to process friend action in database", details: errorMsg },
      { status: 500 }
    );
  }
}
