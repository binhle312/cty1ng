import type { Appearance } from "./theme.ts";

// The only structural differences between themes (design/themes.md §2 rule 3). Anything else
// needs that document updated first. Material (slice T2) adds its row.
interface Variant {
  // Labels under the rail icons.
  railLabels: boolean;
  // Keyboard hints inside buttons.
  keyboardHints: boolean;
}

export const VARIANTS: Record<Appearance["theme"], Variant> = {
  command: { railLabels: false, keyboardHints: true },
};
