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
    id: "bg-bright-tower",
    name: "Bright Tower",
    url: "https://cdn.discordapp.com/attachments/1551956541219934299/1551963084535627856/videoplayback.webm?ex=6ab3e1c1&is=6ab29041&hm=380108b9fca4cba7c660267eb5a8d73b74a7da0dba051e245be41933728670fd&",
    posterUrl: "/thumbnails/videoplayback.jpg",
  },
  {
    id: "bg-cyber-neon",
    name: "Cyber Neon Tunnel",
    url: "https://cdn.discordapp.com/attachments/1551956541219934299/1551963084535627856/videoplayback.webm?ex=6ab3e1c1&is=6ab29041&hm=380108b9fca4cba7c660267eb5a8d73b74a7da0dba051e245be41933728670fd&",
    posterUrl: "/thumbnails/videoplayback-1.jpg",
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
  if (!bg || bg.kind !== "video" || !bg.value) return null;
  // If this is a custom uploaded video or blob, do not resolve to preset live shader
  if (
    bg.value.startsWith("data:") ||
    bg.value.startsWith("blob:") ||
    bg.value.startsWith("indexeddb:") ||
    bg.mediaType === "video"
  ) {
    return null;
  }
  const val = String(bg.value).toLowerCase();
  const name = bg.name?.toLowerCase();
  const found = LIVE_SHADERS.find(
    (s) =>
      s.url === bg.value ||
      s.id === bg.value ||
      s.url.toLowerCase() === val ||
      s.id.toLowerCase() === val ||
      (name && s.name.toLowerCase() === name) ||
      (name && s.id.toLowerCase().includes(name)) ||
      val.includes(s.id.replace("live-", ""))
  );
  return found || null;
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
