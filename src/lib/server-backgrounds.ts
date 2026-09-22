import {
  getAllBackgroundsFromStore,
  saveBackgroundToStore,
  deleteBackgroundFromStore,
  clearAllBackgroundsFromStore,
} from "@/lib/server-store";
import {
  fetchBackgroundsFromSupabase,
  saveBackgroundMetadataToSupabase,
  deleteBackgroundMetadataFromSupabase,
} from "@/lib/supabase-db";
import type { BackgroundMetadata } from "@/lib/types";

// Default background metadata - completely empty by default so only admin/user added shaders exist
const DEFAULT_BACKGROUND_METADATA: BackgroundMetadata[] = [];

// Fast unified backgrounds cache to shield Supabase & ServerStore from high-frequency requests
let cachedUnifiedBackgrounds: BackgroundMetadata[] | null = null;
let lastUnifiedFetchTime = 0;
const UNIFIED_CACHE_TTL = 3 * 60 * 1000; // 3 minutes cache for backgrounds

function getPosterForVideo(videoUrl: string, explicitPoster?: string): string {
  if (explicitPoster && explicitPoster.trim()) return explicitPoster;
  const lower = (videoUrl || "").toLowerCase();
  if (lower.includes("hololive") || lower.includes("okayu")) return "/thumbnails/hololive.jpg";
  if (lower.includes("pool")) return "/thumbnails/pool.jpg";
  if (lower.includes("videoplayback__1_") || lower.includes("videoplayback%20(1)")) return "/thumbnails/videoplayback-1.jpg";
  if (lower.includes("videoplayback")) return "/thumbnails/videoplayback.jpg";
  if (lower.includes("miku")) return "/thumbnails/hatsune-miku.jpg";
  if (lower.includes("batman") || lower.includes("vengeance")) return "/thumbnails/batman.jpg";
  return "";
}

/**
 * Multi-layer background synchronization service:
 * 1. Fast in-memory cache (0ms instant response)
 * 2. ServerStore (Persistent local file + Memory cache)
 * 3. Supabase PostgreSQL ('backgrounds' table)
 * ZERO dependencies on Vercel Blob. Direct Video URLs only.
 */
export async function syncAndFetchAllBackgrounds(forceRefresh = false): Promise<BackgroundMetadata[]> {
  const now = Date.now();

  // Return cached result if fresh and not explicitly forced
  if (!forceRefresh && cachedUnifiedBackgrounds && now - lastUnifiedFetchTime < UNIFIED_CACHE_TTL) {
    return cachedUnifiedBackgrounds;
  }

  // 1. Get from ServerStore (Always available, instant)
  const storeBackgrounds = getAllBackgroundsFromStore();
  const storeMapByUrl = new Map<string, BackgroundMetadata>();
  for (const s of storeBackgrounds) {
    if (s.videoUrl) storeMapByUrl.set(s.videoUrl, s);
  }

  // 2. Get from Supabase PostgreSQL (Protected against timeouts and missing table)
  let supabaseBackgrounds: BackgroundMetadata[] = [];
  try {
    supabaseBackgrounds = await fetchBackgroundsFromSupabase();
  } catch (err) {
    console.warn("[Backgrounds Sync] Supabase query warning:", err);
  }

  // 3. Merge map: Default items -> Store Cache -> Supabase Record
  const mapByUrl = new Map<string, BackgroundMetadata>();
  const mapById = new Map<string, BackgroundMetadata>();

  // A. Add Default items
  for (const b of DEFAULT_BACKGROUND_METADATA) {
    mapByUrl.set(b.videoUrl, b);
    mapById.set(b.id, b);
  }

  // B. Merge Store items (preserves user-set names and posters)
  for (const b of storeBackgrounds) {
    if (b.active !== false) {
      const existing = mapByUrl.get(b.videoUrl) || mapById.get(b.id);
      const mergedItem: BackgroundMetadata = {
        ...b,
        posterUrl: getPosterForVideo(b.videoUrl, b.posterUrl || existing?.posterUrl),
        name: b.name || existing?.name || "Live Shader",
      };
      mapByUrl.set(b.videoUrl, mergedItem);
      mapById.set(b.id, mergedItem);
    }
  }

  // C. Merge Supabase items
  for (const b of supabaseBackgrounds) {
    if (b.active !== false) {
      const existing = mapByUrl.get(b.videoUrl) || mapById.get(b.id);
      const mergedItem: BackgroundMetadata = {
        ...b,
        posterUrl: getPosterForVideo(b.videoUrl, b.posterUrl || existing?.posterUrl),
        name: b.name || existing?.name || "Live Shader",
      };
      mapByUrl.set(b.videoUrl, mergedItem);
      mapById.set(b.id, mergedItem);
    }
  }

  const merged = Array.from(new Set(mapByUrl.values())).sort(
    (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
  );

  // Sync cache back to ServerStore
  for (const item of merged) {
    saveBackgroundToStore(item);
  }

  cachedUnifiedBackgrounds = merged;
  lastUnifiedFetchTime = now;

  return merged;
}

export async function saveUnifiedBackground(bg: BackgroundMetadata): Promise<BackgroundMetadata> {
  // 1. Save in-memory + file
  const saved = saveBackgroundToStore(bg);

  // 2. Update cachedUnifiedBackgrounds
  if (cachedUnifiedBackgrounds) {
    const existingIdx = cachedUnifiedBackgrounds.findIndex(
      (b) => b.videoUrl === bg.videoUrl || b.id === bg.id
    );
    if (existingIdx >= 0) {
      cachedUnifiedBackgrounds[existingIdx] = saved;
    } else {
      cachedUnifiedBackgrounds.unshift(saved);
    }
  } else {
    cachedUnifiedBackgrounds = [saved];
  }
  lastUnifiedFetchTime = Date.now();

  // 3. Save in Supabase
  try {
    await saveBackgroundMetadataToSupabase(bg);
  } catch (err) {
    console.warn("[Backgrounds] Failed to save to Supabase:", err);
  }

  return saved;
}

export async function deleteUnifiedBackground(idOrUrl: string): Promise<void> {
  // 1. Delete from ServerStore
  deleteBackgroundFromStore(idOrUrl);

  // 2. Remove from in-memory cached unified list
  if (cachedUnifiedBackgrounds) {
    cachedUnifiedBackgrounds = cachedUnifiedBackgrounds.filter(
      (b) => b.id !== idOrUrl && b.videoUrl !== idOrUrl
    );
  }

  // 3. Delete from Supabase
  try {
    await deleteBackgroundMetadataFromSupabase(idOrUrl);
  } catch (err) {
    console.warn("[Backgrounds] Failed to delete from Supabase:", err);
  }
}

export async function clearAllUnifiedBackgrounds(): Promise<void> {
  clearAllBackgroundsFromStore();
  cachedUnifiedBackgrounds = [];
  lastUnifiedFetchTime = Date.now();
}

