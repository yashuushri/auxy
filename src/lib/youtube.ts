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
    if (plMatch && plMatch[1] !== "WL" && plMatch[1] !== "LL") {
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
 * Specifically validates if an input is a YouTube playlist.
 * Returns { isPlaylist: boolean; isSingleVideoOnly: boolean; playlistId?: string }
 */
export function validateYouTubePlaylistInput(input: string): {
  isPlaylist: boolean;
  isSingleVideoOnly: boolean;
  playlistId?: string;
} {
  const raw = input.trim();
  if (!raw) return { isPlaylist: false, isSingleVideoOnly: false };

  // If raw playlist ID (e.g. PL..., OLAK..., etc.)
  if (/^(?:PL|OLAK|UU|FL|RD|LL|WL)[A-Za-z0-9_-]{10,}$/i.test(raw)) {
    return { isPlaylist: true, isSingleVideoOnly: false, playlistId: raw };
  }

  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    const listParam = url.searchParams.get("list");
    const vParam = url.searchParams.get("v");

    if (listParam && listParam !== "WL" && listParam !== "LL") {
      return { isPlaylist: true, isSingleVideoOnly: false, playlistId: listParam };
    }

    if (vParam || url.hostname === "youtu.be" || url.pathname.startsWith("/watch") || url.pathname.startsWith("/shorts/")) {
      return { isPlaylist: false, isSingleVideoOnly: true };
    }
  } catch {
    const listMatch = raw.match(/[?&]list=([A-Za-z0-9_-]+)/);
    if (listMatch && listMatch[1] && listMatch[1] !== "WL" && listMatch[1] !== "LL") {
      return { isPlaylist: true, isSingleVideoOnly: false, playlistId: listMatch[1] };
    }
    if (/(?:watch\?v=|youtu\.be\/|shorts\/)/.test(raw)) {
      return { isPlaylist: false, isSingleVideoOnly: true };
    }
  }

  return { isPlaylist: false, isSingleVideoOnly: false };
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
 * Extracts the single primary creator/channel name and avoids multiple collaborator clutter.
 * e.g. "Ravi Kumar, Neha Kakkar & Badshah" -> "Ravi Kumar"
 * e.g. "DIVINE feat. Naezy" -> "DIVINE"
 * e.g. "LuisFonsiVEVO" -> "Luis Fonsi"
 */
export function getPrimaryArtist(rawArtist?: string | null): string {
  if (!rawArtist) return "YouTube";
  let clean = rawArtist.trim();

  // Remove common channel suffixes
  clean = clean
    .replace(/ - Topic$/i, "")
    .replace(/VEVO$/i, "")
    .replace(/ Official$/i, "")
    .replace(/ Records$/i, "")
    .trim();

  // Pick only the first/primary creator if multiple collaborators are listed
  const collaboratorsRegex = /[,&/]|(?:\s+(?:feat\.?|ft\.?|featuring|with|x|vs\.?)\s+)/i;
  const parts = clean.split(collaboratorsRegex);
  const primary = parts[0]?.trim();

  return primary || clean || "YouTube";
}

/**
 * Formats artist tag with clean primary artist and platform
 * e.g. "Ravi Kumar · YouTube"
 */
export function formatArtistWithPlatform(rawArtist?: string | null): string {
  const primary = getPrimaryArtist(rawArtist);
  if (!primary || primary.toLowerCase() === "youtube") {
    return "YouTube";
  }
  if (primary.toLowerCase().endsWith("· youtube")) {
    return primary;
  }
  return `${primary} · YouTube`;
}

/**
 * Generates playlist name from the first song's title
 * e.g. "Farak | DIVINE" -> "Farak's Playlist"
 * e.g. "Kesariya (Audio)" -> "Kesariya's Playlist"
 * e.g. "Despacito ft. Daddy Yankee" -> "Despacito's Playlist"
 */
export function generatePlaylistNameFromSong(rawTitle?: string | null): string {
  if (
    !rawTitle ||
    typeof rawTitle !== "string" ||
    !rawTitle.trim() ||
    rawTitle.toLowerCase() === "undefined" ||
    rawTitle.toLowerCase() === "null" ||
    rawTitle.toLowerCase() === "undefined name" ||
    rawTitle.toLowerCase() === "unknown track"
  ) {
    return "My Playlist";
  }
  const { title } = cleanYouTubeTitle(rawTitle);
  const clean = (title || rawTitle).trim();

  // Extract first word/token (support Latin, Devanagari, Arabic, Cyrillic, CJK, etc.)
  const words = clean
    .replace(/^[^a-zA-Z0-9\u0900-\u097F\u0600-\u06FF\u0400-\u04FF\u4E00-\u9FFF]+/, "")
    .split(/[\s\-–—|_()[\]{}.,:;!?'"\/\\#@$%^&*+=<>~`]+/);

  const firstWord =
    words.find((w) => {
      const trimmed = w.trim();
      if (!trimmed) return false;
      const lower = trimmed.toLowerCase();
      return !["the", "a", "an", "official", "video", "audio", "lyric", "lyrics", "full", "song", "hd", "hq", "4k", "mv", "remix"].includes(lower);
    }) || words.find((w) => w.trim().length > 0);

  if (!firstWord || firstWord.toLowerCase() === "undefined" || firstWord.toLowerCase() === "null") {
    return "My Playlist";
  }

  const formatted = firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
  return `${formatted}'s Playlist`;
}

/**
 * Clean track title and artist from YouTube video title
 * e.g. "Artist - Song Title (Official Music Video)" -> Artist, Song Title
 * e.g. "Farak | DIVINE | Gully Gang" -> Title: "Farak", Artist: "DIVINE"
 */
export function cleanYouTubeTitle(rawTitle: string): { title: string; artist: string } {
  const cleaned = rawTitle
    .replace(/\s*[\(\[](?:Official\s+(?:Music\s+)?Video|Audio|Lyric\s+Video|Visualizer|HD|HQ|4K|MV|Official|Full\s+Song|Remix)[\)\]]/gi, "")
    .replace(/\s*\|\s*Official\s+Music\s+Video/gi, "")
    .trim();

  // Check for common "Artist - Title" separator
  if (cleaned.includes(" - ")) {
    const parts = cleaned.split(" - ");
    const artist = parts[0].trim();
    const title = parts.slice(1).join(" - ").trim();
    if (artist && title) {
      return { artist: getPrimaryArtist(artist), title };
    }
  }

  // Check for "Title | Artist"
  if (cleaned.includes(" | ")) {
    const parts = cleaned.split(" | ");
    const title = parts[0].trim();
    const artist = parts[1]?.trim() || "YouTube";
    if (title) {
      return { artist: getPrimaryArtist(artist), title };
    }
  }

  // Check for "Artist: Title"
  if (cleaned.includes(": ")) {
    const parts = cleaned.split(": ");
    const artist = parts[0].trim();
    const title = parts.slice(1).join(": ").trim();
    if (artist && title) {
      return { artist: getPrimaryArtist(artist), title };
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
  const primaryArtist = getPrimaryArtist(item.artist || artist);
  const formattedArtist = formatArtistWithPlatform(primaryArtist);
  const cover =
    item.thumbnailUrl ||
    `https://img.youtube.com/vi/${item.videoId}/hqdefault.jpg`;

  return {
    id: `yt-${item.videoId}`,
    youtubeId: item.videoId,
    title: item.title ? title : `Track ${item.videoId}`,
    artist: formattedArtist,
    album: "YouTube",
    cover,
    duration: item.duration || 0,
    url: `https://www.youtube.com/watch?v=${item.videoId}`,
  };
}
