import type { Background } from "@/lib/types";

type Rgb = { r: number; g: number; b: number };

const NAMED: Record<string, Rgb> = {
  white: { r: 255, g: 255, b: 255 },
  black: { r: 0, g: 0, b: 0 },
  ivory: { r: 255, g: 255, b: 240 },
  snow: { r: 255, g: 250, b: 250 },
  whitesmoke: { r: 245, g: 245, b: 245 },
  ghostwhite: { r: 248, g: 248, b: 255 },
};

const LIGHT_LUMA = 0.55;

function hexToRgb(hex: string): Rgb | null {
  const h = hex.replace("#", "").trim();
  if (h.length === 3 || h.length === 4) {
    const r = Number.parseInt(h[0] + h[0], 16);
    const g = Number.parseInt(h[1] + h[1], 16);
    const b = Number.parseInt(h[2] + h[2], 16);
    if ([r, g, b].some(Number.isNaN)) return null;
    return { r, g, b };
  }
  if (h.length === 6 || h.length === 8) {
    const r = Number.parseInt(h.slice(0, 2), 16);
    const g = Number.parseInt(h.slice(2, 4), 16);
    const b = Number.parseInt(h.slice(4, 6), 16);
    if ([r, g, b].some(Number.isNaN)) return null;
    return { r, g, b };
  }
  return null;
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const sat = s / 100;
  const light = l / 100;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return light - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  };
  return {
    r: Math.round(f(0) * 255),
    g: Math.round(f(8) * 255),
    b: Math.round(f(4) * 255),
  };
}

function parseFunctionColor(value: string): Rgb | null {
  const match = value.match(/^(rgba?|hsla?)\(\s*([^)]+)\s*\)$/i);
  if (!match) return null;
  const kind = match[1].toLowerCase();
  const parts = match[2].split(/[\s,/]+/).filter(Boolean);
  if (parts.length < 3) return null;
  if (kind.startsWith("hsl")) {
    const h = Number.parseFloat(parts[0]);
    const s = Number.parseFloat(parts[1]);
    const l = Number.parseFloat(parts[2]);
    if ([h, s, l].some(Number.isNaN)) return null;
    return hslToRgb(h, s, l);
  }
  const r = Number.parseFloat(parts[0]);
  const g = Number.parseFloat(parts[1]);
  const b = Number.parseFloat(parts[2]);
  if ([r, g, b].some(Number.isNaN)) return null;
  return { r, g, b };
}

export function parseCssColor(value: string): Rgb | null {
  const v = value.trim().toLowerCase();
  if (NAMED[v]) return NAMED[v];
  if (v.startsWith("#")) return hexToRgb(v);
  if (v.startsWith("rgb") || v.startsWith("hsl")) return parseFunctionColor(v);
  return null;
}

function relativeLuminance({ r, g, b }: Rgb) {
  const toLinear = (channel: number) => {
    const s = channel / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function isLightColor(value: string) {
  const rgb = parseCssColor(value);
  if (!rgb) return false;
  return relativeLuminance(rgb) > LIGHT_LUMA;
}

export function isLightBackground(background: Background) {
  if (background.kind === "video" || background.kind === "url" || background.kind === "upload") {
    return false;
  }

  const direct = parseCssColor(background.value);
  if (direct) return relativeLuminance(direct) > LIGHT_LUMA;

  const hexes = background.value.match(/#(?:[0-9a-f]{3,8})\b/gi) ?? [];
  const samples = hexes.map(hexToRgb).filter((rgb): rgb is Rgb => Boolean(rgb));
  if (!samples.length) return false;

  const average = samples.reduce((sum, rgb) => sum + relativeLuminance(rgb), 0) / samples.length;
  return average > LIGHT_LUMA;
}
