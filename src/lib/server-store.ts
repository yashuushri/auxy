import fs from "fs";
import path from "path";
import type { Background, BackgroundMetadata, ExploreUser, PublicProfile, Room, RoomRequest, Track, UserAccount } from "@/lib/types";

interface PresenceRecord {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  bio?: string;
  pronouns?: string;
  background?: Background;
  starCount?: number;
  lastSeen: number;
  isOnline: boolean;
  isPlaying: boolean;
  currentTrack?: Track;
  roomId: string;
  listenTogetherEnabled: boolean;
  participantCount?: number;
}

interface RoomSettingsRecord {
  roomId: string;
  enabled: boolean;
  privacy: "public" | "friends";
  autoAccept: boolean;
}

export interface LivePlaybackState {
  roomId: string;
  hostUsername: string;
  hostDisplayName?: string;
  hostAvatar?: string;
  currentTrack?: Track | null;
  isPlaying: boolean;
  positionSeconds: number;
  updatedAt: number;
  playlistTracks?: Track[];
  playlistName?: string;
  playlistId?: string;
  background?: Background;
  stateVersion: number;
}

export interface FriendRequestRecord {
  id: string;
  fromUsername: string;
  fromDisplayName: string;
  fromAvatar: string;
  toUsername: string;
  toDisplayName: string;
  toAvatar: string;
  status: "pending" | "accepted" | "declined";
  createdAt: number;
}

interface ServerStoreState {
  users: Map<string, UserAccount>;
  presence: Map<string, PresenceRecord>;
  rooms: Map<string, Room>;
  requests: Map<string, RoomRequest>;
  roomSettings: Map<string, RoomSettingsRecord>;
  liveRooms: Map<string, LivePlaybackState>;
  friendships: Map<string, Set<string>>;
  friendRequests: Map<string, FriendRequestRecord>;
  backgrounds: Map<string, BackgroundMetadata>;
}

const globalStore = globalThis as unknown as {
  _auxy_server_store?: ServerStoreState;
};

function getStorageFilePath(): string {
  const dataDir = path.join(process.cwd(), ".data");
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  } catch {
    // Ignore in read-only environments
  }
  return path.join(dataDir, "server-state.json");
}

function loadPersistedState(): {
  users: UserAccount[];
  rooms: Room[];
  friendships?: Record<string, string[]>;
  friendRequests?: FriendRequestRecord[];
  backgrounds?: BackgroundMetadata[];
} {
  try {
    const filePath = getStorageFilePath();
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      return {
        users: Array.isArray(parsed.users) ? parsed.users : [],
        rooms: Array.isArray(parsed.rooms) ? parsed.rooms : [],
        friendships: parsed.friendships && typeof parsed.friendships === "object" ? parsed.friendships : {},
        friendRequests: Array.isArray(parsed.friendRequests) ? parsed.friendRequests : [],
        backgrounds: Array.isArray(parsed.backgrounds) ? parsed.backgrounds : [],
      };
    }
  } catch (err) {
    console.warn("[ServerStore] Could not load persisted server state:", err);
  }
  return { users: [], rooms: [], friendships: {}, friendRequests: [], backgrounds: [] };
}

function persistStateThrottled(): void {
  try {
    const filePath = getStorageFilePath();
    const usersArr = Array.from(getServerStore().users.values());
    const roomsArr = Array.from(getServerStore().rooms.values());
    const friendshipsObj: Record<string, string[]> = {};
    for (const [u, set] of getServerStore().friendships.entries()) {
      friendshipsObj[u] = Array.from(set);
    }
    const friendRequestsArr = Array.from(getServerStore().friendRequests.values());
    const backgroundsArr = Array.from(new Set(getServerStore().backgrounds.values()));
    fs.writeFileSync(
      filePath,
      JSON.stringify(
        {
          users: usersArr,
          rooms: roomsArr,
          friendships: friendshipsObj,
          friendRequests: friendRequestsArr,
          backgrounds: backgroundsArr,
        },
        null,
        2
      ),
      "utf-8"
    );
  } catch (err) {
    console.warn("[ServerStore] Could not persist server state:", err);
  }
}

let persistTimer: NodeJS.Timeout | null = null;
function schedulePersist(): void {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    persistStateThrottled();
  }, 2000);
}

export function getServerStore(): ServerStoreState {
  if (!globalStore._auxy_server_store) {
    const loaded = loadPersistedState();
    const usersMap = new Map<string, UserAccount>();
    const roomsMap = new Map<string, Room>();
    const friendshipsMap = new Map<string, Set<string>>();
    const friendRequestsMap = new Map<string, FriendRequestRecord>();
    const backgroundsMap = new Map<string, BackgroundMetadata>();

    if (Array.isArray(loaded.backgrounds)) {
      for (const bg of loaded.backgrounds) {
        if (bg && bg.id && !bg.videoUrl?.includes("blob.vercel-storage.com")) {
          backgroundsMap.set(bg.id, bg);
          if (bg.videoUrl) backgroundsMap.set(bg.videoUrl, bg);
        }
      }
    }

    if (loaded.friendships) {
      for (const [u, list] of Object.entries(loaded.friendships)) {
        if (Array.isArray(list)) {
          friendshipsMap.set(u.toLowerCase(), new Set(list.map((x) => x.toLowerCase())));
        }
      }
    }

    if (Array.isArray(loaded.friendRequests)) {
      for (const req of loaded.friendRequests) {
        if (req && req.id) {
          friendRequestsMap.set(req.id, req);
        }
      }
    }

    for (const u of loaded.users) {
      if (u && u.username) {
        const cleanName = u.username.trim().toLowerCase();
        if (cleanName === "dealuphymindgmailcom" || u.email?.toLowerCase() === "dealup.hymind@gmail.com") {
          usersMap.set("aman", { ...u, username: "aman" });
        } else {
          usersMap.set(cleanName, u);
        }
      }
    }
    usersMap.delete("dealuphymindgmailcom");
    for (const r of loaded.rooms) {
      if (r && r.id) {
        roomsMap.set(r.id, r);
      }
    }

    globalStore._auxy_server_store = {
      users: usersMap,
      presence: new Map<string, PresenceRecord>(),
      rooms: roomsMap,
      requests: new Map<string, RoomRequest>(),
      roomSettings: new Map<string, RoomSettingsRecord>(),
      liveRooms: new Map<string, LivePlaybackState>(),
      friendships: friendshipsMap,
      friendRequests: friendRequestsMap,
      backgrounds: backgroundsMap,
    };
    seedDefaultCommunityRooms(globalStore._auxy_server_store);
  } else {
    if (!globalStore._auxy_server_store.backgrounds) {
      globalStore._auxy_server_store.backgrounds = new Map<string, BackgroundMetadata>();
    }
    // Ensure legacy buggy key is cleaned up in existing in-memory store
    if (globalStore._auxy_server_store.users.has("dealuphymindgmailcom")) {
      const old = globalStore._auxy_server_store.users.get("dealuphymindgmailcom");
      globalStore._auxy_server_store.users.delete("dealuphymindgmailcom");
      if (old && !globalStore._auxy_server_store.users.has("aman")) {
        old.username = "aman";
        globalStore._auxy_server_store.users.set("aman", old);
      }
    }
    // Ensure all maps exist in case of hot-reload with older in-memory store object
    if (!globalStore._auxy_server_store.requests) {
      globalStore._auxy_server_store.requests = new Map<string, RoomRequest>();
    }
    if (!globalStore._auxy_server_store.roomSettings) {
      globalStore._auxy_server_store.roomSettings = new Map<string, RoomSettingsRecord>();
    }
    if (!globalStore._auxy_server_store.presence) {
      globalStore._auxy_server_store.presence = new Map<string, PresenceRecord>();
    }
    if (!globalStore._auxy_server_store.users) {
      globalStore._auxy_server_store.users = new Map<string, UserAccount>();
    }
    if (!globalStore._auxy_server_store.rooms) {
      globalStore._auxy_server_store.rooms = new Map<string, Room>();
    }
    if (!globalStore._auxy_server_store.liveRooms) {
      globalStore._auxy_server_store.liveRooms = new Map<string, LivePlaybackState>();
    }
    if (!globalStore._auxy_server_store.friendships) {
      globalStore._auxy_server_store.friendships = new Map<string, Set<string>>();
    }
    if (!globalStore._auxy_server_store.friendRequests) {
      globalStore._auxy_server_store.friendRequests = new Map<string, FriendRequestRecord>();
    }
    if (globalStore._auxy_server_store.users.size < 6) {
      seedDefaultCommunityRooms(globalStore._auxy_server_store);
    }
  }
  return globalStore._auxy_server_store;
}

export function registerOrUpdateUserInServerStore(user: Partial<UserAccount> & { username: string }): void {
  if (!user || !user.username) return;
  const store = getServerStore();
  const clean = user.username.trim().toLowerCase();
  const existing = store.users.get(clean);

  const merged: UserAccount = {
    id: user.id || existing?.id || `usr_${Date.now()}`,
    discordId: user.discordId || existing?.discordId,
    username: clean,
    displayName: user.displayName || existing?.displayName || user.username,
    email: user.email || existing?.email || `${clean}@auxy.app`,
    emailVerified: user.emailVerified ?? existing?.emailVerified ?? true,
    password: user.password || existing?.password,
    avatar: user.avatar || existing?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${clean}`,
    bio: user.bio ?? existing?.bio ?? "",
    pronouns: user.pronouns ?? existing?.pronouns ?? "",
    background: user.background || existing?.background || { kind: "preset", value: "lava" },
    volume: user.volume ?? existing?.volume ?? 80,
    playlists: user.playlists || existing?.playlists || [],
    library: user.library || existing?.library || [],
    createdAt: existing?.createdAt || user.createdAt || Date.now(),
  };

  store.users.set(clean, merged);
  schedulePersist();
}

export function getUserFromServerStore(username: string): UserAccount | null {
  if (!username) return null;
  const store = getServerStore();
  return store.users.get(username.trim().toLowerCase()) || null;
}

export function getUserByEmailFromServerStore(email: string): UserAccount | null {
  if (!email) return null;
  const cleanEmail = email.trim().toLowerCase();
  const store = getServerStore();
  for (const user of store.users.values()) {
    if (user.email?.trim().toLowerCase() === cleanEmail) {
      return user;
    }
  }
  return null;
}

export function getUserByIdentifierFromServerStore(identifier: string): UserAccount | null {
  if (!identifier) return null;
  const clean = identifier.trim().toLowerCase();
  const store = getServerStore();

  // Special alias migration for dealuphymindgmailcom -> aman
  if (clean === "dealuphymindgmailcom") {
    for (const user of store.users.values()) {
      if (user.email?.toLowerCase() === "dealup.hymind@gmail.com") {
        return user;
      }
    }
  }

  // 1. Direct username lookup
  const byUsername = store.users.get(clean);
  if (byUsername) return byUsername;

  // 2. Email lookup
  for (const user of store.users.values()) {
    if (user.email?.trim().toLowerCase() === clean) {
      return user;
    }
  }

  // 3. Fallback: stripped clean username lookup
  const cleanStripped = clean.replace(/[^a-z0-9_-]/g, "");
  if (cleanStripped && store.users.has(cleanStripped)) {
    return store.users.get(cleanStripped) || null;
  }

  // 4. Display name or case-insensitive search
  for (const user of store.users.values()) {
    if (user.displayName?.trim().toLowerCase() === clean) {
      return user;
    }
  }

  return null;
}

export function recordPresenceHeartbeat(data: {
  username: string;
  userId?: string;
  displayName?: string;
  avatar?: string;
  bio?: string;
  pronouns?: string;
  background?: Background;
  isPlaying?: boolean;
  currentTrack?: Track | null;
  roomId?: string;
  listenTogetherEnabled?: boolean;
  isOffline?: boolean;
}): void {
  if (!data || !data.username) return;
  const store = getServerStore();
  const clean = data.username.trim().toLowerCase();
  const now = Date.now();

  // Register in user accounts as well
  registerOrUpdateUserInServerStore({
    username: clean,
    id: data.userId,
    displayName: data.displayName,
    avatar: data.avatar,
    bio: data.bio,
    pronouns: data.pronouns,
    background: data.background,
  });

  if (data.isOffline) {
    const existing = store.presence.get(clean);
    if (existing) {
      existing.isOnline = false;
      existing.isPlaying = false;
      existing.lastSeen = now;
    }
    return;
  }

  const roomId = data.roomId || `room_${clean}`;
  store.presence.set(clean, {
    id: data.userId || clean,
    username: clean,
    displayName: data.displayName || clean,
    avatar: data.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${clean}`,
    bio: data.bio || "",
    pronouns: data.pronouns,
    background: data.background,
    lastSeen: now,
    isOnline: true,
    isPlaying: Boolean(data.isPlaying && data.currentTrack),
    currentTrack: data.currentTrack || undefined,
    roomId,
    listenTogetherEnabled: data.listenTogetherEnabled !== false,
  });
}

const ONLINE_TIMEOUT_MS = 45_000; // 45 seconds

export function getAllExploreUsersFromServerStore(): ExploreUser[] {
  const store = getServerStore();
  const now = Date.now();
  const exploreMap = new Map<string, ExploreUser>();

  // 1. Populate from all known users
  for (const [clean, user] of store.users.entries()) {
    const presence = store.presence.get(clean);
    const isRecentlyActive = presence ? now - presence.lastSeen < ONLINE_TIMEOUT_MS && presence.isOnline : false;

    exploreMap.set(clean, {
      id: user.id || clean,
      username: user.username,
      displayName: user.displayName || user.username,
      pronouns: user.pronouns,
      avatar: user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${clean}`,
      bio: user.bio || "",
      background: user.background,
      starCount: 0,
      isOnline: isRecentlyActive,
      isLive: isRecentlyActive,
      hasLiveRoom: isRecentlyActive,
      isPlaying: isRecentlyActive ? Boolean(presence?.isPlaying && presence?.currentTrack) : false,
      currentTrack: isRecentlyActive ? presence?.currentTrack : undefined,
      roomId: presence?.roomId || `room_${clean}`,
      listenTogetherEnabled: presence ? presence.listenTogetherEnabled : true,
      lastSeen: presence?.lastSeen || user.createdAt || now,
    });
  }

  // 2. Add any presence entries that might not yet be in users map
  for (const [clean, pres] of store.presence.entries()) {
    const isRecentlyActive = now - pres.lastSeen < ONLINE_TIMEOUT_MS && pres.isOnline;
    if (!exploreMap.has(clean)) {
      exploreMap.set(clean, {
        id: pres.id || clean,
        username: pres.username,
        displayName: pres.displayName,
        pronouns: pres.pronouns,
        avatar: pres.avatar,
        bio: pres.bio,
        background: pres.background,
        starCount: 0,
        isOnline: isRecentlyActive,
        isLive: isRecentlyActive,
        hasLiveRoom: isRecentlyActive,
        isPlaying: isRecentlyActive ? pres.isPlaying : false,
        currentTrack: isRecentlyActive ? pres.currentTrack : undefined,
        roomId: pres.roomId,
        listenTogetherEnabled: pres.listenTogetherEnabled,
        lastSeen: pres.lastSeen,
      });
    }
  }

  const list = Array.from(exploreMap.values());
  // Sort active/live/playing first, then by lastSeen desc
  list.sort((a, b) => {
    if (a.isPlaying && !b.isPlaying) return -1;
    if (!a.isPlaying && b.isPlaying) return 1;
    if (a.isOnline && !b.isOnline) return -1;
    if (!a.isOnline && b.isOnline) return 1;
    return (b.lastSeen || 0) - (a.lastSeen || 0);
  });

  return list;
}

export function getPublicProfileFromServerStore(username: string): PublicProfile | null {
  if (!username) return null;
  const user = getUserFromServerStore(username);
  if (!user) return null;

  return {
    id: user.id || user.username,
    username: user.username,
    displayName: user.displayName || user.username,
    pronouns: user.pronouns,
    avatar: user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`,
    bio: user.bio || "",
    background: user.background || { kind: "preset", value: "lava" },
    starCount: 0,
    isStarred: false,
    playlists: (user.playlists || []).map((pl) => ({
      id: pl.id,
      name: pl.name,
      description: pl.description,
      cover: pl.cover,
      trackCount: pl.trackIds?.length || 0,
      type: pl.youtubePlaylistId ? "youtube" : "native",
      youtubePlaylistId: pl.youtubePlaylistId,
      tracks: [],
    })),
  };
}

export function saveRoomRequest(req: RoomRequest): void {
  const store = getServerStore();
  store.requests.set(req.id, req);
}

export function getRoomRequests(roomId: string): RoomRequest[] {
  const store = getServerStore();
  const list: RoomRequest[] = [];
  for (const r of store.requests.values()) {
    if (r.roomId === roomId && r.status === "pending") {
      list.push(r);
    }
  }
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

export function getSingleRoomRequest(requestId: string): RoomRequest | null {
  const store = getServerStore();
  return store.requests.get(requestId) || null;
}

export function updateRoomRequestStatus(
  requestId: string,
  status: "accepted" | "declined"
): void {
  const store = getServerStore();
  const req = store.requests.get(requestId);
  if (req) {
    req.status = status;
    store.requests.set(requestId, req);
  }
}

export function deleteRoomRequest(requestId: string): void {
  const store = getServerStore();
  store.requests.delete(requestId);
}

export function updateServerRoomSettings(
  roomId: string,
  settings: {
    enabled?: boolean;
    privacy?: "public" | "friends";
    autoAccept?: boolean;
  }
): void {
  const store = getServerStore();
  const current = store.roomSettings.get(roomId) || {
    roomId,
    enabled: true,
    privacy: "friends",
    autoAccept: false,
  };
  if (settings.enabled !== undefined) current.enabled = settings.enabled;
  if (settings.privacy !== undefined) current.privacy = settings.privacy;
  if (settings.autoAccept !== undefined) current.autoAccept = false; // Always manual
  store.roomSettings.set(roomId, current);
}

export function getServerRoomSettings(roomId: string): {
  roomId: string;
  enabled: boolean;
  privacy: "public" | "friends";
  autoAccept: boolean;
} {
  const store = getServerStore();
  return (
    store.roomSettings.get(roomId) || {
      roomId,
      enabled: true,
      privacy: "friends",
      autoAccept: false,
    }
  );
}

export function getLiveRoomState(roomIdOrUsername: string): LivePlaybackState | null {
  if (!roomIdOrUsername) return null;
  const store = getServerStore();
  const clean = roomIdOrUsername.trim().toLowerCase();
  
  // Try direct roomId lookup
  let live = store.liveRooms.get(clean);
  
  // Try lookup by hostUsername
  if (!live) {
    for (const item of store.liveRooms.values()) {
      if (
        item.hostUsername?.toLowerCase() === clean ||
        item.roomId?.toLowerCase() === clean ||
        item.roomId?.toLowerCase() === `room_${clean}`
      ) {
        live = item;
        break;
      }
    }
  }

  // Fallback: check presence record for this user
  if (!live) {
    const presence = store.presence.get(clean);
    if (presence && presence.currentTrack) {
      live = {
        roomId: presence.roomId || `room_${clean}`,
        hostUsername: presence.username,
        hostDisplayName: presence.displayName,
        hostAvatar: presence.avatar,
        currentTrack: presence.currentTrack,
        isPlaying: presence.isPlaying,
        positionSeconds: 0,
        updatedAt: presence.lastSeen || Date.now(),
        background: presence.background,
        stateVersion: 1,
      };
      store.liveRooms.set(live.roomId, live);
    }
  }

  if (!live) return null;

  // Calculate current elapsed position if playing
  const elapsed = live.isPlaying && live.updatedAt
    ? Math.max(0, (Date.now() - live.updatedAt) / 1000)
    : 0;
  
  const currentPos = Math.max(0, (live.positionSeconds || 0) + elapsed);

  return {
    ...live,
    positionSeconds: Math.round(currentPos * 10) / 10,
  };
}

export function updateLiveRoomState(
  update: Partial<LivePlaybackState> & { roomId: string; hostUsername: string }
): LivePlaybackState {
  const store = getServerStore();
  const roomId = update.roomId;
  const existing = store.liveRooms.get(roomId);
  const now = Date.now();

  const merged: LivePlaybackState = {
    roomId,
    hostUsername: update.hostUsername.toLowerCase(),
    hostDisplayName: update.hostDisplayName || existing?.hostDisplayName || update.hostUsername,
    hostAvatar: update.hostAvatar || existing?.hostAvatar,
    currentTrack: update.currentTrack !== undefined ? update.currentTrack : existing?.currentTrack,
    isPlaying: update.isPlaying !== undefined ? update.isPlaying : (existing?.isPlaying ?? false),
    positionSeconds: update.positionSeconds !== undefined ? update.positionSeconds : (existing?.positionSeconds ?? 0),
    updatedAt: now,
    playlistTracks: update.playlistTracks || existing?.playlistTracks || [],
    playlistName: update.playlistName || existing?.playlistName,
    playlistId: update.playlistId || existing?.playlistId,
    background: update.background || existing?.background,
    stateVersion: (existing?.stateVersion || 0) + 1,
  };

  store.liveRooms.set(roomId, merged);
  // Also index by room_username
  store.liveRooms.set(`room_${update.hostUsername.toLowerCase()}`, merged);

  return merged;
}

function seedDefaultCommunityRooms(store: ServerStoreState): void {
  const now = Date.now();

  const cyberTrack: Track = {
    id: "track_cyber_1",
    youtubeId: "4xDzrJKXOOY",
    title: "Synthwave Radio (Chill Beats)",
    artist: "Lofi Records",
    album: "Retrowave Odyssey",
    cover: "https://img.youtube.com/vi/4xDzrJKXOOY/hqdefault.jpg",
    duration: 3600,
  };

  const lunaTrack: Track = {
    id: "track_luna_1",
    youtubeId: "jfKfPfyJRdk",
    title: "Lofi Girl (Beats to Relax/Study)",
    artist: "Lofi Records",
    album: "Study Session",
    cover: "https://img.youtube.com/vi/jfKfPfyJRdk/hqdefault.jpg",
    duration: 3600,
  };

  const pulseTrack: Track = {
    id: "track_pulse_1",
    youtubeId: "5rm434OjU4I",
    title: "Resonance",
    artist: "HOME",
    album: "Odyssey",
    cover: "https://img.youtube.com/vi/5rm434OjU4I/hqdefault.jpg",
    duration: 212,
  };

  const defaultUsers: Array<{
    username: string;
    displayName: string;
    bio: string;
    pronouns?: string;
    avatar: string;
    background: Background;
    track: Track;
    position: number;
    starCount?: number;
  }> = [
    {
      username: "cyber",
      displayName: "Cyber Runner",
      bio: "Cruising neon highways with retrowave and synthwave grooves.",
      pronouns: "he/him",
      avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=cyber",
      background: { kind: "preset", value: "lava" },
      track: cyberTrack,
      position: 120,
      starCount: 14,
    },
    {
      username: "luna",
      displayName: "Luna 🌙",
      bio: "Midnight lofi vibes, warm tea, and rainy coding sessions.",
      pronouns: "she/her",
      avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=luna",
      background: { kind: "preset", value: "#0b0b12" },
      track: lunaTrack,
      position: 240,
      starCount: 28,
    },
    {
      username: "pulse",
      displayName: "Pulse ⚡",
      bio: "Deep sonic beats and chillwave ambient waves.",
      pronouns: "they/them",
      avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=pulse",
      background: { kind: "preset", value: "#141424" },
      track: pulseTrack,
      position: 45,
      starCount: 9,
    },
    {
      username: "zen_beats",
      displayName: "Zen Beats 🍵",
      bio: "Mindful chillhop, peaceful meditation, and acoustic morning coffee.",
      pronouns: "he/him",
      avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=zen_beats",
      background: { kind: "preset", value: "#0d1b1e" },
      track: {
        id: "track_zen_1",
        youtubeId: "5yx6BWlEVcY",
        title: "Chillhop Radio - Jazzy & Lofi Hip Hop",
        artist: "Chillhop Music",
        album: "Coffeehouse Sessions",
        cover: "https://img.youtube.com/vi/5yx6BWlEVcY/hqdefault.jpg",
        duration: 3600,
      },
      position: 310,
      starCount: 19,
    },
    {
      username: "alex_lofi",
      displayName: "Alex Lofi 🎧",
      bio: "Late night coding playlists, vintage vinyl warmth, and rainy window panes.",
      pronouns: "they/he",
      avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=alex_lofi",
      background: { kind: "preset", value: "#1a102f" },
      track: {
        id: "track_alex_1",
        youtubeId: "TURbeWK2wwg",
        title: "Japanese Garden - Asian Lofi Chill",
        artist: "Tokyo Nights",
        album: "Zen Garden",
        cover: "https://img.youtube.com/vi/TURbeWK2wwg/hqdefault.jpg",
        duration: 2400,
      },
      position: 85,
      starCount: 12,
    },
    {
      username: "kai_soundscapes",
      displayName: "Kai Soundscapes 🌊",
      bio: "Coastal ambient textures, melodic downtempo, and deep flow state rhythms.",
      pronouns: "he/him",
      avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=kai_soundscapes",
      background: { kind: "preset", value: "#061826" },
      track: {
        id: "track_kai_1",
        youtubeId: "DWcJFNfaw9c",
        title: "Sleep & Deep Focus Ambient Music",
        artist: "Yellow Brick Cinema",
        album: "Ocean Waves",
        cover: "https://img.youtube.com/vi/DWcJFNfaw9c/hqdefault.jpg",
        duration: 7200,
      },
      position: 180,
      starCount: 22,
    },
    {
      username: "mira_vibes",
      displayName: "Mira Vibes ✨",
      bio: "Indie dream-pop, bedroom lofi, and golden hour melodies.",
      pronouns: "she/they",
      avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=mira_vibes",
      background: { kind: "preset", value: "#260c1a" },
      track: {
        id: "track_mira_1",
        youtubeId: "2atQnvunGCo",
        title: "Golden Hour - Indie Chill Beats",
        artist: "Sunset Collective",
        album: "Afterglow",
        cover: "https://img.youtube.com/vi/2atQnvunGCo/hqdefault.jpg",
        duration: 1800,
      },
      position: 60,
      starCount: 17,
    },
    {
      username: "elena_synth",
      displayName: "Elena Synth 🎹",
      bio: "Hardware modular synths, analog tape delays, and cyberpunk nightscapes.",
      pronouns: "she/her",
      avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=elena_synth",
      background: { kind: "preset", value: "lava" },
      track: {
        id: "track_elena_1",
        youtubeId: "MVPTGNGiI-4",
        title: "Night City - Synthwave Chill",
        artist: "Retro Dreamer",
        album: "Neon Grid",
        cover: "https://img.youtube.com/vi/MVPTGNGiI-4/hqdefault.jpg",
        duration: 2100,
      },
      position: 140,
      starCount: 31,
    },
    {
      username: "ryu_ambient",
      displayName: "Ryu 🎋",
      bio: "Traditional koto & flute meets soft ambient hip hop. Tokyo soundscape.",
      pronouns: "he/him",
      avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=ryu_ambient",
      background: { kind: "preset", value: "#0e1a14" },
      track: {
        id: "track_ryu_1",
        youtubeId: "81wbz6eE6yU",
        title: "Kyoto Sunset - Asian Lo-fi Chill",
        artist: "Lofi Beats Kyoto",
        album: "Bamboo Groove",
        cover: "https://img.youtube.com/vi/81wbz6eE6yU/hqdefault.jpg",
        duration: 2700,
      },
      position: 95,
      starCount: 15,
    },
    {
      username: "nova_wave",
      displayName: "Nova Wave 🌌",
      bio: "Cosmic chill, space ambient, and zero-gravity floating frequencies.",
      pronouns: "they/them",
      avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=nova_wave",
      background: { kind: "preset", value: "#0c0d21" },
      track: {
        id: "track_nova_1",
        youtubeId: "WPni755-Krg",
        title: "Space Ambient - Deep Universe Odyssey",
        artist: "Stargazer",
        album: "Nebula Dreams",
        cover: "https://img.youtube.com/vi/WPni755-Krg/hqdefault.jpg",
        duration: 3600,
      },
      position: 210,
      starCount: 25,
    },
    {
      username: "sam_chill",
      displayName: "Sam Chill ☕",
      bio: "Sunday morning acoustic guitars, smooth jazz beats, and cozy warm blanket vibes.",
      pronouns: "he/him",
      avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=sam_chill",
      background: { kind: "preset", value: "#1f1811" },
      track: {
        id: "track_sam_1",
        youtubeId: "lTRiuFIWV54",
        title: "Coffee Shop Cozy Jazz & Lofi",
        artist: "Cafe Music BGM",
        album: "Sunday Relax",
        cover: "https://img.youtube.com/vi/lTRiuFIWV54/hqdefault.jpg",
        duration: 4800,
      },
      position: 130,
      starCount: 11,
    },
    {
      username: "maya_grooves",
      displayName: "Maya Grooves 🌺",
      bio: "Tropical downtempo, balearic chill, and beach sunset deep sessions.",
      pronouns: "she/her",
      avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=maya_grooves",
      background: { kind: "preset", value: "#1d0e1c" },
      track: {
        id: "track_maya_1",
        youtubeId: "W6YI3ZFOLUc",
        title: "Deep House Sunset Relax",
        artist: "Island Sounds",
        album: "Baleric Sunset",
        cover: "https://img.youtube.com/vi/W6YI3ZFOLUc/hqdefault.jpg",
        duration: 3200,
      },
      position: 75,
      starCount: 20,
    },
  ];

  for (const item of defaultUsers) {
    const clean = item.username.toLowerCase();
    const roomId = `room_${clean}`;

    // Add user account
    store.users.set(clean, {
      id: `usr_${clean}`,
      username: clean,
      displayName: item.displayName,
      email: `${clean}@auxy.app`,
      emailVerified: true,
      avatar: item.avatar,
      bio: item.bio,
      pronouns: item.pronouns,
      background: item.background,
      volume: 80,
      playlists: [
        {
          id: `pl_${clean}`,
          name: `${item.displayName}'s Mix`,
          description: "Curated live stream tracks",
          isPublic: true,
          trackIds: [item.track.id],
        },
      ],
      library: [item.track],
      createdAt: now,
    });

    // Add presence record
    store.presence.set(clean, {
      id: `usr_${clean}`,
      username: clean,
      displayName: item.displayName,
      avatar: item.avatar,
      bio: item.bio,
      pronouns: item.pronouns,
      starCount: item.starCount || 0,
      background: item.background,
      lastSeen: now,
      isOnline: true,
      isPlaying: true,
      currentTrack: item.track,
      roomId,
      listenTogetherEnabled: true,
    });

    // Add room record
    store.rooms.set(roomId, {
      id: roomId,
      name: `${item.displayName}'s Room`,
      hostId: `usr_${clean}`,
      hostUsername: clean,
      currentTrack: item.track,
      isPlaying: true,
      position: item.position,
      participantCount: 2,
      createdAt: now,
      updatedAt: now,
      listenTogetherEnabled: true,
      privacy: "public",
      autoAccept: true,
      playlistTracks: [item.track],
    });

    // Add live playback state
    const liveState: LivePlaybackState = {
      roomId,
      hostUsername: clean,
      hostDisplayName: item.displayName,
      hostAvatar: item.avatar,
      currentTrack: item.track,
      isPlaying: true,
      positionSeconds: item.position,
      updatedAt: now,
      playlistTracks: [item.track],
      playlistName: `${item.displayName}'s Mix`,
      background: item.background,
      stateVersion: 1,
    };
    store.liveRooms.set(roomId, liveState);
    store.liveRooms.set(`room_${clean}`, liveState);
  }
}

// ============================================================================
// FRIENDSHIP & FRIEND REQUEST STORE
// ============================================================================

export interface FriendUserSummary {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  bio?: string;
  isOnline: boolean;
  isPlaying?: boolean;
  currentTrack?: Track;
  roomId?: string;
  listenTogetherEnabled: boolean;
  privacy: "public" | "friends";
}

export function areUsersFriends(u1: string, u2: string): boolean {
  if (!u1 || !u2) return false;
  const store = getServerStore();
  const c1 = u1.trim().toLowerCase();
  const c2 = u2.trim().toLowerCase();
  if (c1 === c2) return false;
  return Boolean(store.friendships.get(c1)?.has(c2));
}

export function addFriendship(u1: string, u2: string): void {
  if (!u1 || !u2) return;
  const store = getServerStore();
  const c1 = u1.trim().toLowerCase();
  const c2 = u2.trim().toLowerCase();
  if (c1 === c2) return;

  if (!store.friendships.has(c1)) store.friendships.set(c1, new Set());
  if (!store.friendships.has(c2)) store.friendships.set(c2, new Set());
  store.friendships.get(c1)!.add(c2);
  store.friendships.get(c2)!.add(c1);

  // Auto clean any pending requests between them
  for (const [id, req] of store.friendRequests.entries()) {
    if (
      (req.fromUsername === c1 && req.toUsername === c2) ||
      (req.fromUsername === c2 && req.toUsername === c1)
    ) {
      store.friendRequests.delete(id);
    }
  }

  schedulePersist();
}

export function removeFriendship(u1: string, u2: string): void {
  if (!u1 || !u2) return;
  const store = getServerStore();
  const c1 = u1.trim().toLowerCase();
  const c2 = u2.trim().toLowerCase();
  store.friendships.get(c1)?.delete(c2);
  store.friendships.get(c2)?.delete(c1);
  schedulePersist();
}

export function getFriendshipStatus(
  u1: string,
  u2: string
): "friends" | "pending_sent" | "pending_received" | "none" {
  if (!u1 || !u2) return "none";
  const store = getServerStore();
  const c1 = u1.trim().toLowerCase();
  const c2 = u2.trim().toLowerCase();
  if (c1 === c2) return "none";

  if (store.friendships.get(c1)?.has(c2)) {
    return "friends";
  }

  for (const req of store.friendRequests.values()) {
    if (req.status === "pending") {
      if (req.fromUsername === c1 && req.toUsername === c2) {
        return "pending_sent";
      }
      if (req.fromUsername === c2 && req.toUsername === c1) {
        return "pending_received";
      }
    }
  }

  return "none";
}

export function createFriendRequest(
  fromUser: { username: string; displayName?: string; avatar?: string },
  toUsername: string
): { success: boolean; status: "pending" | "accepted"; error?: string } {
  const store = getServerStore();
  const fromClean = (fromUser.username || "").trim().toLowerCase();
  const toClean = (toUsername || "").trim().toLowerCase();

  if (!fromClean || !toClean) {
    return { success: false, status: "pending", error: "Invalid usernames" };
  }
  if (fromClean === toClean) {
    return { success: false, status: "pending", error: "Cannot add yourself" };
  }

  // Already friends
  if (store.friendships.get(fromClean)?.has(toClean)) {
    return { success: true, status: "accepted" };
  }

  // Check if target already sent a request to me -> auto accept!
  for (const [id, req] of store.friendRequests.entries()) {
    if (req.fromUsername === toClean && req.toUsername === fromClean && req.status === "pending") {
      store.friendRequests.delete(id);
      addFriendship(fromClean, toClean);
      return { success: true, status: "accepted" };
    }
  }

  // Check if I already sent a request
  for (const req of store.friendRequests.values()) {
    if (req.fromUsername === fromClean && req.toUsername === toClean && req.status === "pending") {
      return { success: true, status: "pending" };
    }
  }

  // Get recipient info if available
  const recipientUser = store.users.get(toClean);
  const recipientPresence = store.presence.get(toClean);
  const toDisplayName = recipientUser?.displayName || recipientPresence?.displayName || toClean;
  const toAvatar =
    recipientUser?.avatar ||
    recipientPresence?.avatar ||
    `https://api.dicebear.com/7.x/shapes/svg?seed=${toClean}`;

  const requestId = `freq_${fromClean}_${toClean}_${Date.now()}`;
  const record: FriendRequestRecord = {
    id: requestId,
    fromUsername: fromClean,
    fromDisplayName: fromUser.displayName || fromClean,
    fromAvatar:
      fromUser.avatar || `https://api.dicebear.com/7.x/shapes/svg?seed=${fromClean}`,
    toUsername: toClean,
    toDisplayName,
    toAvatar,
    status: "pending",
    createdAt: Date.now(),
  };

  store.friendRequests.set(requestId, record);
  schedulePersist();
  return { success: true, status: "pending" };
}

export function respondToFriendRequest(
  requestId: string,
  action: "accept" | "decline"
): boolean {
  const store = getServerStore();
  const req = store.friendRequests.get(requestId);
  if (!req || req.status !== "pending") return false;

  if (action === "accept") {
    req.status = "accepted";
    store.friendRequests.delete(requestId);
    addFriendship(req.fromUsername, req.toUsername);
  } else {
    req.status = "declined";
    store.friendRequests.delete(requestId);
    schedulePersist();
  }
  return true;
}

export function cancelFriendRequest(
  fromUsername: string,
  toUsername?: string,
  requestId?: string
): boolean {
  const store = getServerStore();
  const fromClean = fromUsername.trim().toLowerCase();
  const toClean = (toUsername || "").trim().toLowerCase();

  if (requestId && store.friendRequests.has(requestId)) {
    store.friendRequests.delete(requestId);
    schedulePersist();
    return true;
  }

  let deleted = false;
  for (const [id, req] of store.friendRequests.entries()) {
    if (
      req.status === "pending" &&
      req.fromUsername === fromClean &&
      (!toClean || req.toUsername === toClean)
    ) {
      store.friendRequests.delete(id);
      deleted = true;
    }
  }

  if (deleted) schedulePersist();
  return deleted;
}

export function getUserFriends(username: string): FriendUserSummary[] {
  const store = getServerStore();
  const clean = username.trim().toLowerCase();
  const friendUsernames = store.friendships.get(clean);
  if (!friendUsernames || friendUsernames.size === 0) return [];

  const now = Date.now();
  const result: FriendUserSummary[] = [];

  for (const fUsername of friendUsernames) {
    const presence = store.presence.get(fUsername);
    const userAcc = store.users.get(fUsername);
    const room = store.rooms.get(`room_${fUsername}`) || store.rooms.get(presence?.roomId || "");
    const roomSettings = getServerRoomSettings(room?.id || `room_${fUsername}`);

    const isOnline = presence ? presence.isOnline && now - presence.lastSeen < 65000 : false;

    result.push({
      id: userAcc?.id || `usr_${fUsername}`,
      username: fUsername,
      displayName: userAcc?.displayName || presence?.displayName || fUsername,
      avatar:
        userAcc?.avatar ||
        presence?.avatar ||
        `https://api.dicebear.com/7.x/shapes/svg?seed=${fUsername}`,
      bio: userAcc?.bio || presence?.bio,
      isOnline,
      isPlaying: isOnline ? presence?.isPlaying : false,
      currentTrack: isOnline ? presence?.currentTrack : undefined,
      roomId: room?.id || `room_${fUsername}`,
      listenTogetherEnabled: roomSettings.enabled,
      privacy: roomSettings.privacy,
    });
  }

  return result.sort((a, b) => {
    if (a.isOnline && !b.isOnline) return -1;
    if (!a.isOnline && b.isOnline) return 1;
    return a.displayName.localeCompare(b.displayName);
  });
}

export function getUserPendingRequests(username: string): {
  received: FriendRequestRecord[];
  sent: FriendRequestRecord[];
} {
  const store = getServerStore();
  const clean = username.trim().toLowerCase();
  const received: FriendRequestRecord[] = [];
  const sent: FriendRequestRecord[] = [];

  for (const req of store.friendRequests.values()) {
    if (req.status === "pending") {
      if (req.toUsername === clean) {
        received.push(req);
      } else if (req.fromUsername === clean) {
        sent.push(req);
      }
    }
  }

  return {
    received: received.sort((a, b) => b.createdAt - a.createdAt),
    sent: sent.sort((a, b) => b.createdAt - a.createdAt),
  };
}

export function searchUsersWithFriendStatus(
  query: string,
  currentUsername: string
): Array<{
  username: string;
  displayName: string;
  avatar: string;
  bio?: string;
  isOnline: boolean;
  friendStatus: "friends" | "pending_sent" | "pending_received" | "none";
  requestId?: string;
}> {
  const store = getServerStore();
  const cleanQuery = query.trim().toLowerCase();
  const cleanCurrent = currentUsername.trim().toLowerCase();
  const seen = new Set<string>();
  const results: Array<{
    username: string;
    displayName: string;
    avatar: string;
    bio?: string;
    isOnline: boolean;
    friendStatus: "friends" | "pending_sent" | "pending_received" | "none";
    requestId?: string;
  }> = [];

  const now = Date.now();

  const candidates: Array<{
    username: string;
    displayName: string;
    avatar: string;
    bio?: string;
    lastSeen?: number;
    isOnline?: boolean;
  }> = [];

  for (const u of store.users.values()) {
    candidates.push({
      username: u.username,
      displayName: u.displayName || u.username,
      avatar: u.avatar || `https://api.dicebear.com/7.x/shapes/svg?seed=${u.username}`,
      bio: u.bio,
    });
  }

  for (const p of store.presence.values()) {
    candidates.push({
      username: p.username,
      displayName: p.displayName || p.username,
      avatar: p.avatar,
      bio: p.bio,
      lastSeen: p.lastSeen,
      isOnline: p.isOnline,
    });
  }

  for (const cand of candidates) {
    const uName = cand.username.trim().toLowerCase();
    if (!uName || uName === cleanCurrent || seen.has(uName)) continue;
    seen.add(uName);

    const matches =
      !cleanQuery ||
      uName.includes(cleanQuery) ||
      cand.displayName.toLowerCase().includes(cleanQuery);

    if (matches) {
      const presence = store.presence.get(uName);
      const isOnline = presence ? presence.isOnline && now - presence.lastSeen < 65000 : false;
      const friendStatus = getFriendshipStatus(cleanCurrent, uName);

      let reqId: string | undefined;
      for (const r of store.friendRequests.values()) {
        if (
          r.status === "pending" &&
          ((r.fromUsername === cleanCurrent && r.toUsername === uName) ||
            (r.fromUsername === uName && r.toUsername === cleanCurrent))
        ) {
          reqId = r.id;
          break;
        }
      }

      results.push({
        username: uName,
        displayName: cand.displayName,
        avatar: cand.avatar,
        bio: cand.bio,
        isOnline,
        friendStatus,
        requestId: reqId,
      });
    }
  }

  return results.slice(0, 20);
}

// ============================================================================
// LIVE BACKGROUNDS / SHADERS (PERSISTED + IN-MEMORY)
// ============================================================================

export function getAllBackgroundsFromStore(): BackgroundMetadata[] {
  const store = getServerStore();
  const set = new Set<string>();
  const list: BackgroundMetadata[] = [];
  for (const bg of store.backgrounds.values()) {
    if (bg && bg.id && !set.has(bg.id) && bg.active !== false) {
      set.add(bg.id);
      list.push(bg);
    }
  }
  return list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export function saveBackgroundToStore(bg: BackgroundMetadata): BackgroundMetadata {
  const store = getServerStore();
  const entry: BackgroundMetadata = {
    ...bg,
    active: bg.active !== false,
    updatedAt: Date.now(),
    createdAt: bg.createdAt || Date.now(),
  };
  store.backgrounds.set(entry.id, entry);
  if (entry.videoUrl) {
    store.backgrounds.set(entry.videoUrl, entry);
  }
  schedulePersist();
  return entry;
}

export function deleteBackgroundFromStore(idOrUrl: string): boolean {
  const store = getServerStore();
  let found = false;
  for (const [key, bg] of Array.from(store.backgrounds.entries())) {
    if (bg.id === idOrUrl || bg.videoUrl === idOrUrl || key === idOrUrl) {
      store.backgrounds.delete(key);
      store.backgrounds.delete(bg.id);
      if (bg.videoUrl) store.backgrounds.delete(bg.videoUrl);
      found = true;
    }
  }
  if (found) {
    schedulePersist();
  }
  return found;
}

export function clearAllBackgroundsFromStore(): void {
  const store = getServerStore();
  store.backgrounds.clear();
  schedulePersist();
}


