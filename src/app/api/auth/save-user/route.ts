import { NextRequest, NextResponse } from "next/server";
import { registerOrUpdateUserInServerStore } from "@/lib/server-store";
import type { UserAccount } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const user = body.user as Partial<UserAccount> & { username?: string };

    if (!user || !user.username) {
      return NextResponse.json(
        { ok: false, error: "Invalid user data provided" },
        { status: 400 }
      );
    }

    registerOrUpdateUserInServerStore(user as UserAccount);

    return NextResponse.json({
      ok: true,
      message: "User saved to server storage successfully",
    });
  } catch (err) {
    console.error("[Save User API] Error saving user to server store:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to persist user on server" },
      { status: 500 }
    );
  }
}
