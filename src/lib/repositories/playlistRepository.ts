import { getSupabase } from "@/lib/supabase";
import type { Playlist } from "@/lib/types";

export const playlistRepository = {
  async getByOwner(ownerId: string): Promise<Playlist[]> {
    const supabase = getSupabase();
    if (!supabase || !ownerId) return [];
    try {
      const { data: playlistsData, error: plErr } = await supabase
        .from("playlists")
        .select("id, owner_id, name, description, is_public, type, youtube_playlist_id, cover, created_at, updated_at")
        .eq("owner_id", ownerId)
        .order("created_at", { ascending: true });

      if (plErr || !playlistsData) return [];

      const playlistIds = playlistsData.map((p) => p.id);
      if (playlistIds.length === 0) return [];

      // Fetch relation track IDs
      const { data: relationData } = await supabase
        .from("playlist_tracks")
        .select("playlist_id, track_id, position")
        .in("playlist_id", playlistIds)
        .order("position", { ascending: true });

      const trackIdsByPlaylist: Record<string, string[]> = {};
      for (const r of relationData || []) {
        if (!trackIdsByPlaylist[r.playlist_id]) {
          trackIdsByPlaylist[r.playlist_id] = [];
        }
        trackIdsByPlaylist[r.playlist_id].push(r.track_id);
      }

      return playlistsData.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description || "",
        trackIds: trackIdsByPlaylist[p.id] || [],
        createdAt: p.created_at ? new Date(p.created_at).getTime() : Date.now(),
        updatedAt: p.updated_at ? new Date(p.updated_at).getTime() : Date.now(),
        isPublic: p.is_public,
        type: p.type || "custom",
        youtubePlaylistId: p.youtube_playlist_id || undefined,
        cover: p.cover || "",
      }));
    } catch (err) {
      console.warn("[PlaylistRepository] getByOwner error:", err);
      return [];
    }
  },

  async create(ownerId: string, playlist: Playlist): Promise<void> {
    const supabase = getSupabase();
    if (!supabase || !ownerId || !playlist) return;
    try {
      await supabase.from("playlists").insert({
        id: playlist.id,
        owner_id: ownerId,
        name: playlist.name,
        description: playlist.description || "",
        is_public: playlist.isPublic !== false,
        type: playlist.type || "custom",
        youtube_playlist_id: playlist.youtubePlaylistId || null,
        cover: playlist.cover || "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn("[PlaylistRepository] create error:", err);
    }
  },

  async rename(playlistId: string, name: string): Promise<void> {
    const supabase = getSupabase();
    if (!supabase || !playlistId) return;
    try {
      await supabase
        .from("playlists")
        .update({ name, updated_at: new Date().toISOString() })
        .eq("id", playlistId);
    } catch (err) {
      console.warn("[PlaylistRepository] rename error:", err);
    }
  },

  async delete(playlistId: string): Promise<void> {
    const supabase = getSupabase();
    if (!supabase || !playlistId) return;
    try {
      await supabase.from("playlist_tracks").delete().eq("playlist_id", playlistId);
      await supabase.from("playlists").delete().eq("id", playlistId);
    } catch (err) {
      console.warn("[PlaylistRepository] delete error:", err);
    }
  },
};
