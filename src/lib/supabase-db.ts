import { getSupabase } from "@/lib/supabase";
import { DEFAULT_BACKGROUND } from "@/lib/backgrounds";
import { getAllUsers } from "@/lib/storage";
import type {
  UserAccount,
  Playlist,
  Track,
  PublicProfile,
  ExploreUser,
  Room,
  RoomRequest,
  BackgroundMetadata,
  Background,
} from "@/lib/types";

/**
 * Clean string utility to ensure consistent user identifiers
 */
export function cleanUsername(username: string): string {
  return (username || "").trim().toLowerCase();
}

/**
 * Cache key used to prevent redundant library re-uploads
 */
const SYNC_CHECKSUM_KEY = "auxy_supabase_synced_hash_v1";

function computeUserHash(user: UserAccount): string {
  try {
    const playlistIds = (user.playlists || []).map((p) => `${p.id}:${p.name}:${(p.trackIds || []).length}`).join(",");
    const libraryCount = (user.library || []).length;
    const bg = user.background?.value || "";
    return `${user.username}:${user.displayName}:${bg}:${user.bio || ""}:${libraryCount}:${playlistIds}`;
  } catch {
    return `${Date.now()}`;
  }
}

export function isTableMissingError(err: unknown): boolean {
  if (!err) return false;
  if (typeof err === "object") {
    const code = (err as { code?: string }).code;
    const msg = String((err as { message?: string }).message || "");
    if (code === "PGRST205" || code === "42P01") return true;
    if (
      msg.includes("schema cache") ||
      msg.includes("Could not find the table") ||
      msg.includes("does not exist") ||
      msg.includes("relation") ||
      msg.includes("not found in schema")
    ) {
      return true;
    }
  }
  return false;
}

// In-memory cooldown cache for missing tables (e.g. 5 minutes) to protect against Supabase rate-limit exhaustion
const missingTablesCooldown = new Map<string, number>();
const MISSING_TABLE_COOLDOWN_MS = 5 * 60 * 1000;

export function markTableMissing(tableName: string) {
  missingTablesCooldown.set(tableName, Date.now() + MISSING_TABLE_COOLDOWN_MS);
}

export function isTableMarkedMissing(tableName: string): boolean {
  const until = missingTablesCooldown.get(tableName);
  if (!until) return false;
  if (Date.now() < until) return true;
  missingTablesCooldown.delete(tableName);
  return false;
}

// ============================================================================
// PROFILES & USER NORMALIZATION (SUPABASE POSTGRESQL)
// ============================================================================

/**
 * Lightweight, direct profile persistence (only username, displayName, avatar, bio, pronouns, background, volume).
 * Does NOT sync or re-upload entire playlist or track libraries.
 */
export async function syncUserProfileOnly(user: {
  id?: string;
  username: string;
  displayName?: string;
  avatar?: string;
  bio?: string;
  pronouns?: string;
  background?: Background;
  volume?: number;
}): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase || !user || !user.username) return false;

  const username = cleanUsername(user.username);
  const userId = user.id || username;
  const bg = user.background || DEFAULT_BACKGROUND;

  try {
    const profileRow = {
      id: userId,
      username,
      display_name: user.displayName || user.username,
      avatar: user.avatar || "",
      bio: user.bio || "",
      pronouns: user.pronouns || "",
      background_id: bg.value || "lava",
      background_metadata: bg,
      volume: typeof user.volume === "number" ? (user.volume > 1 ? user.volume / 100 : user.volume) : 1.0,
      updated_at: new Date().toISOString(),
    };

    const { error: profileError } = await supabase
      .from("profiles")
      .upsert(profileRow, { onConflict: "id" });

    if (profileError) {
      if (isTableMissingError(profileError)) return false;
      const { error: retryError } = await supabase
        .from("profiles")
        .upsert(profileRow, { onConflict: "username" });
      if (retryError) {
        await supabase
          .from("profiles")
          .update({
            display_name: profileRow.display_name,
            avatar: profileRow.avatar,
            bio: profileRow.bio,
            pronouns: profileRow.pronouns,
            background_id: profileRow.background_id,
            background_metadata: profileRow.background_metadata,
            volume: profileRow.volume,
            updated_at: profileRow.updated_at,
          })
          .eq("username", username);
      }
    }
    return true;
  } catch (err) {
    console.warn("[Supabase DB] syncUserProfileOnly error:", err);
    return false;
  }
}

/**
 * Normalizes user account data into Supabase PostgreSQL.
 * Profiles, Playlists, Tracks, and Playlist_Tracks are stored in relational tables.
 * Only syncs when user data has actually changed.
 */
export async function normalizeAndSyncUserProfileToSupabase(
  user: UserAccount,
  force = false
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase || !user || !user.username) return true;

  const currentHash = computeUserHash(user);
  if (!force && typeof window !== "undefined") {
    try {
      const lastHash = localStorage.getItem(SYNC_CHECKSUM_KEY);
      if (lastHash === currentHash) {
        return true; // Already synced, zero network work
      }
    } catch {}
  }

  const userId = user.id || cleanUsername(user.username);

  try {
    // 1. Upsert Profile using fast isolated profile syncer
    await syncUserProfileOnly(user);

    // 2. Normalize and Upsert Playlists and Tracks
    if (Array.isArray(user.playlists) && user.playlists.length > 0) {
      for (const pl of user.playlists) {
        if (!pl || !pl.id) continue;

        // Upsert Playlist
        await supabase.from("playlists").upsert(
          {
            id: pl.id,
            owner_id: userId,
            name: pl.name,
            description: pl.description || "",
            is_public: pl.isPublic !== false,
            type: pl.type || "custom",
            youtube_playlist_id: pl.youtubePlaylistId || null,
            cover: pl.cover || "",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );

        // Upsert Tracks & Relations if playlist contains tracks
        const plTracks: Track[] =
          Array.isArray((pl as unknown as { tracks?: Track[] }).tracks) &&
          ((pl as unknown as { tracks?: Track[] }).tracks?.length ?? 0) > 0
            ? ((pl as unknown as { tracks: Track[] }).tracks)
            : (user.library || []).filter((t) => pl.trackIds?.includes(t.id));

        if (plTracks.length > 0) {
          const trackRows = plTracks.map((t: Track) => ({
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

          // Batch in chunks of 50 to avoid Supabase request payload size limitations
          for (let i = 0; i < trackRows.length; i += 50) {
            const chunk = trackRows.slice(i, i + 50);
            await supabase.from("tracks").upsert(chunk, { onConflict: "id" });
          }

          const relationRows = plTracks.map((t: Track, idx: number) => ({
            playlist_id: pl.id,
            track_id: t.id || `yt-${t.youtubeId}`,
            position: idx,
          }));

          for (let i = 0; i < relationRows.length; i += 50) {
            const chunk = relationRows.slice(i, i + 50);
            await supabase.from("playlist_tracks").upsert(chunk, {
              onConflict: "playlist_id,track_id",
            });
          }
        }
      }
    }

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(SYNC_CHECKSUM_KEY, currentHash);
      } catch {}
    }

    return true;
  } catch (err) {
    if (!isTableMissingError(err)) {
      console.warn("[Supabase DB] normalizeAndSyncUserProfile error:", err);
    }
    return false;
  }
}

// ============================================================================
// TARGETED PROFILE WRITES (ZERO FULL-STATE REWRITES)
// ============================================================================

export async function updateSupabaseProfileVolume(userId: string, volume: number): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !userId) return;
  try {
    await supabase.from("profiles").update({ volume, updated_at: new Date().toISOString() }).eq("id", userId);
  } catch (err) {
    console.warn("[Supabase DB] update volume error:", err);
  }
}

export async function updateSupabaseProfileBio(
  userId: string,
  bio: string,
  pronouns?: string
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !userId) return;
  try {
    const update: Record<string, unknown> = { bio, updated_at: new Date().toISOString() };
    if (pronouns !== undefined) update.pronouns = pronouns;
    await supabase.from("profiles").update(update).eq("id", userId);
  } catch (err) {
    console.warn("[Supabase DB] update bio error:", err);
  }
}

export async function updateSupabaseProfileBackground(
  userId: string,
  background: Background
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !userId || !background) return;
  try {
    await supabase.from("profiles").update({
      background_id: background.value || "lava",
      background_metadata: background,
      updated_at: new Date().toISOString(),
    }).eq("id", userId);
  } catch (err) {
    console.warn("[Supabase DB] update background error:", err);
  }
}

// ============================================================================
// TARGETED PLAYLIST & TRACK OPERATIONS
// ============================================================================

export async function createSupabasePlaylist(ownerId: string, playlist: Playlist): Promise<void> {
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
    console.warn("[Supabase DB] create playlist error:", err);
  }
}

export async function renameSupabasePlaylist(playlistId: string, name: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !playlistId) return;
  try {
    await supabase
      .from("playlists")
      .update({ name, updated_at: new Date().toISOString() })
      .eq("id", playlistId);
  } catch (err) {
    console.warn("[Supabase DB] rename playlist error:", err);
  }
}

export async function deleteSupabasePlaylist(playlistId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !playlistId) return;
  try {
    await supabase.from("playlist_tracks").delete().eq("playlist_id", playlistId);
    await supabase.from("playlists").delete().eq("id", playlistId);
  } catch (err) {
    console.warn("[Supabase DB] delete playlist error:", err);
  }
}

export async function addTrackToSupabasePlaylist(
  playlistId: string,
  track: Track,
  position?: number
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !playlistId || !track) return;
  try {
    const trackId = track.id || `yt-${track.youtubeId}`;
    // Upsert Track record
    await supabase.from("tracks").upsert(
      {
        id: trackId,
        youtube_id: track.youtubeId,
        provider: track.provider || "youtube",
        provider_id: track.providerId || null,
        title: track.title,
        artist: track.artist || "",
        album: track.album || "",
        cover: track.cover || "",
        duration: track.duration || 0,
        source_url: track.sourceUrl || "",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    // Get current track count if position not given
    let pos = position;
    if (pos === undefined) {
      const { count } = await supabase
        .from("playlist_tracks")
        .select("*", { count: "exact", head: true })
        .eq("playlist_id", playlistId);
      pos = count || 0;
    }

    // Insert playlist_tracks relation
    await supabase.from("playlist_tracks").upsert(
      {
        playlist_id: playlistId,
        track_id: trackId,
        position: pos,
      },
      { onConflict: "playlist_id,track_id" }
    );
  } catch (err) {
    console.warn("[Supabase DB] add track error:", err);
  }
}

export async function removeTrackFromSupabasePlaylist(
  playlistId: string,
  trackId: string
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !playlistId || !trackId) return;
  try {
    await supabase
      .from("playlist_tracks")
      .delete()
      .eq("playlist_id", playlistId)
      .eq("track_id", trackId);
  } catch (err) {
    console.warn("[Supabase DB] remove track error:", err);
  }
}

// ============================================================================
// PROFILE & EXPLORE QUERIES (SUPABASE POSTGRESQL)
// ============================================================================

export async function fetchUserProfileFromSupabase(
  userIdOrUsername: string
): Promise<UserAccount | null> {
  const supabase = getSupabase();
  if (!supabase || !userIdOrUsername) return null;

  const clean = cleanUsername(userIdOrUsername);
  try {
    // 1. Fetch Profile row
    const { data: profileData, error: profileErr } = await supabase
      .from("profiles")
      .select("*")
      .or(`id.eq.${userIdOrUsername},username.eq.${clean}`)
      .maybeSingle();

    if (profileErr || !profileData) return null;

    // 2. Fetch User's playlists
    const { data: playlistsData } = await supabase
      .from("playlists")
      .select("*")
      .eq("owner_id", profileData.id);

    const playlists: Playlist[] = [];
    if (Array.isArray(playlistsData)) {
      for (const pl of playlistsData) {
        // Fetch tracks for playlist
        const { data: ptData } = await supabase
          .from("playlist_tracks")
          .select("position, tracks(*)")
          .eq("playlist_id", pl.id)
          .order("position", { ascending: true });

        const tracks: Track[] = (ptData || [])
          .map((item) => {
            const t = item.tracks as unknown as {
              id: string;
              youtube_id: string;
              title: string;
              artist?: string;
              album?: string;
              cover?: string;
              duration?: number;
              provider?: string;
              source_url?: string;
            };
            if (!t) return null;
            return {
              id: t.id,
              youtubeId: t.youtube_id,
              title: t.title,
              artist: t.artist || "",
              album: t.album || "",
              cover: t.cover || "",
              duration: Number(t.duration || 0),
              provider: (t.provider as Track["provider"]) || "youtube",
              sourceUrl: t.source_url || "",
            } as Track;
          })
          .filter(Boolean) as Track[];

        playlists.push({
          id: pl.id,
          name: pl.name,
          description: pl.description || "",
          isPublic: pl.is_public !== false,
          type: (pl.type as "native" | "youtube") || "native",
          youtubePlaylistId: pl.youtube_playlist_id || undefined,
          cover: pl.cover || "",
          trackIds: tracks.map((t) => t.id),
        });
      }
    }

    const user: UserAccount = {
      id: profileData.id,
      username: profileData.username,
      displayName: profileData.display_name || profileData.username,
      avatar: profileData.avatar || "",
      bio: profileData.bio || "",
      pronouns: profileData.pronouns || "",
      background: (profileData.background_metadata as Background) || DEFAULT_BACKGROUND,
      playlists,
      library: [],
      volume: 80,
      createdAt: new Date(profileData.created_at || Date.now()).getTime(),
    };

    return user;
  } catch (err) {
    console.warn("[Supabase DB] fetchUserProfile error:", err);
    return null;
  }
}

export async function fetchPublicProfileFromSupabase(
  username: string
): Promise<PublicProfile | null> {
  const supabase = getSupabase();
  if (!supabase || !username) return null;

  const clean = cleanUsername(username);
  try {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .or(`username.eq.${clean},id.eq.${clean}`)
      .maybeSingle();

    if (error || !profile) return null;

    const starCount = await getStarCountFromSupabase(profile.id || profile.username);

    // Fetch user playlists
    const { data: playlistsData } = await supabase
      .from("playlists")
      .select("*")
      .eq("owner_id", profile.id)
      .eq("is_public", true);

    const publicPlaylists: PublicProfile["playlists"] = [];
    if (Array.isArray(playlistsData)) {
      for (const pl of playlistsData) {
        const { data: ptData } = await supabase
          .from("playlist_tracks")
          .select("position, tracks(*)")
          .eq("playlist_id", pl.id)
          .order("position", { ascending: true });

        const tracks: Track[] = (ptData || [])
          .map((item) => {
            const t = item.tracks as unknown as {
              id: string;
              youtube_id: string;
              title: string;
              artist?: string;
              album?: string;
              cover?: string;
              duration?: number;
              provider?: string;
              source_url?: string;
            };
            if (!t) return null;
            return {
              id: t.id,
              youtubeId: t.youtube_id,
              title: t.title,
              artist: t.artist || "",
              album: t.album || "",
              cover: t.cover || "",
              duration: Number(t.duration || 0),
              provider: (t.provider as Track["provider"]) || "youtube",
              sourceUrl: t.source_url || "",
            } as Track;
          })
          .filter(Boolean) as Track[];

        publicPlaylists.push({
          id: pl.id,
          name: pl.name,
          description: pl.description || "",
          cover: pl.cover || tracks[0]?.cover || "",
          trackCount: tracks.length,
          type: pl.type || "custom",
          youtubePlaylistId: pl.youtube_playlist_id || undefined,
          tracks,
        });
      }
    }

    return {
      id: profile.id || profile.username,
      username: profile.username,
      displayName: profile.display_name || profile.username,
      pronouns: profile.pronouns || "",
      avatar: profile.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${clean}`,
      bio: profile.bio || "",
      background: (profile.background_metadata as Background) || DEFAULT_BACKGROUND,
      starCount,
      isStarred: false,
      playlists: publicPlaylists,
    };
  } catch (err) {
    console.warn("[Supabase DB] fetchPublicProfile error:", err);
    return null;
  }
}

export async function fetchExploreUsersFromSupabase(): Promise<ExploreUser[]> {
  const exploreMap = new Map<string, ExploreUser>();

  // 1. Fetch from server-side multi-client explore registry (shares users & real-time presence across all browsers/devices)
  if (typeof window !== "undefined") {
    try {
      const res = await fetch("/api/explore", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.users)) {
          for (const u of json.users) {
            if (!u || !u.username) continue;
            const uClean = cleanUsername(u.username);
            exploreMap.set(uClean, {
              ...u,
              username: uClean,
              isOnline: Boolean(u.isOnline),
              isLive: Boolean(u.isLive || u.isOnline),
              hasLiveRoom: Boolean(u.hasLiveRoom || u.isOnline),
              isPlaying: Boolean(u.isPlaying && u.currentTrack),
            });
          }
        }
      }
    } catch (apiErr) {
      console.warn("[Explore] Could not load from /api/explore:", apiErr);
    }
  }

  // 2. Populate and merge from local user accounts (ensures local accounts are always included)
  const localUsers = getAllUsers();
  for (const u of localUsers) {
    if (!u || !u.username) continue;
    const uClean = cleanUsername(u.username);
    const existing = exploreMap.get(uClean);
    const bg = u.background || existing?.background || DEFAULT_BACKGROUND;

    exploreMap.set(uClean, {
      id: existing?.id || u.id || uClean,
      username: uClean,
      displayName: u.displayName || existing?.displayName || u.username,
      pronouns: u.pronouns || existing?.pronouns || undefined,
      avatar: u.avatar || existing?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${uClean}`,
      bio: u.bio || existing?.bio || "",
      background: bg,
      starCount: existing?.starCount || 0,
      isOnline: existing?.isOnline ?? true, // If it's a locally active session, keep online state
      isLive: existing?.isLive ?? true,
      hasLiveRoom: existing?.hasLiveRoom ?? true,
      isPlaying: existing?.isPlaying ?? false,
      currentTrack: existing?.currentTrack,
      roomId: existing?.roomId || `room_${uClean}`,
      listenTogetherEnabled: existing?.listenTogetherEnabled ?? true,
      lastSeen: existing?.lastSeen || u.createdAt || Date.now(),
    });

    // Sync local accounts to /api/explore in background
    if (typeof window !== "undefined") {
      void fetch("/api/explore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: u.id,
          username: u.username,
          displayName: u.displayName,
          avatar: u.avatar,
          bio: u.bio,
          pronouns: u.pronouns,
          background: u.background,
        }),
      }).catch(() => {});
    }
  }

  // 3. Fetch and merge remote Supabase profiles & rooms if Supabase is available
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar, bio, pronouns, background_id, background_metadata, created_at, updated_at")
        .order("updated_at", { ascending: false })
        .limit(100);

      // Fetch active rooms from Supabase
      const { data: roomsData } = await supabase
        .from("listen_together_rooms")
        .select("*")
        .eq("enabled", true);

      const activeRooms = new Map<string, Record<string, unknown>>();
      if (Array.isArray(roomsData)) {
        roomsData.forEach((r) => {
          const host = cleanUsername(r.host_username || r.host_id || "");
          if (host) activeRooms.set(host, r);
        });
      }

      if (!error && Array.isArray(profiles)) {
        for (const p of profiles) {
          if (!p || !p.username) continue;
          const uClean = cleanUsername(p.username);
          const activeRoom = activeRooms.get(uClean);
          const currentTrack = (activeRoom?.current_track as Track) || undefined;
          const bg = (p.background_metadata as Background) || {
            kind: "preset",
            value: p.background_id || "lava",
          };

          const existing = exploreMap.get(uClean);

          exploreMap.set(uClean, {
            id: p.id || existing?.id || uClean,
            username: p.username || existing?.username || uClean,
            displayName: p.display_name || existing?.displayName || p.username,
            pronouns: p.pronouns || existing?.pronouns || undefined,
            avatar: p.avatar || existing?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${uClean}`,
            bio: p.bio || existing?.bio || "",
            background: bg || existing?.background || DEFAULT_BACKGROUND,
            starCount: existing?.starCount || 0,
            isOnline: existing?.isOnline ?? !!activeRoom,
            isLive: existing?.isLive ?? !!activeRoom,
            hasLiveRoom: existing?.hasLiveRoom ?? !!activeRoom,
            isPlaying: existing?.isPlaying ?? (activeRoom ? !!activeRoom.is_playing : false),
            currentTrack: existing?.currentTrack || currentTrack,
            roomId: activeRoom ? String(activeRoom.room_id || `room_${uClean}`) : (existing?.roomId || `room_${uClean}`),
            listenTogetherEnabled: activeRoom ? activeRoom.enabled !== false : (existing?.listenTogetherEnabled ?? true),
            lastSeen: Math.max(existing?.lastSeen || 0, new Date(p.updated_at || p.created_at || Date.now()).getTime()),
          });
        }
      }
    } catch (err) {
      console.warn("[Supabase DB] fetchExploreUsers merge error:", err);
    }
  }

  // Sort: playing tracks first, then live/online rooms, then last seen desc
  const result = Array.from(exploreMap.values());
  result.sort((a, b) => {
    if (a.isPlaying && !b.isPlaying) return -1;
    if (!a.isPlaying && b.isPlaying) return 1;
    if (a.isOnline && !b.isOnline) return -1;
    if (!a.isOnline && b.isOnline) return 1;
    if (a.hasLiveRoom && !b.hasLiveRoom) return -1;
    if (!a.hasLiveRoom && b.hasLiveRoom) return 1;
    return (b.lastSeen || 0) - (a.lastSeen || 0);
  });

  return result;
}

// ============================================================================
// STARS SYSTEM (SUPABASE POSTGRESQL)
// ============================================================================

export async function getStarCountFromSupabase(starredUserId: string): Promise<number> {
  const supabase = getSupabase();
  if (!supabase || !starredUserId) return 0;
  try {
    const { count } = await supabase
      .from("stars")
      .select("*", { count: "exact", head: true })
      .eq("starred_user_id", starredUserId);
    return count || 0;
  } catch {
    return 0;
  }
}

export async function getStarStateFromSupabase(
  userId: string | null,
  starredUserId: string
): Promise<{ starred: boolean; count: number }> {
  const supabase = getSupabase();
  if (!supabase || !starredUserId) return { starred: false, count: 0 };

  try {
    const count = await getStarCountFromSupabase(starredUserId);
    let starred = false;
    if (userId) {
      const { data } = await supabase
        .from("stars")
        .select("user_id")
        .eq("user_id", userId)
        .eq("starred_user_id", starredUserId)
        .maybeSingle();
      starred = Boolean(data);
    }
    return { starred, count };
  } catch (err) {
    console.warn("[Supabase DB] getStarState error:", err);
    return { starred: false, count: 0 };
  }
}

export async function toggleStarInSupabase(
  userId: string,
  starredUserId: string
): Promise<{ starred: boolean; count: number }> {
  const supabase = getSupabase();
  if (!supabase || !userId || !starredUserId) return { starred: false, count: 0 };

  try {
    const { data: existing } = await supabase
      .from("stars")
      .select("user_id")
      .eq("user_id", userId)
      .eq("starred_user_id", starredUserId)
      .maybeSingle();

    if (existing) {
      await supabase.from("stars").delete().eq("user_id", userId).eq("starred_user_id", starredUserId);
      const count = await getStarCountFromSupabase(starredUserId);
      return { starred: false, count };
    } else {
      await supabase.from("stars").insert({ user_id: userId, starred_user_id: starredUserId });
      const count = await getStarCountFromSupabase(starredUserId);
      return { starred: true, count };
    }
  } catch (err) {
    console.warn("[Supabase DB] toggleStar error:", err);
    return { starred: false, count: 0 };
  }
}

// ============================================================================
// LISTEN TOGETHER ROOMS & SETTINGS (SUPABASE POSTGRESQL + REALTIME)
// ============================================================================

export function getRoomDocId(username: string): string {
  return "room_" + (username || "").toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

export async function getOrCreateUserRoomInSupabase(
  user: UserAccount,
  initialTrack?: Track | null
): Promise<Room> {
  const username = cleanUsername(user.username);
  const roomId = getRoomDocId(username);
  const now = Date.now();

  const defaultRoom: Room = {
    id: roomId,
    name: `${user.displayName || user.username}'s Room`,
    hostId: user.id || username,
    hostUsername: username,
    hostDisplayName: user.displayName || user.username,
    hostAvatar: user.avatar || "",
    currentTrack: initialTrack || undefined,
    isPlaying: false,
    position: 0,
    participantCount: 1,
    createdAt: now,
    updatedAt: now,
    listenTogetherEnabled: true,
    privacy: "public",
    autoAccept: true,
  };

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("listen_together_rooms")
        .select("*")
        .eq("room_id", roomId)
        .maybeSingle();

      if (error && isTableMissingError(error)) {
        return defaultRoom;
      }

      if (data) {
        return {
          id: data.room_id,
          name: data.name || `${data.host_username || username}'s Room`,
          hostId: data.host_id,
          hostUsername: data.host_username || username,
          hostDisplayName: data.host_display_name || user.displayName || username,
          hostAvatar: data.host_avatar || user.avatar || "",
          isPlaying: !!data.is_playing,
          position: data.position_seconds || 0,
          participantCount: 1,
          listenTogetherEnabled: data.enabled !== false,
          privacy: data.privacy === "friends" ? "friends" : "public",
          autoAccept: data.auto_accept !== false,
          currentTrack: (data.current_track as Track) || initialTrack || undefined,
          createdAt: data.created_at ? new Date(data.created_at).getTime() : now,
          updatedAt: data.updated_at ? new Date(data.updated_at).getTime() : now,
        };
      }

      // Upsert default room
      const { error: upsertErr } = await supabase.from("listen_together_rooms").upsert(
        {
          room_id: roomId,
          host_id: user.id || username,
          host_username: username,
          enabled: true,
          privacy: "public",
          auto_accept: true,
          current_video_id: initialTrack?.youtubeId || "",
          current_track: initialTrack || null,
          created_at: new Date(now).toISOString(),
          updated_at: new Date(now).toISOString(),
        },
        { onConflict: "room_id" }
      );
      if (upsertErr && !isTableMissingError(upsertErr)) {
        console.warn("[Supabase DB] getOrCreateUserRoom upsert error:", upsertErr.message);
      }
    } catch (err) {
      if (!isTableMissingError(err)) {
        console.warn("[Supabase DB] getOrCreateUserRoom error:", err);
      }
    }
  }

  return defaultRoom;
}

export async function updateRoomSettingsInSupabase(
  roomId: string,
  settings: Partial<Pick<Room, "listenTogetherEnabled" | "privacy" | "autoAccept">>
): Promise<void> {
  if (!roomId) return;

  // Sync settings to server store
  if (typeof window !== "undefined") {
    void fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "settings",
        roomId,
        settings: {
          enabled: settings.listenTogetherEnabled,
          privacy: settings.privacy,
          autoAccept: settings.autoAccept,
        },
      }),
    }).catch(() => {});
  }

  const supabase = getSupabase();
  if (!supabase) return;

  try {
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (settings.listenTogetherEnabled !== undefined) update.enabled = settings.listenTogetherEnabled;
    if (settings.privacy !== undefined) update.privacy = settings.privacy;
    if (settings.autoAccept !== undefined) update.auto_accept = settings.autoAccept;

    const { error } = await supabase.from("listen_together_rooms").update(update).eq("room_id", roomId);
    if (error && !isTableMissingError(error)) {
      console.warn("[Supabase DB] updateRoomSettings error:", error.message);
    }
  } catch (err) {
    if (!isTableMissingError(err)) {
      console.warn("[Supabase DB] updateRoomSettings error:", err);
    }
  }
}

// ============================================================================
// JOIN REQUESTS (SERVER STORE API + OPTIONAL SUPABASE POSTGRESQL/REALTIME)
// ============================================================================

export async function createJoinRequestInSupabase(
  hostUsername: string,
  user: { id?: string; username: string; displayName?: string; avatar?: string }
): Promise<{
  status: "auto_accepted" | "pending" | "disabled" | "error";
  requestId?: string;
  roomId: string;
}> {
  const cleanHost = cleanUsername(hostUsername);
  const roomId = getRoomDocId(cleanHost);

  // 1. First attempt central server-store via /api/requests (works universally across clients)
  if (typeof window !== "undefined") {
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          roomId,
          user: {
            id: user.id || user.username,
            username: user.username,
            displayName: user.displayName || user.username,
            avatar: user.avatar || "",
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.status) {
          return {
            status: data.status,
            requestId: data.requestId,
            roomId: data.roomId || roomId,
          };
        }
      }
    } catch {
      // Fallback
    }
  }

  const supabase = getSupabase();
  if (!supabase) {
    const reqId = `req_${user.username}_${Date.now()}`;
    return { status: "pending", requestId: reqId, roomId };
  }

  try {
    // Check host room settings if table exists
    const { data: roomData, error: roomError } = await supabase
      .from("listen_together_rooms")
      .select("enabled, auto_accept, privacy")
      .eq("room_id", roomId)
      .maybeSingle();

    if (roomError && isTableMissingError(roomError)) {
      const reqId = `req_${user.username}_${Date.now()}`;
      return { status: "pending", requestId: reqId, roomId };
    }

    if (roomData) {
      if (roomData.enabled === false) {
        return { status: "disabled", roomId };
      }
      if (roomData.auto_accept === true) {
        return { status: "auto_accepted", roomId };
      }
    }

    const reqId = `req_${user.username}_${Date.now()}`;
    const { error } = await supabase.from("listen_together_requests").upsert(
      {
        id: reqId,
        room_id: roomId,
        user_id: user.id || user.username,
        username: user.username,
        display_name: user.displayName || user.username,
        avatar: user.avatar || "",
        status: "pending",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (error) {
      if (!isTableMissingError(error)) {
        console.warn("[Supabase DB] createJoinRequest error:", error.message);
      }
      return { status: "pending", requestId: reqId, roomId };
    }

    return { status: "pending", requestId: reqId, roomId };
  } catch (err) {
    if (!isTableMissingError(err)) {
      console.warn("[Supabase DB] createJoinRequest error:", err);
    }
    const reqId = `req_${user.username}_${Date.now()}`;
    return { status: "pending", requestId: reqId, roomId };
  }
}

export async function cancelJoinRequestInSupabase(requestId: string): Promise<void> {
  if (!requestId) return;

  if (typeof window !== "undefined") {
    void fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel", requestId }),
    }).catch(() => {});
  }

  const supabase = getSupabase();
  if (!supabase) return;

  try {
    const { error } = await supabase.from("listen_together_requests").delete().eq("id", requestId);
    if (error && !isTableMissingError(error)) {
      console.warn("[Supabase DB] cancelJoinRequest error:", error.message);
    }
  } catch (err) {
    if (!isTableMissingError(err)) {
      console.warn("[Supabase DB] cancelJoinRequest error:", err);
    }
  }
}

export async function respondToJoinRequestInSupabase(
  requestId: string,
  status: "accepted" | "declined"
): Promise<void> {
  if (!requestId) return;

  if (typeof window !== "undefined") {
    void fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "respond", requestId, status }),
    }).catch(() => {});
  }

  const supabase = getSupabase();
  if (!supabase) return;

  try {
    const { error } = await supabase
      .from("listen_together_requests")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", requestId);
    if (error && !isTableMissingError(error)) {
      console.warn("[Supabase DB] respondToJoinRequest error:", error.message);
    }
  } catch (err) {
    if (!isTableMissingError(err)) {
      console.warn("[Supabase DB] respondToJoinRequest error:", err);
    }
  }
}

export function subscribeToRoomRequestsInSupabase(
  roomId: string,
  onUpdate: (requests: RoomRequest[]) => void
): () => void {
  if (!roomId) return () => {};

  let active = true;
  let lastSerialized = "";

  const fetchCurrent = async () => {
    if (!active) return;
    if (typeof document !== "undefined" && document.hidden) return;
    try {
      // 1. Try server-store /api/requests
      if (typeof window !== "undefined") {
        const res = await fetch(`/api/requests?roomId=${encodeURIComponent(roomId)}`, { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          if (active && Array.isArray(json.requests)) {
            const serialized = JSON.stringify(json.requests);
            if (serialized !== lastSerialized) {
              lastSerialized = serialized;
              onUpdate(json.requests);
            }
            return;
          }
        }
      }

      // 2. Try Supabase if table exists
      const supabase = getSupabase();
      if (supabase) {
        const { data, error } = await supabase
          .from("listen_together_requests")
          .select("*")
          .eq("room_id", roomId)
          .eq("status", "pending")
          .order("created_at", { ascending: false });

        if (!error && data && active) {
          const mapped: RoomRequest[] = data.map((r) => ({
            id: r.id,
            roomId: r.room_id,
            userId: r.user_id,
            username: r.username,
            displayName: r.display_name || r.username,
            avatar: r.avatar || "",
            status: (r.status === "declined" ? "declined" : r.status) as "pending" | "accepted" | "declined",
            createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
          }));
          const serialized = JSON.stringify(mapped);
          if (serialized !== lastSerialized) {
            lastSerialized = serialized;
            onUpdate(mapped);
          }
        }
      }
    } catch {}
  };

  void fetchCurrent();
  // Safe fallback polling for host request detection (6s)
  const pollTimer = setInterval(() => {
    void fetchCurrent();
  }, 6000);

  // Supabase Realtime Postgres Changes subscription (gracefully handled)
  const supabase = getSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let channel: any = null;
  if (supabase) {
    try {
      channel = supabase
        .channel(`room-requests-${roomId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "listen_together_requests",
            filter: `room_id=eq.${roomId}`,
          },
          () => {
            void fetchCurrent();
          }
        )
        .subscribe();
    } catch {}
  }

  return () => {
    active = false;
    clearInterval(pollTimer);
    if (supabase && channel) {
      void supabase.removeChannel(channel);
    }
  };
}

export function subscribeToSingleRequestInSupabase(
  requestId: string,
  onUpdate: (request: RoomRequest | null) => void
): () => void {
  if (!requestId) return () => {};

  let active = true;
  let lastSerializedSingle = "";

  const fetchCurrent = async () => {
    if (!active) return;
    if (typeof document !== "undefined" && document.hidden) return;
    try {
      // 1. Try server-store /api/requests
      if (typeof window !== "undefined") {
        const res = await fetch(`/api/requests?requestId=${encodeURIComponent(requestId)}`, { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          if (active && json.request) {
            const ser = JSON.stringify(json.request);
            if (ser !== lastSerializedSingle) {
              lastSerializedSingle = ser;
              onUpdate(json.request);
            }
            if (json.request.status !== "pending") {
              clearInterval(pollTimer);
            }
            return;
          }
        }
      }

      // 2. Try Supabase if table exists
      const supabase = getSupabase();
      if (supabase) {
        const { data, error } = await supabase
          .from("listen_together_requests")
          .select("*")
          .eq("id", requestId)
          .maybeSingle();

        if (!error && data && active) {
          const reqObj: RoomRequest = {
            id: data.id,
            roomId: data.room_id,
            userId: data.user_id,
            username: data.username,
            displayName: data.display_name || data.username,
            avatar: data.avatar || "",
            status: (data.status === "declined" ? "declined" : data.status) as "pending" | "accepted" | "declined",
            createdAt: data.created_at ? new Date(data.created_at).getTime() : Date.now(),
          };
          const ser = JSON.stringify(reqObj);
          if (ser !== lastSerializedSingle) {
            lastSerializedSingle = ser;
            onUpdate(reqObj);
          }
          if (reqObj.status !== "pending") {
            clearInterval(pollTimer);
          }
        }
      }
    } catch {}
  };

  void fetchCurrent();
  const pollTimer = setInterval(() => {
    void fetchCurrent();
  }, 5000);

  // Supabase Realtime Postgres Changes
  const supabase = getSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let channel: any = null;
  if (supabase) {
    try {
      channel = supabase
        .channel(`single-req-${requestId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "listen_together_requests",
            filter: `id=eq.${requestId}`,
          },
          (payload) => {
            if (payload.new && active) {
              const r = payload.new as {
                id: string;
                room_id: string;
                user_id: string;
                username: string;
                display_name?: string;
                avatar?: string;
                status: string;
                created_at?: string;
              };
              onUpdate({
                id: r.id,
                roomId: r.room_id,
                userId: r.user_id,
                username: r.username,
                displayName: r.display_name || r.username,
                avatar: r.avatar || "",
                status: (r.status === "declined" ? "declined" : r.status) as "pending" | "accepted" | "declined",
                createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
              });
            }
          }
        )
        .subscribe();
    } catch {}
  }

  return () => {
    active = false;
    clearInterval(pollTimer);
    if (supabase && channel) {
      void supabase.removeChannel(channel);
    }
  };
}

export function subscribeToRoomInSupabase(
  roomId: string,
  onUpdate: (room: Room | null) => void
): () => void {
  if (!roomId) return () => {};
  const supabase = getSupabase();
  if (!supabase) return () => {};

  const fetchCurrent = async () => {
    try {
      const { data } = await supabase
        .from("listen_together_rooms")
        .select("*")
        .eq("room_id", roomId)
        .maybeSingle();

      if (data) {
        onUpdate({
          id: data.room_id,
          name: data.name || `${data.host_username}'s Room`,
          hostId: data.host_id || data.host_username || "",
          hostUsername: data.host_username || "",
          hostDisplayName: data.host_display_name || data.host_username || "",
          hostAvatar: data.host_avatar || "",
          listenTogetherEnabled: data.enabled !== false,
          privacy: data.privacy === "friends" ? "friends" : "public",
          autoAccept: data.auto_accept !== false,
          currentTrack: (data.current_track as Track) || undefined,
          isPlaying: !!data.is_playing,
          position: data.position_seconds || 0,
          participantCount: 1,
          createdAt: data.created_at ? new Date(data.created_at).getTime() : Date.now(),
          updatedAt: data.updated_at ? new Date(data.updated_at).getTime() : Date.now(),
        });
      }
    } catch {}
  };

  void fetchCurrent();

  // Supabase Realtime Postgres Changes
  const channel = supabase
    .channel(`room-metadata-${roomId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "listen_together_rooms",
        filter: `room_id=eq.${roomId}`,
      },
      () => {
        void fetchCurrent();
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

// ============================================================================
// BACKGROUND METADATA (SUPABASE POSTGRESQL)
// ============================================================================

export async function fetchBackgroundsFromSupabase(): Promise<BackgroundMetadata[]> {
  const supabase = getSupabase();
  if (!supabase || isTableMarkedMissing("backgrounds")) return [];

  try {
    const { data, error } = await supabase
      .from("backgrounds")
      .select("*")
      .eq("active", true)
      .order("created_at", { ascending: false });

    if (error) {
      if (isTableMissingError(error)) {
        markTableMissing("backgrounds");
      }
      return [];
    }
    if (!Array.isArray(data)) return [];

    return data.map((b) => ({
      id: b.id,
      name: b.name,
      videoUrl: b.video_url,
      posterUrl: b.poster_url || "",
      active: b.active !== false,
      version: b.version || 1,
      createdAt: b.created_at ? new Date(b.created_at).getTime() : Date.now(),
      updatedAt: b.updated_at ? new Date(b.updated_at).getTime() : Date.now(),
    }));
  } catch (err) {
    if (isTableMissingError(err)) {
      markTableMissing("backgrounds");
    }
    return [];
  }
}

export async function saveBackgroundMetadataToSupabase(
  bg: BackgroundMetadata
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !bg || isTableMarkedMissing("backgrounds")) return;

  try {
    const { error } = await supabase.from("backgrounds").upsert(
      {
        id: bg.id,
        name: bg.name,
        video_url: bg.videoUrl,
        poster_url: bg.posterUrl || "",
        active: bg.active !== false,
        version: bg.version || 1,
        created_at: new Date(bg.createdAt || Date.now()).toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
    if (error) {
      if (isTableMissingError(error)) {
        markTableMissing("backgrounds");
      }
    }
  } catch (err) {
    if (isTableMissingError(err)) {
      markTableMissing("backgrounds");
    }
  }
}

export async function deleteBackgroundMetadataFromSupabase(idOrUrl: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !idOrUrl || isTableMarkedMissing("backgrounds")) return;

  try {
    const { error } = await supabase.from("backgrounds").delete().or(`id.eq.${idOrUrl},video_url.eq.${idOrUrl}`);
    if (error && isTableMissingError(error)) {
      markTableMissing("backgrounds");
    }
  } catch (err) {
    if (isTableMissingError(err)) {
      markTableMissing("backgrounds");
    }
  }
}

// ============================================================================
// AUTHORITATIVE SOCIAL GRAPH & FRIENDSHIPS (SUPABASE POSTGRESQL)
// ============================================================================

export interface RemoteProfileSearchResult {
  username: string;
  displayName: string;
  avatar: string;
  bio?: string;
  isOnline: boolean;
  friendStatus: "friends" | "pending_sent" | "pending_received" | "none";
  requestId?: string;
}

export interface FriendUserSummary {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  bio?: string;
  isOnline: boolean;
  isPlaying?: boolean;
  currentTrack?: Track;
  roomId: string;
  listenTogetherEnabled?: boolean;
  privacy?: "public" | "friends";
}

export interface SupabasePendingRequest {
  id: string;
  fromUsername: string;
  fromDisplayName?: string;
  fromAvatar?: string;
  toUsername: string;
  toDisplayName?: string;
  toAvatar?: string;
  status: "pending" | "accepted" | "declined";
  createdAt: number;
}

/**
 * Returns canonical pair for friendships table to ensure exactly one unique row per pair:
 * user1 = alphabetically smaller username
 * user2 = alphabetically larger username
 */
export function getCanonicalFriendshipPair(
  userA: string,
  userB: string
): { user1: string; user2: string } {
  const cA = cleanUsername(userA);
  const cB = cleanUsername(userB);
  return cA < cB ? { user1: cA, user2: cB } : { user1: cB, user2: cA };
}

/**
 * Authoritative: Fetches all confirmed friendships from Supabase PostgreSQL
 */
export async function getSupabaseFriendships(username: string): Promise<FriendUserSummary[]> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error("Supabase client is not available. Please verify database configuration.");
  }
  const clean = cleanUsername(username);
  if (!clean) return [];

  // 1. Fetch friendship rows where user1 = clean or user2 = clean
  const { data: friendships, error: fError } = await supabase
    .from("friendships")
    .select("id, user1, user2, created_at")
    .or(`user1.eq.${clean},user2.eq.${clean}`);

  if (fError) {
    console.error("[Supabase DB] getSupabaseFriendships error:", fError);
    throw new Error(`Failed to load friendships from database: ${fError.message}`);
  }

  if (!Array.isArray(friendships) || friendships.length === 0) {
    return [];
  }

  // 2. Resolve other usernames
  const otherUsernames: string[] = [];
  for (const f of friendships) {
    const u1 = cleanUsername(f.user1);
    const u2 = cleanUsername(f.user2);
    const other = u1 === clean ? u2 : u1;
    if (other && !otherUsernames.includes(other)) {
      otherUsernames.push(other);
    }
  }

  if (otherUsernames.length === 0) return [];

  // 3. Query profiles for all other usernames
  const { data: profiles, error: pError } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar, bio, pronouns")
    .in("username", otherUsernames);

  if (pError) {
    console.warn("[Supabase DB] Error querying friend profiles:", pError);
  }

  const profilesMap = new Map<string, {
    id: string;
    username: string;
    display_name?: string;
    avatar?: string;
    bio?: string;
    pronouns?: string;
  }>();

  if (Array.isArray(profiles)) {
    for (const p of profiles) {
      if (p && p.username) {
        profilesMap.set(cleanUsername(p.username), p);
      }
    }
  }

  // 4. Fetch room information for friends
  const { data: roomsData } = await supabase
    .from("listen_together_rooms")
    .select("room_id, host_username, enabled, privacy, current_track, is_playing")
    .in("host_username", otherUsernames);

  const roomsMap = new Map<string, Record<string, unknown>>();
  if (Array.isArray(roomsData)) {
    for (const r of roomsData) {
      if (r && r.host_username) {
        roomsMap.set(cleanUsername(String(r.host_username)), r as unknown as Record<string, unknown>);
      }
    }
  }

  return otherUsernames.map((u) => {
    const p = profilesMap.get(u);
    const r = roomsMap.get(u);
    const isOnline = Boolean(r && r.enabled !== false);
    const isPlaying = Boolean(r && r.is_playing && r.current_track);

    return {
      id: p?.id || u,
      username: u,
      displayName: p?.display_name || u,
      avatar: p?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${u}`,
      bio: p?.bio || "",
      isOnline,
      isPlaying,
      currentTrack: (r?.current_track as Track) || undefined,
      roomId: (r?.room_id as string) || `room_${u}`,
      listenTogetherEnabled: r ? r.enabled !== false : true,
      privacy: r?.privacy === "friends" ? ("friends" as const) : ("public" as const),
    };
  });
}

/**
 * Authoritative: Fetches pending friend requests (received and sent) from Supabase PostgreSQL
 */
export async function getSupabasePendingRequests(username: string): Promise<{
  received: SupabasePendingRequest[];
  sent: SupabasePendingRequest[];
}> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error("Supabase client is not available.");
  }
  const clean = cleanUsername(username);
  if (!clean) return { received: [], sent: [] };

  const [receivedRes, sentRes] = await Promise.all([
    supabase
      .from("friend_requests")
      .select("*")
      .eq("to_username", clean)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase
      .from("friend_requests")
      .select("*")
      .eq("from_username", clean)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);

  if (receivedRes.error) {
    console.error("[Supabase DB] Error loading received requests:", receivedRes.error);
    throw new Error(`Failed to load received friend requests: ${receivedRes.error.message}`);
  }

  if (sentRes.error) {
    console.error("[Supabase DB] Error loading sent requests:", sentRes.error);
    throw new Error(`Failed to load sent friend requests: ${sentRes.error.message}`);
  }

  const received: SupabasePendingRequest[] = (receivedRes.data || []).map((r) => ({
    id: r.id,
    fromUsername: r.from_username,
    fromDisplayName: r.from_display_name || r.from_username,
    fromAvatar: r.from_avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${r.from_username}`,
    toUsername: r.to_username,
    toDisplayName: r.to_display_name || r.to_username,
    toAvatar: r.to_avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${r.to_username}`,
    status: r.status as "pending" | "accepted" | "declined",
    createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
  }));

  const sent: SupabasePendingRequest[] = (sentRes.data || []).map((r) => ({
    id: r.id,
    fromUsername: r.from_username,
    fromDisplayName: r.from_display_name || r.from_username,
    fromAvatar: r.from_avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${r.from_username}`,
    toUsername: r.to_username,
    toDisplayName: r.to_display_name || r.to_username,
    toAvatar: r.to_avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${r.to_username}`,
    status: r.status as "pending" | "accepted" | "declined",
    createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
  }));

  return { received, sent };
}

/**
 * Authoritative: Calculates friendship status directly from Supabase PostgreSQL
 */
export async function getSupabaseFriendshipStatus(
  u1: string,
  u2: string
): Promise<"friends" | "pending_sent" | "pending_received" | "none"> {
  const supabase = getSupabase();
  if (!supabase) return "none";
  const c1 = cleanUsername(u1);
  const c2 = cleanUsername(u2);
  if (!c1 || !c2 || c1 === c2) return "none";

  const { user1, user2 } = getCanonicalFriendshipPair(c1, c2);

  // 1. Check friendship row
  const { data: fData } = await supabase
    .from("friendships")
    .select("id")
    .eq("user1", user1)
    .eq("user2", user2)
    .maybeSingle();

  if (fData) return "friends";

  // 2. Check pending requests
  const { data: sentData } = await supabase
    .from("friend_requests")
    .select("id")
    .eq("from_username", c1)
    .eq("to_username", c2)
    .eq("status", "pending")
    .maybeSingle();

  if (sentData) return "pending_sent";

  const { data: receivedData } = await supabase
    .from("friend_requests")
    .select("id")
    .eq("from_username", c2)
    .eq("to_username", c1)
    .eq("status", "pending")
    .maybeSingle();

  if (receivedData) return "pending_received";

  return "none";
}

/**
 * Authoritative: Searches Supabase PostgreSQL profiles and computes exact friendship status.
 * Searches case-insensitively across username and display_name.
 */
export async function searchSupabaseProfiles(
  query: string,
  currentUsername: string
): Promise<RemoteProfileSearchResult[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const cleanQ = query.trim().toLowerCase();
  const cleanCurrent = cleanUsername(currentUsername);
  if (!cleanQ) return [];

  try {
    // 1. Query matching profiles by username or display_name
    let profiles: Array<{
      id?: string;
      username?: string;
      display_name?: string;
      avatar?: string;
      bio?: string;
    }> = [];

    const { data: orData, error: orError } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar, bio")
      .or(`username.ilike.%${cleanQ}%,display_name.ilike.%${cleanQ}%`)
      .limit(40);

    if (!orError && Array.isArray(orData) && orData.length > 0) {
      profiles = orData;
    } else {
      // Fallback search strategies
      const { data: uData } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar, bio")
        .ilike("username", `%${cleanQ}%`)
        .limit(40);

      if (Array.isArray(uData) && uData.length > 0) {
        profiles = uData;
      } else {
        const { data: dData } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar, bio")
          .ilike("display_name", `%${cleanQ}%`)
          .limit(40);
        if (Array.isArray(dData)) {
          profiles = dData;
        }
      }
    }

    // Filter out current user and duplicates
    const seen = new Set<string>();
    const validProfiles = profiles.filter((p) => {
      if (!p || !p.username) return false;
      const uClean = cleanUsername(p.username);
      if (uClean === cleanCurrent || seen.has(uClean)) return false;
      seen.add(uClean);
      return true;
    });

    if (validProfiles.length === 0) return [];

    if (!cleanCurrent) {
      return validProfiles.map((p) => {
        const uClean = cleanUsername(p.username!);
        return {
          username: p.username!,
          displayName: p.display_name || p.username!,
          avatar: p.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${uClean}`,
          bio: p.bio || undefined,
          isOnline: false,
          friendStatus: "none" as const,
        };
      });
    }

    // 2. Fetch all current user's friendships in a single query
    const { data: userFriendships } = await supabase
      .from("friendships")
      .select("user1, user2")
      .or(`user1.eq.${cleanCurrent},user2.eq.${cleanCurrent}`);

    const friendSet = new Set<string>();
    if (Array.isArray(userFriendships)) {
      for (const f of userFriendships) {
        const u1 = cleanUsername(f.user1);
        const u2 = cleanUsername(f.user2);
        const friend = u1 === cleanCurrent ? u2 : u1;
        if (friend) friendSet.add(friend);
      }
    }

    // 3. Fetch all current user's pending requests in a single query
    const { data: userRequests } = await supabase
      .from("friend_requests")
      .select("id, from_username, to_username, status")
      .eq("status", "pending")
      .or(`from_username.eq.${cleanCurrent},to_username.eq.${cleanCurrent}`);

    const sentRequests = new Map<string, string>(); // toUsername -> requestId
    const receivedRequests = new Map<string, string>(); // fromUsername -> requestId

    if (Array.isArray(userRequests)) {
      for (const pr of userRequests) {
        const fromU = cleanUsername(pr.from_username);
        const toU = cleanUsername(pr.to_username);
        if (fromU === cleanCurrent) {
          sentRequests.set(toU, pr.id);
        } else if (toU === cleanCurrent) {
          receivedRequests.set(fromU, pr.id);
        }
      }
    }

    // 4. Map each profile with authoritative status
    return validProfiles.map((p) => {
      const uName = cleanUsername(p.username!);
      let friendStatus: "friends" | "pending_sent" | "pending_received" | "none" = "none";
      let requestId: string | undefined = undefined;

      if (friendSet.has(uName)) {
        friendStatus = "friends";
      } else if (sentRequests.has(uName)) {
        friendStatus = "pending_sent";
        requestId = sentRequests.get(uName);
      } else if (receivedRequests.has(uName)) {
        friendStatus = "pending_received";
        requestId = receivedRequests.get(uName);
      }

      return {
        username: p.username!,
        displayName: p.display_name || p.username!,
        avatar: p.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${uName}`,
        bio: p.bio || undefined,
        isOnline: false,
        friendStatus,
        requestId,
      };
    });
  } catch (err) {
    console.warn("[Supabase DB] searchSupabaseProfiles error:", err);
    return [];
  }
}

/**
 * Authoritative: Creates a friend request in Supabase friend_requests table.
 * If reverse pending request already exists, automatically accepts into friendships table.
 */
export async function createSupabaseFriendRequest(
  fromUser: { username: string; displayName?: string; avatar?: string },
  toUsername: string
): Promise<{
  success: boolean;
  status: "friends" | "pending_sent";
  requestId?: string;
  error?: string;
}> {
  const supabase = getSupabase();
  if (!supabase) {
    return { success: false, status: "pending_sent", error: "Database not connected" };
  }

  const fromClean = cleanUsername(fromUser.username);
  const toClean = cleanUsername(toUsername);

  if (!fromClean || !toClean) {
    return { success: false, status: "pending_sent", error: "Both usernames are required." };
  }

  if (fromClean === toClean) {
    return { success: false, status: "pending_sent", error: "You cannot send a friend request to yourself." };
  }

  // 1. Verify target user exists in profiles
  const { data: targetProfile, error: targetErr } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar")
    .eq("username", toClean)
    .maybeSingle();

  if (targetErr || !targetProfile) {
    return { success: false, status: "pending_sent", error: `User @${toUsername} does not exist.` };
  }

  // 2. Check if already friends
  const { user1, user2 } = getCanonicalFriendshipPair(fromClean, toClean);
  const { data: existingFriendship } = await supabase
    .from("friendships")
    .select("id")
    .eq("user1", user1)
    .eq("user2", user2)
    .maybeSingle();

  if (existingFriendship) {
    return { success: true, status: "friends" };
  }

  // 3. Check if reverse request exists (toClean -> fromClean). If so, auto-accept!
  const { data: reverseReq } = await supabase
    .from("friend_requests")
    .select("id")
    .eq("from_username", toClean)
    .eq("to_username", fromClean)
    .eq("status", "pending")
    .maybeSingle();

  if (reverseReq) {
    const friendshipId = `friend_${user1}_${user2}`;
    const { error: fErr } = await supabase.from("friendships").upsert(
      {
        id: friendshipId,
        user1,
        user2,
        created_at: new Date().toISOString(),
      },
      { onConflict: "user1,user2" }
    );

    if (fErr) {
      console.error("[Supabase DB] Error auto-accepting friendship:", fErr);
      return { success: false, status: "pending_sent", error: "Could not create friendship." };
    }

    // Clean up request rows
    await supabase.from("friend_requests").delete().eq("id", reverseReq.id);
    await supabase
      .from("friend_requests")
      .delete()
      .eq("from_username", fromClean)
      .eq("to_username", toClean);

    return { success: true, status: "friends" };
  }

  // 4. Check if duplicate pending request was already sent
  const { data: existingReq } = await supabase
    .from("friend_requests")
    .select("id")
    .eq("from_username", fromClean)
    .eq("to_username", toClean)
    .eq("status", "pending")
    .maybeSingle();

  if (existingReq) {
    return { success: true, status: "pending_sent", requestId: existingReq.id };
  }

  // 5. Insert new request
  const reqId = `req_${fromClean}_${toClean}_${Date.now()}`;
  const { error: insertErr } = await supabase.from("friend_requests").insert({
    id: reqId,
    from_username: fromClean,
    from_display_name: fromUser.displayName || fromUser.username,
    from_avatar: fromUser.avatar || "",
    to_username: toClean,
    to_display_name: targetProfile.display_name || targetProfile.username,
    to_avatar: targetProfile.avatar || "",
    status: "pending",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (insertErr) {
    console.error("[Supabase DB] Error inserting friend request:", insertErr);
    return { success: false, status: "pending_sent", error: "Failed to persist friend request." };
  }

  return { success: true, status: "pending_sent", requestId: reqId };
}

/**
 * Authoritative: Responds to a friend request (accept or decline).
 * Verifies recipient ownership in Supabase PostgreSQL.
 */
export async function respondSupabaseFriendRequest(
  requestId: string,
  recipientUsername: string,
  responseAction: "accept" | "decline"
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: "Database not connected" };

  const cleanRecipient = cleanUsername(recipientUsername);
  if (!requestId || !cleanRecipient) {
    return { success: false, error: "Missing requestId or recipient." };
  }

  // 1. Fetch the request
  const { data: req, error: fetchErr } = await supabase
    .from("friend_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();

  if (fetchErr || !req) {
    return { success: false, error: "Friend request not found or already processed." };
  }

  // 2. Authorize: verify User B is actually the recipient
  if (cleanUsername(req.to_username) !== cleanRecipient) {
    return { success: false, error: "You are not authorized to respond to this request." };
  }

  if (responseAction === "accept") {
    const fromClean = cleanUsername(req.from_username);
    const { user1, user2 } = getCanonicalFriendshipPair(fromClean, cleanRecipient);
    const friendshipId = `friend_${user1}_${user2}`;

    // 3. Insert canonical friendship row
    const { error: fErr } = await supabase.from("friendships").upsert(
      {
        id: friendshipId,
        user1,
        user2,
        created_at: new Date().toISOString(),
      },
      { onConflict: "user1,user2" }
    );

    if (fErr) {
      console.error("[Supabase DB] Error inserting friendship row:", fErr);
      return { success: false, error: "Failed to establish friendship in database." };
    }

    // 4. Delete request rows
    await supabase.from("friend_requests").delete().eq("id", requestId);
    await supabase
      .from("friend_requests")
      .delete()
      .eq("from_username", cleanRecipient)
      .eq("to_username", fromClean);

    return { success: true };
  } else {
    // Decline
    await supabase.from("friend_requests").delete().eq("id", requestId);
    return { success: true };
  }
}

/**
 * Authoritative: Cancels a pending friend request.
 * Only the sender is authorized to cancel.
 */
export async function cancelSupabaseFriendRequest(
  senderUsername: string,
  requestId?: string,
  toUsername?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: "Database not connected" };

  const cleanSender = cleanUsername(senderUsername);
  if (!cleanSender) return { success: false, error: "Sender username required." };

  if (requestId) {
    const { data: req } = await supabase
      .from("friend_requests")
      .select("from_username")
      .eq("id", requestId)
      .maybeSingle();

    if (!req) return { success: true }; // already gone
    if (cleanUsername(req.from_username) !== cleanSender) {
      return { success: false, error: "You are not authorized to cancel this request." };
    }
    await supabase.from("friend_requests").delete().eq("id", requestId);
    return { success: true };
  }

  if (toUsername) {
    const cleanTo = cleanUsername(toUsername);
    await supabase
      .from("friend_requests")
      .delete()
      .eq("from_username", cleanSender)
      .eq("to_username", cleanTo);
    return { success: true };
  }

  return { success: false, error: "requestId or toUsername required." };
}

/**
 * Authoritative: Removes a friendship.
 * Verifies that the authenticated user belongs to the friendship.
 */
export async function removeSupabaseFriendship(
  userA: string,
  userB: string,
  authenticatedUsername: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: "Database not connected" };

  const cA = cleanUsername(userA);
  const cB = cleanUsername(userB);
  const authUser = cleanUsername(authenticatedUsername);

  if (!authUser || (authUser !== cA && authUser !== cB)) {
    return { success: false, error: "Not authorized to remove this friendship." };
  }

  const { user1, user2 } = getCanonicalFriendshipPair(cA, cB);
  const { error } = await supabase
    .from("friendships")
    .delete()
    .eq("user1", user1)
    .eq("user2", user2);

  if (error) {
    console.error("[Supabase DB] Error removing friendship:", error);
    return { success: false, error: "Failed to remove friendship." };
  }

  return { success: true };
}

/**
 * Authoritative: Admin deletion of user across Supabase tables
 */
export async function deleteSupabaseUserCompletely(username: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase || !username) return false;
  const clean = cleanUsername(username);

  try {
    // Delete friendships
    await supabase.from("friendships").delete().or(`user1.eq.${clean},user2.eq.${clean}`);
    // Delete friend requests
    await supabase.from("friend_requests").delete().or(`from_username.eq.${clean},to_username.eq.${clean}`);
    // Delete rooms & room requests
    await supabase.from("listen_together_rooms").delete().eq("host_username", clean);
    await supabase.from("listen_together_requests").delete().or(`username.eq.${clean},room_id.eq.room_${clean}`);
    // Delete playlists owned by user
    await supabase.from("playlists").delete().eq("owner_id", clean);
    // Delete profile
    const { error } = await supabase.from("profiles").delete().or(`username.eq.${clean},id.eq.${clean}`);
    if (error) {
      console.warn("[Supabase DB] delete user error:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[Supabase DB] delete user error:", err);
    return false;
  }
}



