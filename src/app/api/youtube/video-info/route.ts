import { NextRequest, NextResponse } from "next/server";
import { cleanYouTubeTitle, extractYouTubeId } from "@/lib/youtube";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const input = searchParams.get("videoId") || searchParams.get("url") || searchParams.get("q") || "";
  const videoId = extractYouTubeId(input) || (input.length === 11 ? input : null);

  if (!videoId) {
    return NextResponse.json({ error: "Invalid YouTube URL or ID" }, { status: 400 });
  }

  // Official public oEmbed API (does NOT require an API key or credentials)
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const res = await fetch(oembedUrl, { next: { revalidate: 86400 } });
    if (res.ok) {
      const data = await res.json();
      const rawTitle = data.title || `Track ${videoId}`;
      const author = data.author_name || "YouTube";
      const { title, artist } = cleanYouTubeTitle(rawTitle);

      return NextResponse.json({
        videoId,
        title: title || rawTitle,
        artist: artist === "YouTube" ? author : artist,
        duration: 0,
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      });
    }
  } catch (err) {
    console.warn("oEmbed fetch failed:", err);
  }

  // Graceful fallback with zero external dependencies
  return NextResponse.json({
    videoId,
    title: "YouTube Track",
    artist: "YouTube",
    duration: 0,
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
  });
}
