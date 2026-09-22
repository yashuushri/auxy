/**
 * IndexedDB helper for storing user-uploaded room backgrounds
 * (Photo, animated GIF, and looping Video up to 10MB)
 * Prevents QuotaExceededError in localStorage.
 */

const DB_NAME = "auxy_room_media_db";
const DB_VERSION = 1;
const STORE_NAME = "custom_room_media";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB is not supported in this environment"));
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export interface StoredRoomMedia {
  id: string;
  blob: Blob;
  type: string;
  mediaType: "photo" | "gif" | "video";
  name: string;
  size: number;
  updatedAt: number;
}

const activeObjectUrls = new Map<string, string>();

export async function saveRoomMedia(
  id: string,
  blob: Blob,
  name: string,
  type: string
): Promise<{ url: string; mediaType: "photo" | "gif" | "video" }> {
  let mediaType: "photo" | "gif" | "video" = "photo";
  const lowerName = name.toLowerCase();
  const mime = (type || blob.type || "").toLowerCase();

  if (
    mime.startsWith("video/") ||
    lowerName.endsWith(".mp4") ||
    lowerName.endsWith(".webm") ||
    lowerName.endsWith(".mov") ||
    lowerName.endsWith(".mkv")
  ) {
    mediaType = "video";
  } else if (mime.includes("gif") || lowerName.endsWith(".gif")) {
    mediaType = "gif";
  } else {
    mediaType = "photo";
  }

  try {
    const db = await openDB();
    const record: StoredRoomMedia = {
      id,
      blob,
      type: mime || "application/octet-stream",
      mediaType,
      name,
      size: blob.size,
      updatedAt: Date.now(),
    };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    if (activeObjectUrls.has(id)) {
      try {
        URL.revokeObjectURL(activeObjectUrls.get(id)!);
      } catch {
        // ignore
      }
    }

    const objectUrl = URL.createObjectURL(blob);
    activeObjectUrls.set(id, objectUrl);

    return { url: objectUrl, mediaType };
  } catch (err) {
    console.error("Failed to save room media to IndexedDB:", err);
    // Fallback: create in-memory blob URL
    const objectUrl = URL.createObjectURL(blob);
    activeObjectUrls.set(id, objectUrl);
    return { url: objectUrl, mediaType };
  }
}

export async function getRoomMedia(
  id: string
): Promise<{ record: StoredRoomMedia; url: string } | null> {
  try {
    const db = await openDB();
    const record = await new Promise<StoredRoomMedia | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });

    if (!record || !record.blob) return null;

    let url = activeObjectUrls.get(id);
    if (!url) {
      url = URL.createObjectURL(record.blob);
      activeObjectUrls.set(id, url);
    }

    return { record, url };
  } catch (err) {
    console.error("Failed to retrieve room media from IndexedDB:", err);
    return null;
  }
}

export async function clearRoomMedia(id: string): Promise<void> {
  if (activeObjectUrls.has(id)) {
    try {
      URL.revokeObjectURL(activeObjectUrls.get(id)!);
    } catch {
      // ignore
    }
    activeObjectUrls.delete(id);
  }

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error("Failed to clear room media from IndexedDB:", err);
  }
}
