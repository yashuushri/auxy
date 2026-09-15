import type { Track } from "@/lib/types";
import { createTrackFromYouTube, extractYouTubeId } from "@/lib/youtube";

export { extractYouTubeId };

export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export async function findYoutubeId(title: string, artist: string): Promise<{ youtubeId: string; duration?: number } | null> {
  const query = `${title} ${artist}`.trim();
  if (!query) return null;
  try {
    const res = await fetch(`/api/youtube/video-info?q=${encodeURIComponent(query)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.videoId) return null;
    return { youtubeId: data.videoId, duration: data.duration || undefined };
  } catch {
    return null;
  }
}

/**
 * Seed tracks for new rooms - curated YouTube tracks
 */
export function seedDiscoverTracks(): Track[] {
  const seedItems = [
    {
      videoId: "dQw4w9WgXcQ",
      title: "Never Gonna Give You Up",
      artist: "Rick Astley",
      duration: 213,
      thumbnailUrl: "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    },
    {
      videoId: "2Vv-BfVoq4g",
      title: "Perfect",
      artist: "Ed Sheeran",
      duration: 263,
      thumbnailUrl: "https://img.youtube.com/vi/2Vv-BfVoq4g/hqdefault.jpg",
    },
    {
      videoId: "kJQP7kiw5Fk",
      title: "Despacito",
      artist: "Luis Fonsi ft. Daddy Yankee",
      duration: 282,
      thumbnailUrl: "https://img.youtube.com/vi/kJQP7kiw5Fk/hqdefault.jpg",
    },
    {
      videoId: "fJ9rUzIMcZQ",
      title: "Bohemian Rhapsody",
      artist: "Queen",
      duration: 359,
      thumbnailUrl: "https://img.youtube.com/vi/fJ9rUzIMcZQ/hqdefault.jpg",
    },
  ];

  return seedItems.map(createTrackFromYouTube);
}

export function playlistCoverFromTracks(tracks: Track[], fallback: string) {
  return tracks.find((track) => track.cover)?.cover || fallback;
}

export function colorFromName(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const light = 18 + (Math.abs(hash) % 22);
  const dark = Math.max(8, light - 12);
  return `linear-gradient(145deg, hsl(0 0% ${light}%), hsl(0 0% ${dark}%))`;
}
