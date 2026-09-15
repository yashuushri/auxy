import type { Track } from "@/lib/types";

type ItunesSong = {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName?: string;
  artworkUrl100?: string;
  trackTimeMillis?: number;
  previewUrl?: string;
};

export function extractYouTubeId(input: string) {
  const value = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(value)) return value;
  const match = value.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{11})/
  );
  return match?.[1] ?? null;
}

export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function coverFromItunes(url?: string) {
  if (!url) return "";
  return url.replace("100x100bb", "600x600bb").replace("100x100", "600x600");
}

export function mapItunesTrack(song: ItunesSong): Track {
  return {
    id: `it-${song.trackId}`,
    title: song.trackName,
    artist: song.artistName,
    album: song.collectionName || "Single",
    cover: coverFromItunes(song.artworkUrl100),
    duration: Math.round((song.trackTimeMillis || 30000) / 1000),
    previewUrl: song.previewUrl,
  };
}

export async function searchItunes(term: string, limit = 20): Promise<Track[]> {
  const query = term.trim();
  if (!query) return [];
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Search failed");
  const data = (await res.json()) as { results?: ItunesSong[] };
  return (data.results ?? []).map(mapItunesTrack);
}

export async function findYoutubeId(title: string, artist: string) {
  const query = `${title} ${artist}`.trim();
  if (!query) return null;
  try {
    const res = await fetch(`/api/find-track?q=${encodeURIComponent(query)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { youtubeId?: string | null; duration?: number | null };
    if (!data.youtubeId) return null;
    return { youtubeId: data.youtubeId, duration: data.duration || undefined };
  } catch {
    return null;
  }
}

export async function seedDiscoverTracks(): Promise<Track[]> {
  const queries = ["lofi beats", "synthwave", "pop hits", "indie mix"];
  const batches = await Promise.allSettled(
    queries.map((query) => searchItunes(query, 6))
  );
  const seen = new Set<string>();
  const tracks: Track[] = [];
  for (const batch of batches) {
    if (batch.status !== "fulfilled") continue;
    for (const track of batch.value) {
      if (seen.has(track.id)) continue;
      seen.add(track.id);
      tracks.push(track);
    }
  }
  return tracks.slice(0, 18);
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
