import type { Track } from "@/lib/types";

export type ParsedYouTubeInput =
  | { type: "video"; videoId: string }
  | { type: "playlist"; playlistId: string; videoId?: string }
  | { type: "unsupported" };

/**
 * Checks if a string is a valid 11-character YouTube video ID
 */
export function isValidYouTubeId(id?: string | null): id is string {
  return typeof id === "string" && /^[A-Za-z0-9_-]{11}$/.test(id);
}

/**
 * Parses user input to distinguish single video vs playlist vs invalid.
 */
export function parseYouTubeUrl(input: string): ParsedYouTubeInput {
  const raw = input.trim();
  if (!raw) return { type: "unsupported" };

  // If raw 11-char ID
  if (/^[A-Za-z0-9_-]{11}$/.test(raw)) {
    return { type: "video", videoId: raw };
  }

  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    const host = url.hostname.toLowerCase();

    // Check playlist param first
    const listParam = url.searchParams.get("list");
    const vParam = url.searchParams.get("v");

    if (listParam && listParam !== "WL" && listParam !== "LL") {
      // YouTube mixes / radios (starting with RD) cannot be played as playlists in embeds
      if (listParam.startsWith("RD") && vParam && /^[A-Za-z0-9_-]{11}$/.test(vParam)) {
        return { type: "video", videoId: vParam };
      }
      return {
        type: "playlist",
        playlistId: listParam,
        videoId: vParam || undefined,
      };
    }

    // Check youtu.be
    if (host === "youtu.be") {
      const id = url.pathname.slice(1).split("/")[0];
      if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) {
        return { type: "video", videoId: id };
      }
    }

    // Check youtube.com / m.youtube.com
    if (host.includes("youtube.com")) {
      if (vParam && /^[A-Za-z0-9_-]{11}$/.test(vParam)) {
        return { type: "video", videoId: vParam };
      }

      // Shorts
      const shortsMatch = url.pathname.match(/\/shorts\/([A-Za-z0-9_-]{11})/);
      if (shortsMatch) {
        return { type: "video", videoId: shortsMatch[1] };
      }

      // Embed or live
      const embedMatch = url.pathname.match(/\/(?:embed|live)\/([A-Za-z0-9_-]{11})/);
      if (embedMatch) {
        return { type: "video", videoId: embedMatch[1] };
      }
    }
  } catch {
    // Regex fallback
    const plMatch = raw.match(/[?&]list=([A-Za-z0-9_-]+)/);
    const vMatch = raw.match(
      /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{11})/
    );
    if (plMatch && (!plMatch[1].startsWith("RD") || !vMatch)) {
      return { type: "playlist", playlistId: plMatch[1], videoId: vMatch?.[1] };
    }
    if (vMatch) {
      return { type: "video", videoId: vMatch[1] };
    }
  }

  return { type: "unsupported" };
}

/**
 * Extracts pure YouTube video ID
 */
export function extractYouTubeId(input: string): string | null {
  const parsed = parseYouTubeUrl(input);
  if (parsed.type === "video") return parsed.videoId;
  if (parsed.type === "playlist" && parsed.videoId) return parsed.videoId;
  return null;
}

/**
 * Parses ISO 8601 duration (e.g. PT4M13S) into seconds
 */
export function parseIsoDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Clean track title and artist from YouTube video title
 * e.g. "Artist - Song Title (Official Music Video)" -> Artist, Song Title
 */
export function cleanYouTubeTitle(rawTitle: string): { title: string; artist: string } {
  const cleaned = rawTitle
    .replace(/\s*[\(\[](?:Official\s+(?:Music\s+)?Video|Audio|Lyric\s+Video|Visualizer|HD|HQ|4K|MV|Official)[\)\]]/gi, "")
    .replace(/\s*\|\s*Official\s+Music\s+Video/gi, "")
    .trim();

  // Check for common "Artist - Title" separator
  if (cleaned.includes(" - ")) {
    const parts = cleaned.split(" - ");
    const artist = parts[0].trim();
    const title = parts.slice(1).join(" - ").trim();
    if (artist && title) {
      return { artist, title };
    }
  }

  // Check for "Artist: Title"
  if (cleaned.includes(": ")) {
    const parts = cleaned.split(": ");
    const artist = parts[0].trim();
    const title = parts.slice(1).join(": ").trim();
    if (artist && title) {
      return { artist, title };
    }
  }

  return {
    title: cleaned || rawTitle,
    artist: "YouTube",
  };
}

/**
 * Creates standard Auxy Track object from YouTube video metadata
 */
export function createTrackFromYouTube(item: {
  videoId: string;
  title: string;
  artist?: string;
  duration?: number;
  thumbnailUrl?: string;
}): Track {
  const { title, artist } = cleanYouTubeTitle(item.title);
  const finalArtist = item.artist?.trim() || artist;
  const cover =
    item.thumbnailUrl ||
    `https://img.youtube.com/vi/${item.videoId}/hqdefault.jpg`;

  return {
    id: `yt-${item.videoId}`,
    youtubeId: item.videoId,
    title: item.title ? title : `Track ${item.videoId}`,
    artist: finalArtist,
    album: "YouTube",
    cover,
    duration: item.duration || 0,
    url: `https://www.youtube.com/watch?v=${item.videoId}`,
  };
}
