import { BOT_PALETTE } from "../../themes/bot-palette.ts";

// The bot colour (bot-avatar.md §5): any colour as #RRGGBB. The swatches are the theme's bot
// palette (themes/bot-palette.ts); the backend stores and checks only the format.
export { BOT_PALETTE };

// Random keeps saturation and lightness in a range, so it never picks near black, near white or
// grey (owner, 2026-10-24). A frontend config value, not a rule.
export const RANDOM_COLOUR_RANGE = {
  saturation: { min: 45, max: 90 },
  lightness: { min: 45, max: 70 },
} as const;

const HEX = /^#[0-9A-Fa-f]{6}$/;

export function isHexColour(value: string): boolean {
  return HEX.test(value);
}

function sameColour(a: string, b: string): boolean {
  return a.toUpperCase() === b.toUpperCase();
}

export function isPaletteColour(colour: string): boolean {
  return BOT_PALETTE.some((swatch) => sameColour(swatch, colour));
}

// `random` returns a number in [0, 1), as Math.random does; tests pass their own.
type Random = () => number;

function pickOne<T>(items: readonly T[], random: Random): T | undefined {
  return items[Math.floor(random() * items.length)];
}

// The default colour at create and Clone: a random swatch that no other bot uses; any swatch
// when all are used (bot-avatar.md §5).
export function defaultBotColour(usedColours: readonly string[], random: Random): string {
  const free = BOT_PALETTE.filter(
    (swatch) => !usedColours.some((used) => sameColour(used, swatch)),
  );
  return pickOne(free, random) ?? pickOne(BOT_PALETTE, random) ?? BOT_PALETTE[0];
}

// Random: any hue, with saturation and lightness inside RANDOM_COLOUR_RANGE.
export function randomBotColour(random: Random): string {
  const { saturation, lightness } = RANDOM_COLOUR_RANGE;
  const h = random() * 360;
  const s = saturation.min + random() * (saturation.max - saturation.min);
  const l = lightness.min + random() * (lightness.max - lightness.min);
  return rgbToHex(hslToRgb({ h, s, l }));
}

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Hsv {
  // 0–360
  h: number;
  // 0–100
  s: number;
  // 0–100
  v: number;
}

function hslToRgb({ h, s, l }: { h: number; s: number; l: number }): Rgb {
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255) };
}

export function hexToRgb(hex: string): Rgb {
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const part = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0")
      .toUpperCase();
  return `#${part(r)}${part(g)}${part(b)}`;
}

export function rgbToHsv({ r, g, b }: Rgb): Hsv {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = 60 * (((gn - bn) / d) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / d + 2);
    else h = 60 * ((rn - gn) / d + 4);
  }
  if (h < 0) h += 360;
  return { h, s: max === 0 ? 0 : (d / max) * 100, v: max * 100 };
}

export function hsvToRgb({ h, s, v }: Hsv): Rgb {
  const sat = s / 100;
  const val = v / 100;
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return val - val * sat * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return { r: Math.round(f(5) * 255), g: Math.round(f(3) * 255), b: Math.round(f(1) * 255) };
}

// Text on a bot colour is black or white, whichever has the higher contrast, because a custom
// colour can be light or dark (bot-avatar.md §5). WCAG relative luminance of `#RRGGBB`.
export function readableOn(colour: string): "black" | "white" {
  const { r, g, b } = hexToRgb(colour);
  const channel = (value255: number) => {
    const value = value255 / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  // Black beats white when the luminance is above about 0.179 (the point where both contrast
  // ratios are equal).
  return luminance > 0.179 ? "black" : "white";
}
