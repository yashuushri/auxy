import { getSupabase } from "@/lib/supabase";
import type { Track } from "@/lib/types";

export const trackRepository = {
  async upsertTracks(tracks: Track[]): Promise<void> {
    const supabase = getSupabase();
    if (!supabase || !tracks || tracks.length === 0) return;
    try {
      const rows = tracks.map((t) => ({
        id: t.id || `yt-${t.youtubeId}`,
        youtube_id: t.youtubeId,
        provider: t.provider || "youtube",
        provider_id: t.providerId || null,
        title: t.title,
        artist: t.artist || "",
        album: t.album || "",
        cover: t.cover || "",
        duration: t.duration || 0,
        source_url: t.sourceUrl || "",
        updated_at: new Date().toISOString(),
      }));
      await supabase.from("tracks").upsert(rows, { onConflict: "id" });
    } catch (err) {
      console.warn("[TrackRepository] upsertTracks error:", err);
    }
  },

  async addTrackToPlaylist(playlistId: string, track: Track, position?: number): Promise<void> {
    const supabase = getSupabase();
    if (!supabase || !playlistId || !track) return;
    try {
      const trackId = track.id || `yt-${track.youtubeId}`;
      await this.upsertTracks([track]);

      let finalPos = position;
      if (finalPos === undefined) {
        const { count } = await supabase
          .from("playlist_tracks")
          .select("*", { count: "exact", head: true })
          .eq("playlist_id", playlistId);
        finalPos = count ?? 0;
      }

      await supabase.from("playlist_tracks").upsert(
        {
          playlist_id: playlistId,
          track_id: trackId,
          position: finalPos,
        },
        { onConflict: "playlist_id,track_id" }
      );
    } catch (err) {
      console.warn("[TrackRepository] addTrackToPlaylist error:", err);
    }
  },

  async removeTrackFromPlaylist(playlistId: string, trackId: string): Promise<void> {
    const supabase = getSupabase();
    if (!supabase || !playlistId || !trackId) return;
    try {
      await supabase
        .from("playlist_tracks")
        .delete()
        .eq("playlist_id", playlistId)
        .eq("track_id", trackId);
    } catch (err) {
      console.warn("[TrackRepository] removeTrackFromPlaylist error:", err);
    }
  },

  async reorderPlaylistTracks(playlistId: string, orderedTrackIds: string[]): Promise<void> {
    const supabase = getSupabase();
    if (!supabase || !playlistId || !orderedTrackIds) return;
    try {
      const rows = orderedTrackIds.map((trackId, idx) => ({
        playlist_id: playlistId,
        track_id: trackId,
        position: idx,
      }));
      await supabase.from("playlist_tracks").upsert(rows, {
        onConflict: "playlist_id,track_id",
      });
    } catch (err) {
      console.warn("[TrackRepository] reorderPlaylistTracks error:", err);
    }
  },
};
