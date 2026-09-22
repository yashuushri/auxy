import { NextRequest, NextResponse } from "next/server";
import {
  cleanYouTubeTitle,
  extractYouTubeId,
  formatArtistWithPlatform,
  generatePlaylistNameFromSong,
  getPrimaryArtist,
} from "@/lib/youtube";

export const dynamic = "force-dynamic";

interface VideoMetadata {
  videoId: string;
  title: string;
  artist: string;
  primaryArtist: string;
  channelName: string;
  suggestedPlaylistName: string;
  duration: number;
  thumbnailUrl: string;
}

const memoryCache = new Map<string, VideoMetadata>();

async function fetchSingleVideoMetadata(videoId: string): Promise<VideoMetadata> {
  if (memoryCache.has(videoId)) {
    return memoryCache.get(videoId)!;
  }

  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const res = await fetch(oembedUrl, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      const rawTitle = data.title || `Track ${videoId}`;
      const author = data.author_name || "YouTube";
      const { title, artist } = cleanYouTubeTitle(rawTitle);
      const primaryCreator = getPrimaryArtist(artist === "YouTube" ? author : artist);
      const cleanTitle = title || rawTitle;

      const meta: VideoMetadata = {
        videoId,
        title: cleanTitle,
        artist: formatArtistWithPlatform(primaryCreator),
        primaryArtist: primaryCreator,
        channelName: getPrimaryArtist(author),
        suggestedPlaylistName: generatePlaylistNameFromSong(cleanTitle),
        duration: 0,
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      };
      memoryCache.set(videoId, meta);
      return meta;
    }
  } catch (err) {
    console.warn("oEmbed fetch failed for", videoId, err);
  }

  // Secondary fallback via noembed to prevent stalling on batch imports
  try {
    const altUrl = `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`;
    const altRes = await fetch(altUrl, { signal: AbortSignal.timeout(3000) });
    if (altRes.ok) {
      const altData = await altRes.json();
      if (altData.title) {
        const rawTitle = altData.title;
        const author = altData.author_name || "YouTube";
        const { title, artist } = cleanYouTubeTitle(rawTitle);
        const primaryCreator = getPrimaryArtist(artist === "YouTube" ? author : artist);
        const cleanTitle = title || rawTitle;

        const meta: VideoMetadata = {
          videoId,
          title: cleanTitle,
          artist: formatArtistWithPlatform(primaryCreator),
          primaryArtist: primaryCreator,
          channelName: getPrimaryArtist(author),
          suggestedPlaylistName: generatePlaylistNameFromSong(cleanTitle),
          duration: 0,
          thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        };
        memoryCache.set(videoId, meta);
        return meta;
      }
    }
  } catch {
    /* ignore */
  }

  const fallback: VideoMetadata = {
    videoId,
    title: "YouTube Track",
    artist: "YouTube",
    primaryArtist: "YouTube",
    channelName: "YouTube",
    suggestedPlaylistName: "YouTube's Playlist",
    duration: 0,
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
  };
  return fallback;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const input = searchParams.get("videoId") || searchParams.get("url") || searchParams.get("q") || "";
  const videoId = extractYouTubeId(input) || (input.length === 11 ? input : null);

  if (!videoId) {
    return NextResponse.json({ error: "Invalid YouTube URL or ID" }, { status: 400 });
  }

  const meta = await fetchSingleVideoMetadata(videoId);
  return NextResponse.json(meta);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawIds: string[] = Array.isArray(body?.videoIds) ? body.videoIds : [];
    const validIds = Array.from(
      new Set(
        rawIds
          .map((id) => extractYouTubeId(id) || id)
          .filter((id): id is string => Boolean(id) && typeof id === "string" && id.length === 11)
      )
    );

    if (!validIds.length) {
      return NextResponse.json({ results: {} });
    }

    // Process in batches of 10 concurrent requests on server
    const results: Record<string, VideoMetadata> = {};
    const concurrency = 10;
    for (let i = 0; i < validIds.length; i += concurrency) {
      const slice = validIds.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(
        slice.map((id) => fetchSingleVideoMetadata(id))
      );
      batchResults.forEach((res, idx) => {
        const vid = slice[idx];
        if (res.status === "fulfilled") {
          results[vid] = res.value;
        }
      });
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Batch video-info error:", error);
    return NextResponse.json({ error: "Failed to process batch request" }, { status: 500 });
  }
}
