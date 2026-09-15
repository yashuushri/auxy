import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  applyAccountClean,
  completeRoomVideo,
  deleteRoomVideoRecord,
  getAccount,
  getVideoChunk,
  getVideoMeta,
  initRoomVideo,
  saveVideoChunk,
} from "@/lib/account-store";
import { readSession, SESSION_COOKIE } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

async function currentUsername() {
  await applyAccountClean();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const username = readSession(token);
  if (!username) return null;
  const account = await getAccount(username);
  return account?.username ?? null;
}

export async function GET(request: Request) {
  const username = await currentUsername();
  if (!username) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const indexRaw = new URL(request.url).searchParams.get("index");
  if (indexRaw == null) {
    const meta = await getVideoMeta(username);
    if (!meta?.complete) {
      return NextResponse.json({ exists: false });
    }
    return NextResponse.json({
      exists: true,
      stamp: meta.stamp,
      chunks: meta.chunks,
      size: meta.size,
      type: meta.type,
    });
  }

  const index = Number(indexRaw);
  const chunk = await getVideoChunk(username, index);
  if (!chunk) {
    return NextResponse.json({ error: "Missing video chunk." }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(chunk), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Cache-Control": "private, no-store",
    },
  });
}

export async function PUT(request: Request) {
  const username = await currentUsername();
  if (!username) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: { action?: string; stamp?: string; size?: number; type?: string; chunks?: number };
  try {
    body = (await request.json()) as {
      action?: string;
      stamp?: string;
      size?: number;
      type?: string;
      chunks?: number;
    };
  } catch {
    return NextResponse.json({ error: "Could not read that request." }, { status: 400 });
  }

  try {
    if (body.action === "complete") {
      await completeRoomVideo(username);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "init") {
      const size = Number(body.size);
      const chunks = Number(body.chunks);
      const stamp = String(body.stamp ?? "");
      if (!stamp || !size || !chunks) {
        return NextResponse.json({ error: "Missing video details." }, { status: 400 });
      }
      if (size > MAX_VIDEO_BYTES) {
        return NextResponse.json({ error: "Keep the video under 50MB." }, { status: 400 });
      }
      await initRoomVideo(username, {
        stamp,
        size,
        type: body.type || "video/mp4",
        chunks,
      });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Could not save that video." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const username = await currentUsername();
  if (!username) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const index = Number(new URL(request.url).searchParams.get("index"));
  if (!Number.isInteger(index) || index < 0) {
    return NextResponse.json({ error: "Bad chunk." }, { status: 400 });
  }
  const data = Buffer.from(await request.arrayBuffer());
  try {
    await saveVideoChunk(username, index, data);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not save that video chunk." }, { status: 500 });
  }
}

export async function DELETE() {
  const username = await currentUsername();
  if (!username) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  await deleteRoomVideoRecord(username);
  return NextResponse.json({ ok: true });
}
