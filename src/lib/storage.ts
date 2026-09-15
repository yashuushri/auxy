import { DEFAULT_BACKGROUND } from "@/lib/backgrounds";
import { colorFromName } from "@/lib/music";
import type { Track, UserAccount } from "@/lib/types";

const USERS_KEY = "auxy_users_v3";
const SESSION_KEY = "auxy_session_v3";

function readUsers(): Record<string, UserAccount> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, UserAccount>) : {};
  } catch {
    return {};
  }
}

function writeUsers(users: Record<string, UserAccount>) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function usernameKey(username: string) {
  return username.trim().toLowerCase();
}

export function getSessionUsername() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SESSION_KEY);
}

export function setSessionUsername(username: string | null) {
  if (username) localStorage.setItem(SESSION_KEY, username);
  else localStorage.removeItem(SESSION_KEY);
}

export function getUser(username: string) {
  return readUsers()[usernameKey(username)] ?? null;
}

export function saveUser(user: UserAccount) {
  const users = readUsers();
  users[usernameKey(user.username)] = user;
  writeUsers(users);
  return user;
}

export function isValidUsername(username: string) {
  return /^[a-zA-Z0-9._]{2,32}$/.test(username.trim());
}

export function avatarInitials(name: string) {
  const cleaned = name.replace(/[._]+/g, " ").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  const compact = cleaned.replace(/\s+/g, "");
  return compact.slice(0, 2).toUpperCase() || "AX";
}

export function isCustomPhoto(avatar: string) {
  return /^data:image\/(png|jpe?g|gif|webp|bmp)/i.test(avatar) || avatar.startsWith("http");
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
