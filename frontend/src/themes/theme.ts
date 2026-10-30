import { z } from "zod";
import { readStored } from "../lib/storage.ts";

// The appearance settings of design/themes.md §1, saved per browser (§2 rule 6).
// public/theme-init.js applies them before the first paint; this module applies them after
// that and follows the system mode. Keep the storage key and the defaults in step with it.
export const APPEARANCE_KEY = "cty1ng.appearance";

export const Theme = z.enum(["command"]);
export const Mode = z.enum(["system", "light", "dark"]);
export const Density = z.enum(["default", "compact"]);
export const Appearance = z.object({
  theme: Theme.catch("command"),
  mode: Mode.catch("system"),
  density: Density.catch("default"),
});
export type Appearance = z.infer<typeof Appearance>;

export const DEFAULT_APPEARANCE: Appearance = {
  theme: "command",
  mode: "system",
  density: "default",
};

export function readAppearance(): Appearance {
  return readStored(APPEARANCE_KEY, Appearance, DEFAULT_APPEARANCE);
}

// The mode that is drawn. M0 ships Command dark only (owner, 2026-10-30): until the Command
// light values are agreed, a light result shows dark.
const LIGHT_UNTIL_AGREED = "dark";

export function resolveMode(mode: Appearance["mode"], systemIsDark: boolean): "dark" {
  const light = mode === "light" || (mode === "system" && !systemIsDark);
  return light ? LIGHT_UNTIL_AGREED : "dark";
}

interface ModeQuery {
  readonly matches: boolean;
  addEventListener(type: "change", listener: () => void): void;
  removeEventListener(type: "change", listener: () => void): void;
}

// Applies an appearance to <html>. Each apply removes the listener of the one before, so
// switching many times leaves at most one listener (themes.md §5, leak check).
export function createThemeController(root: HTMLElement, systemDark: ModeQuery) {
  let stop: (() => void) | null = null;
  return {
    apply(appearance: Appearance): void {
      stop?.();
      stop = null;
      const draw = (): void => {
        root.dataset.theme = appearance.theme;
        root.dataset.mode = resolveMode(appearance.mode, systemDark.matches);
        root.dataset.density = appearance.density;
      };
      draw();
      if (appearance.mode === "system") {
        systemDark.addEventListener("change", draw);
        stop = () => {
          systemDark.removeEventListener("change", draw);
        };
      }
    },
    dispose(): void {
      stop?.();
      stop = null;
    },
  };
}
