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
      "https://cdn.discordapp.com/attachments/1551956541219934299/1552285277236494346/Hatsune_Miku.mp4?ex=6ab65f52&is=6ab50dd2&hm=95e498ff449ac2b3ec401c8ddfe70299242a34d804cdf301849f55ec12e48dee&",
    posterUrl: "/thumbnails/hatsune-miku.jpg",
    active: true,
    createdAt: 100,
    updatedAt: 100,
  },
  {
    id: "bg-anime-scenery",
    name: "Anime Scenery",
    videoUrl:
      "https://cdn.discordapp.com/attachments/1551956541219934299/1552284766454161438/videoplayback.webm?ex=6ab65ed8&is=6ab50d58&hm=ecc5f9c3f59692f35d4ae2340ec24b1cdbf533c67745633fdc21619551c34b82&",
    posterUrl: "/thumbnails/videoplayback.jpg",
    active: true,
    createdAt: 99,
    updatedAt: 99,
  },
  {
    id: "bg-cosmic-horizon",
    name: "Cosmic Horizon",
    videoUrl:
      "https://cdn.discordapp.com/attachments/1551956541219934299/1552285275156381756/videoplayback_1.webm?ex=6ab65f51&is=6ab50dd1&hm=e141e0da935009b1fd0ad6560a4b93736b9950e09de63f064688d18b79c8bfbc&",
    posterUrl: "/thumbnails/videoplayback-1.jpg",
    active: true,
    createdAt: 98,
    updatedAt: 98,
  },
  {
    id: "bg-the-batman",
    name: "The Batman",
    videoUrl:
      "https://cdn.discordapp.com/attachments/1551956541219934299/1552285323973885982/im-vengeance-the-batman-moewalls-com.mp4?ex=6ab65f5d&is=6ab50ddd&hm=57ae76f1e4e11940dd6fd57a9fe32c20d544ae4afc26cc9d03ae14fb1960414a&",
    posterUrl: "/thumbnails/batman.jpg",
    active: true,
    createdAt: 97,
    updatedAt: 97,
  },
  {
    id: "bg-nekomata-okayu",
    name: "Nekomata Okayu",
    videoUrl:
      "https://cdn.discordapp.com/attachments/1551956541219934299/1552285237747130409/hololive-nekomata-okayu-live-wallpaper.mp4?ex=6ab65f48&is=6ab50dc8&hm=ddfd87e2920a6dded29f1c2be21d8c0e935dfd416163597d4a0f30e48e246e70&",
    posterUrl: "/thumbnails/hololive.jpg",
    active: true,
    createdAt: 96,
    updatedAt: 96,
  },
  {
    id: "bg-summer-pool",
    name: "Summer Pool",
    videoUrl:
      "https://cdn.discordapp.com/attachments/1551956541219934299/1552285272492744764/pool.mp4?ex=6ab65f51&is=6ab50dd1&hm=d376cde7df4a93f3405fc3caa92187d230db52ac334d55d14fc927596412b080&",
    posterUrl: "/thumbnails/pool.jpg",
    active: true,
    createdAt: 95,
    updatedAt: 95,
  },
  {
    id: "bg-earthy-forest",
    name: "Earthy Forest",
    videoUrl:
      "https://cdn.discordapp.com/attachments/1551956541219934299/1552391578738499644/From_Klickpin.com-_Earthy_forest_walks_for_busy_days_that_feel_fresh_and_shareable_that_feel_deeply_relaxing-pin-id-46865652369505998.mp4?ex=6ab6c252&is=6ab570d2&hm=3ec4f69ed00cf76745cc98e778f2e3e977f8504ddc912bf1342d0c7fc9f0fcd4&",
    posterUrl: "/thumbnails/earthy-forest.jpg",
    active: true,
    createdAt: 94,
    updatedAt: 94,
  },
  {
    id: "bg-modern-aesthetic",
    name: "Modern Aesthetic",
    videoUrl:
      "https://cdn.discordapp.com/attachments/1551956541219934299/1552391581565321256/From_Klickpin.com-_Modern_Passive_Income_Ideas_You_Need_Right_Now-pin-id-1088674909925691140.mp4?ex=6ab6c253&is=6ab570d3&hm=235da8389210855c207347657a5a86c7490ddae2507c30ab1aebb0898012a31f&",
    posterUrl: "/thumbnails/modern-aesthetic.jpg",
    active: true,
    createdAt: 93,
    updatedAt: 93,
  },
  {
    id: "bg-quiet-leafy-home",
    name: "Quiet Leafy Home",
    videoUrl:
      "https://cdn.discordapp.com/attachments/1551956541219934299/1552391581980696636/From_Klickpin.com-_Quiet_leafy_home_mood_boards_with_charm_and_ideas_with_soft_aesthetic_charm_that_bring_outdoor_joy-pin-id-970103575991145981.mp4?ex=6ab6c253&is=6ab570d3&hm=0d21012b8fbcef9d653c0ff36182b0deb7566e99c0ea7c8c7f5ea6aee3751d45&",
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

