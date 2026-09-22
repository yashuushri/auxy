import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const videoUrl = searchParams.get("url");

    if (!videoUrl) {
      return new NextResponse("Missing url parameter", { status: 400 });
    }

    const lower = videoUrl.toLowerCase();
    const publicThumbnailsDir = path.join(process.cwd(), "public", "thumbnails");

    // Direct matches for existing presets
    let matchedFile = "";
    if (lower.includes("hololive") || lower.includes("okayu")) matchedFile = "hololive.jpg";
    else if (lower.includes("pool")) matchedFile = "pool.jpg";
    else if (lower.includes("videoplayback__1_") || lower.includes("videoplayback%20(1)")) matchedFile = "videoplayback-1.jpg";
    else if (lower.includes("videoplayback")) matchedFile = "videoplayback.jpg";
    else if (lower.includes("miku")) matchedFile = "hatsune-miku.jpg";
    else if (lower.includes("batman") || lower.includes("vengeance")) matchedFile = "batman.jpg";

    if (matchedFile) {
      const filePath = path.join(publicThumbnailsDir, matchedFile);
      if (fs.existsSync(filePath)) {
        const buffer = fs.readFileSync(filePath);
        return new NextResponse(buffer, {
          headers: {
            "Content-Type": "image/jpeg",
            "Cache-Control": "public, max-age=604800, immutable",
          },
        });
      }
    }

    // Check if pre-cached thumbnail exists
    const hash = crypto.createHash("md5").update(videoUrl).digest("hex");
    const cachedThumbnailPath = path.join(publicThumbnailsDir, `${hash}.jpg`);

    if (fs.existsSync(cachedThumbnailPath)) {
      const buffer = fs.readFileSync(cachedThumbnailPath);
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "public, max-age=604800, immutable",
        },
      });
    }

    // Never run ffmpeg in the hot path. Return 404 instantly so client falls back to deterministic gradient
    return new NextResponse("Thumbnail not available", { status: 404 });
  } catch {
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
