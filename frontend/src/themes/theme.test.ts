import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createThemeController, DEFAULT_APPEARANCE } from "./theme.ts";

// design/themes.md §5: the contrast test and the leak check.
const css = readFileSync(join(import.meta.dirname, "command.css"), "utf8");
const tokens = new Map(
  [...css.matchAll(/--token-([a-z-]+):\s*(#[0-9a-f]{6});/gi)].map((m) => [m[1] ?? "", m[2] ?? ""]),
);

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(foreground: string, background: string): number {
  const f = tokens.get(foreground);
  const b = tokens.get(background);
  if (f === undefined || b === undefined)
    throw new Error(`no token ${foreground} or ${background}`);
  const [hi, lo] = [luminance(f), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

const SURFACES = ["surface", "surface-container", "surface-raised", "surface-bubble"];
// Text and icons drawn on the surfaces (WCAG AA 4.5:1; ui-rules L3).
const TEXT_ON_SURFACES = [
  "on-surface",
  "on-surface-muted",
  "primary",
  "running",
  "waiting",
  "danger",
  "success",
];

describe("Command dark tokens", () => {
  it.each(TEXT_ON_SURFACES.flatMap((text) => SURFACES.map((surface) => [text, surface])))(
    "%s on %s reaches 4.5:1",
    (text, surface) => {
      expect(contrast(text, surface)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each([
    ["on-primary", "primary"],
    ["primary", "primary-tint"],
    ["on-surface", "primary-container"],
  ])("%s on %s reaches 4.5:1", (text, surface) => {
    expect(contrast(text, surface)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("theme controller", () => {
  it("leaves at most one system-mode listener after 50 switches", () => {
    let listeners = 0;
    const media = {
      matches: true,
      addEventListener: () => {
        listeners += 1;
      },
      removeEventListener: () => {
        listeners -= 1;
      },
    };
    const root = document.createElement("html");
    const controller = createThemeController(root, media);
    for (let i = 0; i < 50; i += 1) {
      controller.apply({ ...DEFAULT_APPEARANCE, mode: i % 2 === 0 ? "system" : "dark" });
      controller.apply(DEFAULT_APPEARANCE);
    }
    expect(listeners).toBe(1);
    expect(root.dataset).toMatchObject({ theme: "command", mode: "dark", density: "default" });
    controller.dispose();
    expect(listeners).toBe(0);
  });

  it("shows dark for every mode until the Command light values are agreed", () => {
    const root = document.createElement("html");
    const controller = createThemeController(root, {
      matches: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    });
    for (const mode of ["system", "light", "dark"] as const) {
      controller.apply({ ...DEFAULT_APPEARANCE, mode });
      expect(root.dataset.mode).toBe("dark");
    }
  });
});
