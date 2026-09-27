import { DEFAULT_BACKGROUND } from "@/lib/backgrounds";
import { colorFromName } from "@/lib/music";
import type { Playlist, Track, UserAccount } from "@/lib/types";

const USERS_KEY = "auxy_users_v4";
const BACKUP_USERS_KEY = "auxy_users_backup_permanent";
const SESSION_KEY = "auxy_session_v4";

const KNOWN_USER_KEYS = [
  "auxy_users_v4",
  "auxy_users_backup_permanent",
  "auxy_users_v3",
  "auxy_users_v2",
  "auxy_users_v1",
  "auxy_users",
  "auxy_accounts",
  "music_app_users",
];

const KNOWN_SESSION_KEYS = [
  "auxy_session_v4",
  "auxy_session_v3",
  "auxy_session_v2",
  "auxy_session_v1",
  "auxy_session",
  "auxy_active_user",
  "auxy_last_username",
];

/**
 * Intelligent Migration and Recovery:
 * Scans all possible localStorage keys for any user accounts created across all previous versions
 * and restores/merges them so no user ever loses their accounts, playlists, or songs.
 */
function migrateAndRestoreAllStorage(): Record<string, UserAccount> {
  if (typeof window === "undefined") return {};

  const mergedUsers: Record<string, UserAccount> = {};

  try {
    // 1. Scan specific known keys first (in reverse priority order so newer data overwrites older)
    for (const key of [...KNOWN_USER_KEYS].reverse()) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") {
            if (Array.isArray(parsed)) {
              for (const u of parsed) {
                if (u && u.username) {
                  const k = usernameKey(u.username);
                  mergedUsers[k] = mergeUserAccounts(mergedUsers[k], u);
                }
              }
            } else {
              for (const [k, u] of Object.entries(parsed as Record<string, UserAccount>)) {
                if (u && u.username) {
                  const uk = usernameKey(u.username || k);
                  mergedUsers[uk] = mergeUserAccounts(mergedUsers[uk], u);
                }
              }
            }
          }
        }
      } catch {}
    }

    // 2. Scan all arbitrary localStorage keys in case data was saved in dynamic custom keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith("auxy_") || key.includes("user")) && !KNOWN_USER_KEYS.includes(key)) {
        try {
          const raw = localStorage.getItem(key);
          if (raw && raw.startsWith("{") && raw.includes("username")) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object") {
              if (parsed.username && (parsed.playlists || parsed.library || parsed.email)) {
                const uk = usernameKey(parsed.username);
                mergedUsers[uk] = mergeUserAccounts(mergedUsers[uk], parsed);
              } else {
                for (const [k, u] of Object.entries(parsed as Record<string, UserAccount>)) {
                  if (u && typeof u === "object" && u.username) {
                    const uk = usernameKey(u.username || k);
                    mergedUsers[uk] = mergeUserAccounts(mergedUsers[uk], u);
                  }
                }
              }
            }
          }
        } catch {}
      }
    }

    // 3. If any users were restored, ensure they are written to primary and backup keys
    if (Object.keys(mergedUsers).length > 0) {
      localStorage.setItem(USERS_KEY, JSON.stringify(mergedUsers));
      localStorage.setItem(BACKUP_USERS_KEY, JSON.stringify(mergedUsers));
    }
  } catch (err) {
    console.warn("[Storage] Error during recovery scan:", err);
  }

  return mergedUsers;
}

function mergeUserAccounts(existing?: UserAccount, incoming?: UserAccount): UserAccount {
  if (!incoming) return existing!;
  if (!existing) return incoming;

  // Merge playlists cleanly without duplicates
  const playlistMap = new Map<string, Playlist>();
  for (const p of existing.playlists || []) {
    if (p && p.id) playlistMap.set(p.id, p);
  }
  for (const p of incoming.playlists || []) {
    if (p && p.id) {
      const prev = playlistMap.get(p.id);
      if (prev) {
        playlistMap.set(p.id, {
          ...prev,
          ...p,
          trackIds: Array.from(new Set([...(prev.trackIds || []), ...(p.trackIds || [])])),
        });
      } else {
        playlistMap.set(p.id, p);
      }
    }
  }

  // Merge library tracks cleanly without duplicates
  const libraryMap = new Map<string, Track>();
  for (const t of existing.library || []) {
    if (t && t.id) libraryMap.set(t.id, t);
  }
  for (const t of incoming.library || []) {
    if (t && t.id) libraryMap.set(t.id, t);
  }

  return {
    ...existing,
    ...incoming,
    displayName: incoming.displayName || existing.displayName || incoming.username,
    email: incoming.email || existing.email,
    password: incoming.password || existing.password,
    avatar: incoming.avatar || existing.avatar,
    bio: incoming.bio || existing.bio || "",
    pronouns: incoming.pronouns || existing.pronouns || "",
    background: incoming.background || existing.background || { kind: "preset", value: "#0b0b12" },
    volume: typeof incoming.volume === "number" ? incoming.volume : existing.volume ?? 80,
    playlists: Array.from(playlistMap.values()),
    library: Array.from(libraryMap.values()),
    createdAt: existing.createdAt || incoming.createdAt || Date.now(),
  };
}

// Run one-time migration on client startup
if (typeof window !== "undefined") {
  try {
    migrateAndRestoreAllStorage();
  } catch {}
}

export function readUsers(): Record<string, UserAccount> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, UserAccount>;
      if (parsed && Object.keys(parsed).length > 0) return parsed;
    }
  } catch {}
  
  // Fallback to recovery scan if primary is empty
  return migrateAndRestoreAllStorage();
}

export function writeUsers(users: Record<string, UserAccount>) {
  if (typeof window === "undefined") return;
  try {
    const serialized = JSON.stringify(users);
    localStorage.setItem(USERS_KEY, serialized);
    localStorage.setItem(BACKUP_USERS_KEY, serialized);
  } catch (err) {
    console.error("[Storage] Failed to write users to localStorage:", err);
  }
}

export function getAllUsers(): UserAccount[] {
  const users = readUsers();
  return Object.values(users);
}

export function usernameKey(username: string) {
  return username ? username.trim().toLowerCase() : "";
}

export function getSessionUsername(): string | null {
  if (typeof window === "undefined") return null;

  // 1. Check primary session key
  const active = localStorage.getItem(SESSION_KEY);
  if (active) return active;

  // 2. Check all known legacy session keys
  for (const key of KNOWN_SESSION_KEYS) {
    try {
      const legacy = localStorage.getItem(key);
      if (legacy && typeof legacy === "string" && legacy.trim()) {
        const clean = legacy.trim();
        localStorage.setItem(SESSION_KEY, clean);
        return clean;
      }
    } catch {}
  }

  // 3. If no session key, check if there is an existing user account in storage to auto-resume
  const users = readUsers();
  const userList = Object.values(users);
  if (userList.length === 1 && userList[0]?.username) {
    const recovered = userList[0].username;
    localStorage.setItem(SESSION_KEY, recovered);
    return recovered;
  }

  return null;
}

export function setSessionUsername(username: string | null) {
  if (typeof window === "undefined") return;
  if (username) {
    localStorage.setItem(SESSION_KEY, username);
    // Also save in a secondary key to prevent loss
    localStorage.setItem("auxy_last_username", username);
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

export function getUser(username: string): UserAccount | null {
  if (!username) return null;
  return readUsers()[usernameKey(username)] ?? null;
}

export function isUsernameTaken(username: string): boolean {
  const clean = usernameKey(username);
  const users = readUsers();
  return !!users[clean];
}

export function isEmailTaken(email: string): boolean {
  if (!email) return false;
  const cleanEmail = email.trim().toLowerCase();
  const users = readUsers();
  return Object.values(users).some(
    (u) => u.email?.toLowerCase() === cleanEmail
  );
}

export function getUserByEmailOrUsername(identifier: string): UserAccount | null {
  if (!identifier) return null;
  const clean = identifier.trim().toLowerCase();
  const users = readUsers();
  if (users[clean]) return users[clean];
  const found = Object.values(users).find(
    (u) =>
      u.username?.toLowerCase() === clean ||
      u.email?.toLowerCase() === clean ||
      u.displayName?.toLowerCase() === clean ||
      usernameKey(u.username) === clean
  );
  return found || null;
}

export function saveUser(user: UserAccount): UserAccount {
  if (!user || !user.username) return user;
  const users = readUsers();
  const key = usernameKey(user.username);
  const existing = users[key];

  const merged = mergeUserAccounts(existing, user);

  users[key] = merged;
  writeUsers(users);

  // Background server sync so redeployments or cache clearing won't lose the user
  if (typeof window !== "undefined") {
    try {
      void fetch("/api/auth/save-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: merged }),
      }).catch(() => {});
    } catch {}
  }

  return merged;
}

export function isValidUsername(username: string): boolean {
  // STRICT: letters and numbers, 2 to 16 chars.
  const trimmed = username.trim();
  return /^[a-zA-Z0-9]{2,16}$/.test(trimmed);
}

export function isValidDisplayName(displayName: string): boolean {
  const trimmed = displayName.trim();
  if (trimmed.length < 1 || trimmed.length > 16) return false;
  return /^[a-zA-Z0-9 _-]+$/.test(displayName);
}

export function avatarInitials(name: string) {
  const cleaned = name.replace(/[._-]+/g, " ").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  const compact = cleaned.replace(/\s+/g, "");
  return compact.slice(0, 2).toUpperCase() || "AX";
}

export function isCustomPhoto(avatar: string) {
  return /^data:image\/(png|jpe?g|gif|webp|bmp)/i.test(avatar) || avatar?.startsWith("http");
}

export function defaultAvatar(name: string) {
  const initials = avatarInitials(name);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" fill="#12121a"/>
  <text x="64" y="80" text-anchor="middle" font-family="system-ui,Segoe UI,sans-serif" font-size="48" font-weight="600" fill="#f4f4f5">${initials}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function withDefaultAvatar(user: UserAccount): UserAccount {
  if (isCustomPhoto(user.avatar)) return user;
  return { ...user, avatar: defaultAvatar(user.displayName || user.username) };
}

export function createDiscordAccount(discordUser: {
  id: string;
  discordId: string;
  username: string;
  displayName: string;
  avatar: string;
}): UserAccount {
  const trimmed = discordUser.username.trim().toLowerCase();
  return {
    id: discordUser.id,
    discordId: discordUser.discordId,
    username: trimmed,
    displayName: discordUser.displayName || trimmed,
    avatar: discordUser.avatar || defaultAvatar(trimmed),
    bio: "",
    background: DEFAULT_BACKGROUND,
    playlists: [
      {
        id: "favorites",
        name: "Favorites",
        description: "My favorite YouTube songs",
        isPublic: true,
        cover: colorFromName("Favorites"),
        trackIds: [],
      },
    ],
    library: [],
    volume: 80,
    createdAt: Date.now(),
  };
}

export function mergeLibrary(user: UserAccount, tracks: Track[]) {
  const seen = new Set(user.library.map((track) => track.id));
  const extra = tracks.filter((track) => !seen.has(track.id));
  if (!extra.length) return user;
  const library = [...user.library, ...extra];
  const discover = user.playlists.find((playlist) => playlist.id === "discover");
  const nextPlaylists = user.playlists.map((playlist) =>
    playlist.id === "discover"
      ? {
          ...playlist,
          trackIds: Array.from(new Set([...(discover?.trackIds ?? []), ...extra.map((track) => track.id)])),
          cover: extra[0]?.cover || playlist.cover,
        }
      : playlist
  );
  return { ...user, library, playlists: nextPlaylists };
}

/**
 * Export and Backup utility functions:
 * Allows user to download or restore their full library & playlists data.
 */
export function exportUserDataAsJSON(username: string): string | null {
  const user = getUser(username);
  if (!user) return null;
  return JSON.stringify(user, null, 2);
}

export function importUserDataFromJSON(jsonString: string): { success: boolean; user?: UserAccount; error?: string } {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || !parsed.username) {
      return { success: false, error: "Invalid backup file: missing username." };
    }
    const saved = saveUser(parsed as UserAccount);
    return { success: true, user: saved };
  } catch {
    return { success: false, error: "Failed to parse backup JSON file." };
  }
}
