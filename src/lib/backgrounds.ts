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

export const DEFAULT_BACKGROUND = {
  kind: "preset" as const,
  value: "lava",
};

export function getPresetById(idOrValue?: string): RoomPreset {
  if (!idOrValue) return ROOM_PRESETS[0];
  const found = ROOM_PRESETS.find(
    (p) => p.id === idOrValue || p.value === idOrValue || idOrValue.includes(p.id)
  );
  return found || ROOM_PRESETS[0];
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
  if (value.startsWith("data:") || value.startsWith("http")) {
    return `url("${value}") center / cover no-repeat`;
  }
  return value;
}
