// The bot colours of the theme (design/themes.md §3, `bot-1` … `bot-10`): the 10 swatches of
// the colour row. The palette is frontend only and the same in every theme; the backend stores
// and checks only `#RRGGBB` (bot-avatar.md §5). The first eight are the swatches of the agreed
// previews (round 9); the last two fill the row to ten (M2b, for the owner's review).
export const BOT_PALETTE = [
  "#6FA8FF",
  "#C98BFF",
  "#6FD6A0",
  "#FFB36B",
  "#5CD6D6",
  "#FF8FB0",
  "#E8D36A",
  "#FF8A80",
  "#B5E36A",
  "#8F9BFF",
] as const;

// The fixed colours of the slime art (design/assets/avatars/flat-*.svg): the eyes and mouth,
// the blush and the shine. They are part of the drawing, the same on every bot colour.
export const SLIME_ART = {
  face: "#0E0F11",
  blush: "#FF8FB0",
  shine: "#FFFFFF",
} as const;

// The Custom colour card (bot-avatar.md §5): the hue bar and the saturation and value box
// show every colour, so they are not theme tokens.
export const PICKER_GRADIENTS = {
  hue: "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)",
  satVal:
    "linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)",
} as const;
