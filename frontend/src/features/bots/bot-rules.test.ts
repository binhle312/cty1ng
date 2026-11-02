import { describe, expect, it } from "vitest";
import { makeBot } from "../../../test/fixtures.ts";
import {
  BOT_PALETTE,
  defaultBotColour,
  hexToRgb,
  hsvToRgb,
  isPaletteColour,
  randomBotColour,
  RANDOM_COLOUR_RANGE,
  rgbToHex,
  rgbToHsv,
} from "./bot-colours.ts";
import { othersOf, pinnedOf, withoutPin, withPin, withPinAt, withPinMoved } from "./bot-pins.ts";

// A fixed sequence for `random`, so a test knows what it picks.
function sequence(...values: number[]) {
  let i = 0;
  return () => values[i++ % values.length] ?? 0;
}

describe("the default colour (bot-avatar.md §5)", () => {
  it("is a swatch that no bot uses", () => {
    const used = BOT_PALETTE.slice(0, 9).map((c) => c.toLowerCase());
    expect(defaultBotColour(used, sequence(0.5))).toBe(BOT_PALETTE[9]);
  });

  it("is any swatch when every swatch is used", () => {
    expect(isPaletteColour(defaultBotColour([...BOT_PALETTE], sequence(0.3)))).toBe(true);
  });
});

describe("Random", () => {
  it("stays inside the saturation and lightness range", () => {
    for (const r of [0, 0.25, 0.5, 0.99]) {
      const { r: red, g, b } = hexToRgb(randomBotColour(sequence(r, r, r)));
      const max = Math.max(red, g, b) / 255;
      const min = Math.min(red, g, b) / 255;
      const lightness = ((max + min) / 2) * 100;
      expect(lightness).toBeGreaterThanOrEqual(RANDOM_COLOUR_RANGE.lightness.min - 1);
      expect(lightness).toBeLessThanOrEqual(RANDOM_COLOUR_RANGE.lightness.max + 1);
    }
  });
});

describe("the colour conversions of the Custom card", () => {
  it("go from hex to HSV and back", () => {
    for (const hex of BOT_PALETTE) {
      expect(rgbToHex(hsvToRgb(rgbToHsv(hexToRgb(hex))))).toBe(hex.toUpperCase());
    }
  });
});

describe("the pinned list", () => {
  const a = makeBot(1, "A", [], { pinned_position: 1 });
  const b = makeBot(2, "B", [], { pinned_position: 0 });
  const c = makeBot(3, "C");

  it("splits the bots into pinned, by position, and others", () => {
    expect(pinnedOf([a, b, c]).map((bot) => bot.name)).toEqual(["B", "A"]);
    expect(othersOf([a, b, c]).map((bot) => bot.name)).toEqual(["C"]);
  });

  it("pins at the end, unpins, and moves a pin", () => {
    expect(withPin(["a", "b"], "c")).toEqual(["a", "b", "c"]);
    expect(withPin(["a", "b"], "a")).toEqual(["a", "b"]);
    expect(withoutPin(["a", "b"], "a")).toEqual(["b"]);
    expect(withPinAt(["a", "b", "c"], "c", 0)).toEqual(["c", "a", "b"]);
    expect(withPinAt(["a", "b"], "x", 1)).toEqual(["a", "x", "b"]);
    expect(withPinMoved(["a", "b", "c"], "b", 1)).toEqual(["a", "c", "b"]);
    expect(withPinMoved(["a", "b", "c"], "a", -1)).toEqual(["a", "b", "c"]);
  });
});
