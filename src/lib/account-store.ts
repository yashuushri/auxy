import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { ACCOUNT_CLEAN_VERSION } from "@/lib/clean-version";
import type { RoomProfile } from "@/lib/types";
import { VIDEO_CHUNK_BYTES, VIDEO_MAX_CHUNKS } from "@/lib/video-chunk";

export type ServerAccount = {
  username: string;
  passwordHash: string;
  salt: string;
  createdAt: number;
};

export type { RoomProfile };

const ACCOUNT_PREFIX = "mp:account:";
const PROFILE_PREFIX = "mp:profile:";
const VIDEO_PREFIX = "mp:video:";
const CLEAN_KEY = "mp:clean_version";
const LOCAL_FILE = path.join(process.cwd(), ".data", "accounts.json");
const LOCAL_PROFILES_FILE = path.join(process.cwd(), ".data", "profiles.json");
const LOCAL_VIDEO_DIR = path.join(process.cwd(), ".data", "videos");
const LOCAL_CLEAN_FILE = path.join(process.cwd(), ".data", "clean-version");
const CHUNK_SIZE = 700_000;

function usernameKey(username: string) {
  return username.trim().toLowerCase();
}

function kvUrl() {
  const raw = process.env.KV_REST_API_URL ?? "";
  return raw.trim().replace(/^["']|["']$/g, "").replace(/\/$/, "");
}

function kvToken() {
  return (process.env.KV_REST_API_TOKEN ?? "").trim().replace(/^["']|["']$/g, "");
}

function isKvConfigured() {
  const url = kvUrl();
  if (!url || !kvToken()) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export function hashPassword(password: string, salt: string) {
  return createHash("sha256").update(`${salt}:${password}`).digest("hex");
}

export function makeSalt() {
  return randomBytes(16).toString("hex");
}

export function passwordsMatch(password: string, account: ServerAccount) {
  const next = hashPassword(password, account.salt);
  const left = Buffer.from(next);
  const right = Buffer.from(account.passwordHash);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function kvSend(command: unknown[]) {
  const response = await fetch(kvUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${kvToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as { result?: unknown; error?: string };
  if (!response.ok) {
    throw new Error(data.error || "Could not reach the account store.");
  }
  return data.result ?? null;
}

async function readLocal(): Promise<Record<string, ServerAccount>> {
  try {
    const raw = await readFile(LOCAL_FILE, "utf8");
    return JSON.parse(raw) as Record<string, ServerAccount>;
  } catch {
    return {};
  }
}

async function writeLocal(accounts: Record<string, ServerAccount>) {
  await mkdir(path.dirname(LOCAL_FILE), { recursive: true });
  await writeFile(LOCAL_FILE, JSON.stringify(accounts, null, 2), "utf8");
}

async function readLocalProfiles(): Promise<Record<string, RoomProfile>> {
  try {
    const raw = await readFile(LOCAL_PROFILES_FILE, "utf8");
    return JSON.parse(raw) as Record<string, RoomProfile>;
  } catch {
    return {};
  }
}

async function writeLocalProfiles(profiles: Record<string, RoomProfile>) {
  await mkdir(path.dirname(LOCAL_PROFILES_FILE), { recursive: true });
  await writeFile(LOCAL_PROFILES_FILE, JSON.stringify(profiles, null, 2), "utf8");
}

async function kvScan(pattern: string) {
  const keys: string[] = [];
  let cursor = "0";
  do {
    const result = await kvSend(["SCAN", cursor, "MATCH", pattern, "COUNT", 100]);
    const pair = Array.isArray(result) ? result : ["0", []];
    cursor = String(pair[0] ?? "0");
    const batch = Array.isArray(pair[1]) ? (pair[1] as string[]) : [];
    keys.push(...batch);
  } while (cursor !== "0");
  return keys;
}

async function deleteAllAccounts() {
  if (isKvConfigured()) {
    const keys = [
      ...(await kvScan(`${ACCOUNT_PREFIX}*`)),
      ...(await kvScan(`${PROFILE_PREFIX}*`)),
      ...(await kvScan(`${VIDEO_PREFIX}*`)),
    ];
    if (keys.length) await kvSend(["DEL", ...keys]);
    await kvSend(["SET", CLEAN_KEY, ACCOUNT_CLEAN_VERSION]);
    return;
  }

  await writeLocal({});
  await writeLocalProfiles({});
  await rm(LOCAL_VIDEO_DIR, { recursive: true, force: true }).catch(() => undefined);
  await mkdir(path.dirname(LOCAL_CLEAN_FILE), { recursive: true });
  await writeFile(LOCAL_CLEAN_FILE, ACCOUNT_CLEAN_VERSION, "utf8");
}

async function currentCleanVersion() {
  if (isKvConfigured()) {
    const raw = await kvSend(["GET", CLEAN_KEY]);
    return typeof raw === "string" ? raw : "";
  }
  try {
    return (await readFile(LOCAL_CLEAN_FILE, "utf8")).trim();
  } catch {
    return "";
  }
}

export async function applyAccountClean() {
  const current = await currentCleanVersion();
  if (current === ACCOUNT_CLEAN_VERSION) return;
  await deleteAllAccounts();
}

export async function getAccount(username: string) {
  await applyAccountClean();
  const key = usernameKey(username);
  if (!key) return null;

  if (isKvConfigured()) {
    const raw = await kvSend(["GET", `${ACCOUNT_PREFIX}${key}`]);
    if (typeof raw !== "string" || !raw) return null;
    try {
      return JSON.parse(raw) as ServerAccount;
    } catch {
      return null;
    }
  }

  const accounts = await readLocal();
  return accounts[key] ?? null;
}

export async function createAccountRecord(username: string, password: string) {
  await applyAccountClean();
  const trimmed = username.trim();
  const key = usernameKey(trimmed);
  const salt = makeSalt();
  const account: ServerAccount = {
    username: trimmed,
    salt,
    passwordHash: hashPassword(password, salt),
    createdAt: Date.now(),
  };

  if (isKvConfigured()) {
    const created = await kvSend(["SET", `${ACCOUNT_PREFIX}${key}`, JSON.stringify(account), "NX"]);
    if (created !== "OK") return null;
    return account;
  }

  const accounts = await readLocal();
  if (accounts[key]) return null;
  accounts[key] = account;
  await writeLocal(accounts);
  return account;
}

async function deleteProfileKeys(key: string) {
  if (!isKvConfigured()) return;
  const keys = [
    `${PROFILE_PREFIX}${key}`,
    `${PROFILE_PREFIX}${key}:meta`,
    ...(await kvScan(`${PROFILE_PREFIX}${key}:*`)),
  ];
  const unique = Array.from(new Set(keys));
  if (unique.length) await kvSend(["DEL", ...unique]);
}

export async function getRoomProfile(username: string) {
  await applyAccountClean();
  const key = usernameKey(username);
  if (!key) return null;

  if (isKvConfigured()) {
    const metaRaw = await kvSend(["GET", `${PROFILE_PREFIX}${key}:meta`]);
    if (typeof metaRaw === "string" && metaRaw) {
      try {
        const meta = JSON.parse(metaRaw) as { chunks?: number };
        const count = Math.max(0, Number(meta.chunks) || 0);
        const parts: string[] = [];
        for (let i = 0; i < count; i++) {
          const part = await kvSend(["GET", `${PROFILE_PREFIX}${key}:${i}`]);
          if (typeof part !== "string") return null;
          parts.push(part);
        }
        return JSON.parse(parts.join("")) as RoomProfile;
      } catch {
        return null;
      }
    }
    const raw = await kvSend(["GET", `${PROFILE_PREFIX}${key}`]);
    if (typeof raw !== "string" || !raw) return null;
    try {
      return JSON.parse(raw) as RoomProfile;
    } catch {
      return null;
    }
  }

  const profiles = await readLocalProfiles();
  return profiles[key] ?? null;
}

export async function saveRoomProfile(username: string, profile: RoomProfile) {
  await applyAccountClean();
  const key = usernameKey(username);
  if (!key) throw new Error("Missing username.");
  const payload = JSON.stringify(profile);
  if (payload.length > 4_000_000) {
    throw new Error("That room is too large to save.");
  }

  if (isKvConfigured()) {
    await deleteProfileKeys(key);
    if (payload.length <= CHUNK_SIZE) {
      await kvSend(["SET", `${PROFILE_PREFIX}${key}`, payload]);
      return;
    }
    const chunks: string[] = [];
    for (let i = 0; i < payload.length; i += CHUNK_SIZE) {
      chunks.push(payload.slice(i, i + CHUNK_SIZE));
    }
    await kvSend(["SET", `${PROFILE_PREFIX}${key}:meta`, JSON.stringify({ chunks: chunks.length })]);
    for (let i = 0; i < chunks.length; i++) {
      await kvSend(["SET", `${PROFILE_PREFIX}${key}:${i}`, chunks[i]]);
    }
    return;
  }

  const profiles = await readLocalProfiles();
  profiles[key] = profile;
  await writeLocalProfiles(profiles);
}

export type VideoMeta = {
  stamp: string;
  size: number;
  type: string;
  chunks: number;
  complete: boolean;
};

async function deleteVideoKeys(key: string) {
  if (isKvConfigured()) {
    const keys = [
      `${VIDEO_PREFIX}${key}:meta`,
      ...(await kvScan(`${VIDEO_PREFIX}${key}:*`)),
    ];
    const unique = Array.from(new Set(keys));
    if (unique.length) await kvSend(["DEL", ...unique]);
    return;
  }
  try {
    await rm(path.join(LOCAL_VIDEO_DIR, key), { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

export async function initRoomVideo(username: string, meta: Omit<VideoMeta, "complete">) {
  await applyAccountClean();
  const key = usernameKey(username);
  if (!key) throw new Error("Missing username.");
  if (meta.size > 50 * 1024 * 1024) throw new Error("That video is too large.");
  if (meta.chunks < 1 || meta.chunks > VIDEO_MAX_CHUNKS) throw new Error("That video cannot be saved.");
  await deleteVideoKeys(key);
  const record: VideoMeta = { ...meta, complete: false };
  if (isKvConfigured()) {
    await kvSend(["SET", `${VIDEO_PREFIX}${key}:meta`, JSON.stringify(record)]);
    return;
  }
  const dir = path.join(LOCAL_VIDEO_DIR, key);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "meta.json"), JSON.stringify(record), "utf8");
}

export async function saveVideoChunk(username: string, index: number, data: Buffer) {
  await applyAccountClean();
  const key = usernameKey(username);
  if (!key) throw new Error("Missing username.");
  if (index < 0 || index >= VIDEO_MAX_CHUNKS) throw new Error("Bad chunk.");
  if (data.length > VIDEO_CHUNK_BYTES + 8_192) throw new Error("Chunk too large.");
  const meta = await getVideoMeta(username);
  if (!meta || meta.complete) throw new Error("Video upload is not open.");
  if (index >= meta.chunks) throw new Error("Bad chunk.");

  if (isKvConfigured()) {
    await kvSend(["SET", `${VIDEO_PREFIX}${key}:${index}`, data.toString("base64")]);
    return;
  }
  const dir = path.join(LOCAL_VIDEO_DIR, key);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${index}.bin`), data);
}

export async function completeRoomVideo(username: string) {
  const meta = await getVideoMeta(username);
  if (!meta) throw new Error("No video upload.");
  const done = { ...meta, complete: true };
  const key = usernameKey(username);
  if (isKvConfigured()) {
    await kvSend(["SET", `${VIDEO_PREFIX}${key}:meta`, JSON.stringify(done)]);
    return;
  }
  await writeFile(path.join(LOCAL_VIDEO_DIR, key, "meta.json"), JSON.stringify(done), "utf8");
}

export async function getVideoMeta(username: string) {
  await applyAccountClean();
  const key = usernameKey(username);
  if (!key) return null;
  if (isKvConfigured()) {
    const raw = await kvSend(["GET", `${VIDEO_PREFIX}${key}:meta`]);
    if (typeof raw !== "string" || !raw) return null;
    try {
      return JSON.parse(raw) as VideoMeta;
    } catch {
      return null;
    }
  }
  try {
    const raw = await readFile(path.join(LOCAL_VIDEO_DIR, key, "meta.json"), "utf8");
    return JSON.parse(raw) as VideoMeta;
  } catch {
    return null;
  }
}

export async function getVideoChunk(username: string, index: number) {
  const meta = await getVideoMeta(username);
  if (!meta?.complete || index < 0 || index >= meta.chunks) return null;
  const key = usernameKey(username);
  if (isKvConfigured()) {
    const raw = await kvSend(["GET", `${VIDEO_PREFIX}${key}:${index}`]);
    if (typeof raw !== "string") return null;
    return Buffer.from(raw, "base64");
  }
  try {
    return await readFile(path.join(LOCAL_VIDEO_DIR, key, `${index}.bin`));
  } catch {
    return null;
  }
}

export async function deleteRoomVideoRecord(username: string) {
  await applyAccountClean();
  const key = usernameKey(username);
  if (!key) return;
  await deleteVideoKeys(key);
}
