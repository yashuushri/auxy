import { VIDEO_CHUNK_BYTES, VIDEO_UPLOAD_CONCURRENCY } from "@/lib/video-chunk";

const DB_NAME = "mp_room_media_v1";
const STORE = "videos";

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function isMp4File(file: File) {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return name.endsWith(".mp4") && (type === "" || type === "video/mp4");
}

export async function saveRoomVideo(username: string, file: File) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(file, username.trim().toLowerCase());
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadRoomVideo(username: string) {
  const db = await openDb();
  return new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get(username.trim().toLowerCase());
    request.onsuccess = () => resolve((request.result as Blob | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function wipeRoomVideos() {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

export async function deleteRoomVideo(username: string) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(username.trim().toLowerCase());
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export const VIDEO_UPLOAD_TOAST = "room-video-upload";
export const VIDEO_DOWNLOAD_TOAST = "room-video-download";

type ProgressFn = (percent: number) => void;

type UploadJob = {
  promise: Promise<void>;
  listeners: Set<ProgressFn>;
};

const uploadJobs = new Map<string, UploadJob>();

export async function cloudVideoMeta() {
  const response = await fetch("/api/auth/video", { cache: "no-store" });
  if (!response.ok) return { exists: false as const };
  return (await response.json()) as {
    exists: boolean;
    stamp?: string;
    chunks?: number;
    size?: number;
    type?: string;
  };
}

async function runPool(count: number, worker: (index: number) => Promise<void>) {
  let next = 0;
  async function run() {
    while (next < count) {
      const index = next;
      next += 1;
      await worker(index);
    }
  }
  const workers = Math.min(VIDEO_UPLOAD_CONCURRENCY, Math.max(1, count));
  await Promise.all(Array.from({ length: workers }, () => run()));
}

async function doUpload(file: Blob, stamp: string, onProgress: ProgressFn) {
  const chunks = Math.max(1, Math.ceil(file.size / VIDEO_CHUNK_BYTES));
  onProgress(1);
  const init = await fetch("/api/auth/video", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "init",
      stamp,
      size: file.size,
      type: file.type || "video/mp4",
      chunks,
    }),
  });
  if (!init.ok) throw new Error("Could not start video upload.");

  let finished = 0;
  await runPool(chunks, async (index) => {
    const slice = file.slice(index * VIDEO_CHUNK_BYTES, (index + 1) * VIDEO_CHUNK_BYTES);
    const posted = await fetch(`/api/auth/video?index=${index}`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: slice,
    });
    if (!posted.ok) throw new Error("Could not upload that video.");
    finished += 1;
    onProgress(Math.min(99, Math.round((finished / chunks) * 97) + 2));
  });

  const done = await fetch("/api/auth/video", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "complete" }),
  });
  if (!done.ok) throw new Error("Could not finish video upload.");
  onProgress(100);
}

export async function uploadRoomVideo(file: Blob, stamp: string, onProgress?: ProgressFn) {
  const existing = uploadJobs.get(stamp);
  if (existing) {
    if (onProgress) existing.listeners.add(onProgress);
    return existing.promise;
  }

  const listeners = new Set<ProgressFn>();
  if (onProgress) listeners.add(onProgress);
  const notify: ProgressFn = (percent) => {
    listeners.forEach((fn) => fn(percent));
  };
  const promise = doUpload(file, stamp, notify).finally(() => {
    uploadJobs.delete(stamp);
  });
  uploadJobs.set(stamp, { promise, listeners });
  return promise;
}

export async function downloadRoomVideo(onProgress?: ProgressFn) {
  const meta = await cloudVideoMeta();
  const chunkCount = meta.chunks ?? 0;
  if (!meta.exists || chunkCount < 1) return null;
  onProgress?.(1);
  const parts: Blob[] = new Array(chunkCount);
  let finished = 0;
  await runPool(chunkCount, async (index) => {
    const response = await fetch(`/api/auth/video?index=${index}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Could not download that video.");
    parts[index] = await response.blob();
    finished += 1;
    onProgress?.(Math.min(99, Math.round((finished / chunkCount) * 97) + 2));
  });
  onProgress?.(100);
  return new Blob(parts, { type: meta.type || "video/mp4" });
}

export async function deleteCloudVideo() {
  await fetch("/api/auth/video", { method: "DELETE" }).catch(() => undefined);
}
