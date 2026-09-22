import { NextRequest, NextResponse } from "next/server";
import {
  syncAndFetchAllBackgrounds,
  saveUnifiedBackground,
  deleteUnifiedBackground,
} from "@/lib/server-backgrounds";
import type { BackgroundMetadata } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") || req.nextUrl.searchParams.get("token");
    if (!authHeader || !authHeader.includes("auxy_adm_")) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const backgrounds = await syncAndFetchAllBackgrounds();
    return NextResponse.json({ ok: true, shaders: backgrounds || [] });
  } catch (err: unknown) {
    console.error("[Admin Shaders GET] Error:", err);
    return NextResponse.json({ ok: false, shaders: [] }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.includes("auxy_adm_")) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, videoUrl, posterUrl } = body;

    if (!name || typeof name !== "string" || !videoUrl || typeof videoUrl !== "string") {
      return NextResponse.json({ ok: false, error: "Name and Video URL are required" }, { status: 400 });
    }

    const cleanName = name.trim();
    const idSlug = cleanName.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 30);
    const shaderId = `live-shader-${idSlug}-${Date.now().toString(36)}`;

    const newShader: BackgroundMetadata = {
      id: shaderId,
      name: cleanName,
      videoUrl: videoUrl.trim(),
      posterUrl: posterUrl?.trim() || "",
      active: true,
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Save to Server Store and Supabase PostgreSQL
    const saved = await saveUnifiedBackground(newShader);

    return NextResponse.json({
      ok: true,
      message: `Live Shader "${cleanName}" published successfully!`,
      shader: saved,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to save shader";
    console.error("[Admin Shaders POST] Error:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.includes("auxy_adm_")) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, name, videoUrl, posterUrl, active } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ ok: false, error: "Shader ID is required" }, { status: 400 });
    }

    if (!name || typeof name !== "string" || !videoUrl || typeof videoUrl !== "string") {
      return NextResponse.json({ ok: false, error: "Name and Video URL are required" }, { status: 400 });
    }

    const updatedShader: BackgroundMetadata = {
      id: id.trim(),
      name: name.trim(),
      videoUrl: videoUrl.trim(),
      posterUrl: posterUrl?.trim() || "",
      active: active !== false,
      updatedAt: Date.now(),
      createdAt: body.createdAt || Date.now(),
    };

    const saved = await saveUnifiedBackground(updatedShader);

    return NextResponse.json({
      ok: true,
      message: `Live Shader "${name.trim()}" updated successfully!`,
      shader: saved,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update shader";
    console.error("[Admin Shaders PUT] Error:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.includes("auxy_adm_")) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const shaderId = searchParams.get("id");
    if (!shaderId) {
      return NextResponse.json({ ok: false, error: "Shader ID is required" }, { status: 400 });
    }

    await deleteUnifiedBackground(shaderId);

    return NextResponse.json({ ok: true, message: `Live Shader ${shaderId} removed` });
  } catch (err: unknown) {
    console.error("[Admin Shaders DELETE] Error:", err);
    return NextResponse.json({ ok: false, error: "Failed to delete shader" }, { status: 500 });
  }
}

