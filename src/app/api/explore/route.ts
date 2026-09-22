import { NextRequest, NextResponse } from "next/server";
import {
  getAllExploreUsersFromServerStore,
  registerOrUpdateUserInServerStore,
} from "@/lib/server-store";

export async function GET() {
  try {
    const users = getAllExploreUsersFromServerStore();
    return NextResponse.json({ success: true, users });
  } catch (err) {
    console.error("[Explore API] Error fetching explore users:", err);
    return NextResponse.json({ error: "Failed to fetch explore users", users: [] }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body && body.username) {
      registerOrUpdateUserInServerStore(body);
    }
    const users = getAllExploreUsersFromServerStore();
    return NextResponse.json({ success: true, users });
  } catch (err) {
    console.error("[Explore API] Error registering explore user:", err);
    return NextResponse.json({ error: "Failed to update explore user" }, { status: 500 });
  }
}
