import {
  saveBackgroundToStore,
  deleteBackgroundFromStore,
  clearAllBackgroundsFromStore,
} from "@/lib/server-store";
import {
  saveBackgroundMetadataToSupabase,
  deleteBackgroundMetadataFromSupabase,
} from "@/lib/supabase-db";
import type { BackgroundMetadata } from "@/lib/types";

// Default background metadata - strictly the 6 requested live shaders
const DEFAULT_BACKGROUND_METADATA: BackgroundMetadata[] = [
  {
    id: "bg-hatsune-miku",
    name: "Hatsune Miku",
    videoUrl:
      "https://cdn.discordapp.com/attachments/1551956541219934299/1552285277236494346/Hatsune_Miku.mp4?ex=6ab50dd2&is=6ab3bc52&hm=1c471b5ead07263fb53dfe09e58bc812ac3673dca02f1d3c2e2a97faef6bc13b&",
    posterUrl: "/thumbnails/hatsune-miku.jpg",
    active: true,
    createdAt: 100,
    updatedAt: 100,
  },
  {
    id: "bg-anime-scenery",
    name: "Anime Scenery",
    videoUrl:
      "https://cdn.discordapp.com/attachments/1551956541219934299/1552284766454161438/videoplayback.webm?ex=6ab50d58&is=6ab3bbd8&hm=60bbd1fce52ef8ecb15c7b3979d0219f91900665c759f0f5637a7965520d6542&",
    posterUrl: "/thumbnails/videoplayback.jpg",
    active: true,
    createdAt: 99,
    updatedAt: 99,
  },
  {
    id: "bg-cosmic-horizon",
    name: "Cosmic Horizon",
    videoUrl:
      "https://cdn.discordapp.com/attachments/1551956541219934299/1552285275156381756/videoplayback_1.webm?ex=6ab50dd1&is=6ab3bc51&hm=9d84322ac8393c62f7bde65f19433cbddabe193d7c1e51263bc0df41245c3df7&",
    posterUrl: "/thumbnails/videoplayback-1.jpg",
    active: true,
    createdAt: 98,
    updatedAt: 98,
  },
  {
    id: "bg-the-batman",
    name: "The Batman",
    videoUrl:
      "https://cdn.discordapp.com/attachments/1551956541219934299/1552285323973885982/im-vengeance-the-batman-moewalls-com.mp4?ex=6ab50ddd&is=6ab3bc5d&hm=72ed5641af129f70952b5c74d6267ad9642ffed60dc996a7dcaaeab2b1b791a8&",
    posterUrl: "/thumbnails/batman.jpg",
    active: true,
    createdAt: 97,
    updatedAt: 97,
  },
  {
    id: "bg-nekomata-okayu",
    name: "Nekomata Okayu",
    videoUrl:
      "https://cdn.discordapp.com/attachments/1551956541219934299/1552285237747130409/hololive-nekomata-okayu-live-wallpaper.mp4?ex=6ab50dc8&is=6ab3bc48&hm=ceabdea57f0dee634a8a787e07125a52ab814b41e28c47eab2a9d63caf976d1c&",
    posterUrl: "/thumbnails/hololive.jpg",
    active: true,
    createdAt: 96,
    updatedAt: 96,
  },
  {
    id: "bg-summer-pool",
    name: "Summer Pool",
    videoUrl:
      "https://cdn.discordapp.com/attachments/1551956541219934299/1552285272492744764/pool.mp4?ex=6ab50dd1&is=6ab3bc51&hm=7d64cd29a6277b5bd02ab3142e609d829ab7bf1987c5cee8dc7a1ac92128def9&",
    posterUrl: "/thumbnails/pool.jpg",
    active: true,
    createdAt: 95,
    updatedAt: 95,
  },
  {
    id: "bg-earthy-forest",
    name: "Earthy Forest",
    videoUrl:
      "https://cdn.discordapp.com/attachments/1551956541219934299/1552391578738499644/From_Klickpin.com-_Earthy_forest_walks_for_busy_days_that_feel_fresh_and_shareable_that_feel_deeply_relaxing-pin-id-46865652369505998.mp4?ex=6ab570d2&is=6ab41f52&hm=2285163a0e91a390e52c57c3d6081dca4cfe676d70595786b0219c0ea9f0edc1&",
    posterUrl: "/thumbnails/earthy-forest.jpg",
    active: true,
    createdAt: 94,
    updatedAt: 94,
  },
  {
    id: "bg-modern-aesthetic",
    name: "Modern Aesthetic",
    videoUrl:
      "https://cdn.discordapp.com/attachments/1551956541219934299/1552391581565321256/From_Klickpin.com-_Modern_Passive_Income_Ideas_You_Need_Right_Now-pin-id-1088674909925691140.mp4?ex=6ab570d3&is=6ab41f53&hm=7c392e04bbbb48c9e3fd7dc8c45b4d29153d2c3e12890b66106a90126b760386&",
    posterUrl: "/thumbnails/modern-aesthetic.jpg",
    active: true,
    createdAt: 93,
    updatedAt: 93,
  },
  {
    id: "bg-quiet-leafy-home",
    name: "Quiet Leafy Home",
    videoUrl:
      "https://cdn.discordapp.com/attachments/1551956541219934299/1552391581980696636/From_Klickpin.com-_Quiet_leafy_home_mood_boards_with_charm_and_ideas_with_soft_aesthetic_charm_that_bring_outdoor_joy-pin-id-970103575991145981.mp4?ex=6ab570d3&is=6ab41f53&hm=c357bb052772a33cd7eae39481632d85b60a4bf59089dc973e5e3cb7a2fd5841&",
    posterUrl: "/thumbnails/quiet-leafy-home.jpg",
    active: true,
    createdAt: 92,
    updatedAt: 92,
  },
];

// Fast unified backgrounds cache to shield Supabase & ServerStore from high-frequency requests
let cachedUnifiedBackgrounds: BackgroundMetadata[] | null = null;
let lastUnifiedFetchTime = 0;
const UNIFIED_CACHE_TTL = 3 * 60 * 1000; // 3 minutes cache for backgrounds

/**
 * Multi-layer background synchronization service:
 * 1. Fast in-memory cache (0ms instant response)
 * 2. ServerStore (Persistent local file + Memory cache)
 * Returns strictly the 6 live shaders specified by the user.
 */
export async function syncAndFetchAllBackgrounds(forceRefresh = false): Promise<BackgroundMetadata[]> {
  const now = Date.now();

  // Return cached result if fresh and not explicitly forced
  if (!forceRefresh && cachedUnifiedBackgrounds && now - lastUnifiedFetchTime < UNIFIED_CACHE_TTL) {
    return cachedUnifiedBackgrounds;
  }

  // Clear all outdated backgrounds from server store to ensure clean slate
  try {
    clearAllBackgroundsFromStore();
  } catch (err) {
    console.warn("[Backgrounds Sync] Store clear warning:", err);
  }

  // Populate server store with the 6 active shaders
  for (const item of DEFAULT_BACKGROUND_METADATA) {
    try {
      saveBackgroundToStore(item);
    } catch {}
  }

  cachedUnifiedBackgrounds = DEFAULT_BACKGROUND_METADATA;
  lastUnifiedFetchTime = now;

  return DEFAULT_BACKGROUND_METADATA;
}

export async function saveUnifiedBackground(bg: BackgroundMetadata): Promise<BackgroundMetadata> {
  // 1. Save in-memory + file
  const saved = saveBackgroundToStore(bg);

  // 2. Invalidate cache so subsequent calls retrieve the fresh list immediately
  cachedUnifiedBackgrounds = null;
  lastUnifiedFetchTime = 0;

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

