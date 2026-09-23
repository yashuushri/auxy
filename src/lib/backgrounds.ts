import type { Background } from "@/lib/types";

export interface LiquidShaderConfig {
  color1: string;
  color2: string;
  color3: string;
  rotation: number;
  proportion?: number;
  scale: number;
  speed: number;
  distortion: number;
  swirl: number;
  swirlIterations: number;
  softness: number;
  offset?: number;
  shape: number;
  shapeScale: number;
}

export interface RoomPreset {
  id: string;
  name: string;
  value: string;
  preview: string;
  config: LiquidShaderConfig;
}

export interface LiveShader {
  id: string;
  name: string;
  url: string;
  posterUrl?: string;
}

export const LIVE_SHADERS: LiveShader[] = [
  {
    id: "bg-hatsune-miku",
    name: "Hatsune Miku",
    url: "https://cdn.discordapp.com/attachments/1551956541219934299/1552285277236494346/Hatsune_Miku.mp4?ex=6ab50dd2&is=6ab3bc52&hm=1c471b5ead07263fb53dfe09e58bc812ac3673dca02f1d3c2e2a97faef6bc13b&",
    posterUrl: "/thumbnails/hatsune-miku.jpg",
  },
  {
    id: "bg-anime-scenery",
    name: "Anime Scenery",
    url: "https://cdn.discordapp.com/attachments/1551956541219934299/1552284766454161438/videoplayback.webm?ex=6ab50d58&is=6ab3bbd8&hm=60bbd1fce52ef8ecb15c7b3979d0219f91900665c759f0f5637a7965520d6542&",
    posterUrl: "/thumbnails/videoplayback.jpg",
  },
  {
    id: "bg-cosmic-horizon",
    name: "Cosmic Horizon",
    url: "https://cdn.discordapp.com/attachments/1551956541219934299/1552285275156381756/videoplayback_1.webm?ex=6ab50dd1&is=6ab3bc51&hm=9d84322ac8393c62f7bde65f19433cbddabe193d7c1e51263bc0df41245c3df7&",
    posterUrl: "/thumbnails/videoplayback-1.jpg",
  },
  {
    id: "bg-the-batman",
    name: "The Batman",
    url: "https://cdn.discordapp.com/attachments/1551956541219934299/1552285323973885982/im-vengeance-the-batman-moewalls-com.mp4?ex=6ab50ddd&is=6ab3bc5d&hm=72ed5641af129f70952b5c74d6267ad9642ffed60dc996a7dcaaeab2b1b791a8&",
    posterUrl: "/thumbnails/batman.jpg",
  },
  {
    id: "bg-nekomata-okayu",
    name: "Nekomata Okayu",
    url: "https://cdn.discordapp.com/attachments/1551956541219934299/1552285237747130409/hololive-nekomata-okayu-live-wallpaper.mp4?ex=6ab50dc8&is=6ab3bc48&hm=ceabdea57f0dee634a8a787e07125a52ab814b41e28c47eab2a9d63caf976d1c&",
    posterUrl: "/thumbnails/hololive.jpg",
  },
  {
    id: "bg-summer-pool",
    name: "Summer Pool",
    url: "https://cdn.discordapp.com/attachments/1551956541219934299/1552285272492744764/pool.mp4?ex=6ab50dd1&is=6ab3bc51&hm=7d64cd29a6277b5bd02ab3142e609d829ab7bf1987c5cee8dc7a1ac92128def9&",
    posterUrl: "/thumbnails/pool.jpg",
  },
  {
    id: "bg-earthy-forest",
    name: "Earthy Forest",
    url: "https://cdn.discordapp.com/attachments/1551956541219934299/1552391578738499644/From_Klickpin.com-_Earthy_forest_walks_for_busy_days_that_feel_fresh_and_shareable_that_feel_deeply_relaxing-pin-id-46865652369505998.mp4?ex=6ab570d2&is=6ab41f52&hm=2285163a0e91a390e52c57c3d6081dca4cfe676d70595786b0219c0ea9f0edc1&",
    posterUrl: "/thumbnails/earthy-forest.jpg",
  },
  {
    id: "bg-modern-aesthetic",
    name: "Modern Aesthetic",
    url: "https://cdn.discordapp.com/attachments/1551956541219934299/1552391581565321256/From_Klickpin.com-_Modern_Passive_Income_Ideas_You_Need_Right_Now-pin-id-1088674909925691140.mp4?ex=6ab570d3&is=6ab41f53&hm=7c392e04bbbb48c9e3fd7dc8c45b4d29153d2c3e12890b66106a90126b760386&",
    posterUrl: "/thumbnails/modern-aesthetic.jpg",
  },
  {
    id: "bg-quiet-leafy-home",
    name: "Quiet Leafy Home",
    url: "https://cdn.discordapp.com/attachments/1551956541219934299/1552391581980696636/From_Klickpin.com-_Quiet_leafy_home_mood_boards_with_charm_and_ideas_with_soft_aesthetic_charm_that_bring_outdoor_joy-pin-id-970103575991145981.mp4?ex=6ab570d3&is=6ab41f53&hm=c357bb052772a33cd7eae39481632d85b60a4bf59089dc973e5e3cb7a2fd5841&",
    posterUrl: "/thumbnails/quiet-leafy-home.jpg",
  },
];

export const DEFAULT_LIVE_SHADERS: LiveShader[] = LIVE_SHADERS;

export const ROOM_PRESETS: RoomPreset[] = [
  {
    id: "prism",
    name: "Prism",
    value: "prism",
    preview: "linear-gradient(135deg, #050505 0%, #66B3FF 50%, #FFFFFF 100%)",
    config: {
      color1: "#050505",
      color2: "#66B3FF",
      color3: "#FFFFFF",
      rotation: -50,
      proportion: 0.01,
      scale: 0.01,
      speed: 30,
      distortion: 0,
      swirl: 0.5,
      swirlIterations: 16,
      softness: 0.47,
      offset: -299,
      shape: 0, // Checks
      shapeScale: 0.45,
    },
  },
  {
    id: "lava",
    name: "Lava",
    value: "lava",
    preview: "linear-gradient(135deg, #FF9F21 0%, #FF0303 50%, #050508 100%)",
    config: {
      color1: "#FF9F21",
      color2: "#FF0303",
      color3: "#050508",
      rotation: 114,
      proportion: 1.0,
      scale: 0.52,
      speed: 30,
      distortion: 0.14,
      swirl: 0.18,
      swirlIterations: 20,
      softness: 1.0,
      offset: 717,
      shape: 2, // Edge
      shapeScale: 0.12,
    },
  },
  {
    id: "plasma",
    name: "Plasma",
    value: "plasma",
    preview: "linear-gradient(135deg, #B566FF 0%, #4c1d95 50%, #000000 100%)",
    config: {
      color1: "#B566FF",
      color2: "#000000",
      color3: "#000000",
      rotation: 0,
      proportion: 0.63,
      scale: 0.75,
      speed: 30,
      distortion: 0.1,
      swirl: 0.61,
      swirlIterations: 5,
      softness: 1.0,
      offset: -168,
      shape: 0, // Checks
      shapeScale: 0.28,
    },
  },
  {
    id: "pulse",
    name: "Pulse",
    value: "pulse",
    preview: "linear-gradient(135deg, #66FF85 0%, #065f46 50%, #000000 100%)",
    config: {
      color1: "#66FF85",
      color2: "#000000",
      color3: "#000000",
      rotation: -167,
      proportion: 0.92,
      scale: 0,
      speed: 20,
      distortion: 1.08,
      swirl: 0.75,
      swirlIterations: 3,
      softness: 0.28,
      offset: -813,
      shape: 0, // Checks
      shapeScale: 0.79,
    },
  },
  {
    id: "vortex",
    name: "Vortex",
    value: "vortex",
    preview: "linear-gradient(135deg, #000000 0%, #FFFFFF 50%, #000000 100%)",
    config: {
      color1: "#000000",
      color2: "#FFFFFF",
      color3: "#000000",
      rotation: 50,
      proportion: 0.41,
      scale: 0.4,
      speed: 20,
      distortion: 0,
      swirl: 1.0,
      swirlIterations: 3,
      softness: 0.05,
      offset: -744,
      shape: 1, // Stripes
      shapeScale: 0.8,
    },
  },
  {
    id: "mist",
    name: "Mist",
    value: "mist",
    preview: "linear-gradient(135deg, #050505 0%, #FF66B8 50%, #050505 100%)",
    config: {
      color1: "#050505",
      color2: "#FF66B8",
      color3: "#050505",
      rotation: 0,
      proportion: 0.33,
      scale: 0.48,
      speed: 39,
      distortion: 0.08,
      swirl: 0.65,
      swirlIterations: 5,
      softness: 1.0,
      offset: -235,
      shape: 2, // Edge
      shapeScale: 0.48,
    },
  },
];

export const BACKGROUND_PRESETS = ROOM_PRESETS;

export const DEFAULT_BACKGROUND: Background = {
  kind: "preset",
  value: "lava",
};

export function getPresetById(idOrValue?: string): RoomPreset {
  if (!idOrValue) return ROOM_PRESETS[0];
  const found = ROOM_PRESETS.find(
    (p) => p.id === idOrValue || p.value === idOrValue || idOrValue.includes(p.id)
  );
  return found || ROOM_PRESETS[0];
}

export function resolveLiveShader(bg?: Background | null): LiveShader | null {
  if (!bg || !bg.value) return null;
  // If this is a custom uploaded video or blob, do not resolve to preset live shader
  if (
    bg.value.startsWith("data:") ||
    bg.value.startsWith("blob:") ||
    bg.value.startsWith("indexeddb:")
  ) {
    return null;
  }
  const rawVal = String(bg.value).trim();
  const val = rawVal.toLowerCase();
  const name = (bg.name || "").trim().toLowerCase();

  // 1. Direct match in hardcoded presets by URL, id, or name
  const found = LIVE_SHADERS.find(
    (s) =>
      s.url === rawVal ||
      s.id === rawVal ||
      s.url.toLowerCase() === val ||
      s.id.toLowerCase() === val ||
      (name && s.name.toLowerCase() === name) ||
      (name && s.id.toLowerCase().includes(name))
  );
  if (found) return found;

  // 2. If it's a direct MP4/WebM URL or admin-published shader URL, construct a dynamic LiveShader object
  // so the player and thumbnail components play and display the user's actual video!
  if (
    rawVal.startsWith("http://") ||
    rawVal.startsWith("https://") ||
    rawVal.endsWith(".mp4") ||
    rawVal.endsWith(".webm") ||
    val.includes("videoplayback") ||
    val.includes("discordapp")
  ) {
    return {
      id: bg.value,
      name: bg.name || "Live Shader",
      url: rawVal,
      posterUrl: bg.posterUrl || "",
    };
  }

  // 3. Fallbacks for preset keywords if value is just an ID keyword
  if (val.includes("miku") || name.includes("miku")) return LIVE_SHADERS[0];
  if (val.includes("videoplayback_1") || val.includes("cosmic") || name.includes("cosmic")) return LIVE_SHADERS[2];
  if (val.includes("videoplayback") || val.includes("scenery") || name.includes("anime")) return LIVE_SHADERS[1];
  if (val.includes("batman") || val.includes("vengeance") || name.includes("batman")) return LIVE_SHADERS[3];
  if (val.includes("okayu") || val.includes("hololive") || name.includes("okayu")) return LIVE_SHADERS[4];
  if (val.includes("pool") || name.includes("pool")) return LIVE_SHADERS[5];
  if (val.includes("forest") || val.includes("earthy") || name.includes("forest")) return LIVE_SHADERS[6];
  if (val.includes("passive_income") || val.includes("modern") || name.includes("modern")) return LIVE_SHADERS[7];
  if (val.includes("leafy") || val.includes("quiet") || name.includes("leafy")) return LIVE_SHADERS[8];

  return null;
}

export function backgroundCss(value: string) {
  if (!value) return ROOM_PRESETS[0].preview;
  const matchPreset = ROOM_PRESETS.find(
    (p) => p.id === value || p.value === value
  );
  if (matchPreset) return matchPreset.preview;

  if (value.startsWith("url(") || value.startsWith("linear-gradient")) {
    return value;
  }
  if (
    value.startsWith("#") ||
    value.startsWith("rgb") ||
    value.startsWith("hsl") ||
    value.startsWith("oklch")
  ) {
    return value;
  }
  if (value.startsWith("data:") || value.startsWith("http") || value.startsWith("blob:")) {
    return `url("${value}") center / cover no-repeat`;
  }
  return value;
}
