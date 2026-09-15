import { DEFAULT_BACKGROUND } from "@/lib/backgrounds";
import { ACCOUNT_CLEAN_VERSION } from "@/lib/clean-version";
import { colorFromName } from "@/lib/music";
import type { Track, UserAccount } from "@/lib/types";

const USERS_KEY = "mp_users_v2";
const SESSION_KEY = "mp_session_v2";
const CLEAN_FLAG = `mp_clean_${ACCOUNT_CLEAN_VERSION}`;

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

function removePrefixedKeys(storage: Storage, prefix: string) {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith(prefix)) keys.push(key);
  }
  for (const key of keys) storage.removeItem(key);
}

export function wipeSiteData() {
  if (typeof window === "undefined") return false;
  if (localStorage.getItem(CLEAN_FLAG)) return false;
  removePrefixedKeys(localStorage, "mp_");
  removePrefixedKeys(sessionStorage, "mp_");
  localStorage.removeItem("theme");
  localStorage.setItem(CLEAN_FLAG, "1");
  return true;
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

export async function hashPassword(password: string, salt: string) {
  const encoded = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function makeSalt() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function isValidUsername(username: string) {
  return /^[a-zA-Z0-9._]{3,20}$/.test(username.trim());
}

export function avatarInitials(name: string) {
  const cleaned = name.replace(/[._]+/g, " ").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  const compact = cleaned.replace(/\s+/g, "");
  return compact.slice(0, 2).toUpperCase() || "SP";
}

export function isCustomPhoto(avatar: string) {
  return /^data:image\/(png|jpe?g|gif|webp|bmp)/i.test(avatar);
}

export function defaultAvatar(name: string) {
  const initials = avatarInitials(name);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" fill="#16161f"/>
  <text x="64" y="80" text-anchor="middle" font-family="system-ui,Segoe UI,sans-serif" font-size="48" font-weight="600" fill="#f4f4f5">${initials}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function withDefaultAvatar(user: UserAccount): UserAccount {
  if (isCustomPhoto(user.avatar)) return user;
  return { ...user, avatar: defaultAvatar(user.displayName || user.username) };
}

export function createAccount(username: string, passwordHash: string, salt: string): UserAccount {
  const trimmed = username.trim();
  return {
    username: trimmed,
    passwordHash,
    salt,
    displayName: trimmed,
    avatar: defaultAvatar(trimmed),
    background: DEFAULT_BACKGROUND,
    playlists: [
      {
        id: "liked",
        name: "Liked Songs",
        cover: colorFromName("Liked Songs"),
        trackIds: [],
      },
      {
        id: "discover",
        name: "Discover Mix",
        cover: colorFromName("Discover Mix"),
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
