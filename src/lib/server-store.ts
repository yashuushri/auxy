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
        backgrounds: Array.isArray(parsed.backgrounds) ? parsed.backgrounds : [],
      };
    }
  } catch (err) {
    console.warn("[ServerStore] Could not load persisted server state:", err);
  }
  return { users: [], rooms: [], backgrounds: [] };
}

function persistStateThrottled(): void {
  try {
    const filePath = getStorageFilePath();
    const usersArr = Array.from(getServerStore().users.values());
    const roomsArr = Array.from(getServerStore().rooms.values());
    const backgroundsArr = Array.from(new Set(getServerStore().backgrounds.values()));
    fs.writeFileSync(
      filePath,
      JSON.stringify(
        {
          users: usersArr,
          rooms: roomsArr,
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
    const backgroundsMap = new Map<string, BackgroundMetadata>();

    if (Array.isArray(loaded.backgrounds)) {
      for (const bg of loaded.backgrounds) {
        if (bg && bg.id && !bg.videoUrl?.includes("blob.vercel-storage.com")) {
          backgroundsMap.set(bg.id, bg);
          if (bg.videoUrl) backgroundsMap.set(bg.videoUrl, bg);
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
      backgrounds: backgroundsMap,
    };
  } else {
    if (!globalStore._auxy_server_store.backgrounds) {
      globalStore._auxy_server_store.backgrounds = new Map<string, BackgroundMetadata>();
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

export function clearAllUserDataAndRooms(): void {
  const store = getServerStore();
  store.users.clear();
  store.presence.clear();
  store.rooms.clear();
  store.requests.clear();
  store.roomSettings.clear();
  store.liveRooms.clear();
  schedulePersist();
}


