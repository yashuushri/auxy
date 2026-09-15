export const ROOM_PRESETS = [
  {
    id: "midnight",
    name: "Midnight",
    value: "linear-gradient(160deg, #0b0b12 0%, #1b1230 48%, #0d1b2a 100%)",
  },
  {
    id: "forest",
    name: "Forest",
    value: "linear-gradient(160deg, #07140f 0%, #12352a 50%, #0b1d18 100%)",
  },
  {
    id: "ember",
    name: "Ember",
    value: "linear-gradient(160deg, #1a0b0b 0%, #3b1520 45%, #120b16 100%)",
  },
  {
    id: "ocean",
    name: "Ocean",
    value: "linear-gradient(160deg, #071018 0%, #12344d 50%, #0a1c28 100%)",
  },
  {
    id: "violet",
    name: "Violet",
    value: "linear-gradient(160deg, #120816 0%, #2b1250 48%, #1a0b2e 100%)",
  },
] as const;

export const BACKGROUND_PRESETS = ROOM_PRESETS;

export const DEFAULT_BACKGROUND = {
  kind: "preset" as const,
  value: ROOM_PRESETS[0].value,
};

export function backgroundCss(value: string) {
  if (!value) return "linear-gradient(160deg, #0b0b12 0%, #1b1230 48%, #0d1b2a 100%)";
  if (value.startsWith("url(") || value.startsWith("linear-gradient")) {
    return value;
  }
  if (value.startsWith("#") || value.startsWith("rgb") || value.startsWith("hsl") || value.startsWith("oklch")) {
    return value;
  }
  if (value.startsWith("data:") || value.startsWith("http")) {
    return `url("${value}") center / cover no-repeat`;
  }
  return value;
}
