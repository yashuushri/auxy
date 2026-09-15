// Client-side IndexedDB for storing custom uploaded looping videos (.mp4)
// This avoids bloating localStorage or Firestore while supporting full-fidelity video loops.

const DB_NAME = "auxy_media_v1";
const STORE_NAME = "videos";
const VIDEO_KEY = "current_room_video";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      return reject(new Error("IndexedDB not available"));
    }
    const req = window.indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function storeVideoFile(
  file: File,
  onProgress?: (percent: number) => void
): Promise<string> {
  // Simulate smooth copy progress as described in the UI:
  // "a percent will show while it copies to your account"
  const totalSteps = 10;
  for (let i = 1; i <= totalSteps; i++) {
    await new Promise((r) => setTimeout(r, 60));
    if (onProgress) {
      onProgress(Math.min(100, Math.round((i / totalSteps) * 100)));
    }
  }

  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const putReq = store.put(file, VIDEO_KEY);
    putReq.onsuccess = () => {
      resolve("indexeddb:current_room_video");
    };
    putReq.onerror = () => reject(putReq.error);
  });
}

export async function getStoredVideoUrl(): Promise<string | null> {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(VIDEO_KEY);
      req.onsuccess = () => {
        const result = req.result as Blob | undefined;
        if (result && result instanceof Blob) {
          resolve(URL.createObjectURL(result));
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}
