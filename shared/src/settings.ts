import { z } from "zod";

// The settings that are built so far, with their defaults and ranges (domain-model.md §10, the
// one source for the Zod schema of `PATCH /settings`). Each slice adds its keys here. A key with
// no row in the `settings` table has its default.

const WholeNumber = z.number().int();
// The history share settings move in steps of 5 % (domain-model.md §10).
const Pct = (min: number, max: number) => WholeNumber.min(min).max(max).multipleOf(5);

export const SETTING_SCHEMAS = {
  // Days an item stays in Trash (D49, D62). At least 1, no upper limit.
  trash_days: WholeNumber.min(1),
  // Skill limits (M1 spec gap pass): app choices, not the Agent Skills format rules.
  skill_name_max: WholeNumber.min(16).max(128),
  skill_body_max: WholeNumber.min(1_000).max(100_000),
  skill_body_warn_lines: WholeNumber.min(50).max(5_000),
  // Bot limits and defaults (M2 spec gap pass): a lower limit never changes a saved bot.
  bot_name_max: WholeNumber.min(16).max(64),
  bot_description_max: WholeNumber.min(80).max(500),
  bot_persona_max: WholeNumber.min(1_000).max(32_000),
  bot_history_min_pct: Pct(5, 50),
  bot_history_max_pct: Pct(50, 90),
  bot_default_history_pct: Pct(5, 90),
  bot_default_request_limit: WholeNumber.min(1).max(100),
  bot_default_max_reply_chars: WholeNumber.min(500).max(20_000),
  // Health thresholds (bots.md UI-4.6); M2 has no runs, so only the ranges are used yet.
  health_recent_runs: WholeNumber.min(1).max(50),
  health_failed_runs: WholeNumber.min(1).max(50),
  health_limit_stops: WholeNumber.min(1).max(50),
  health_limit_window_days: WholeNumber.min(1).max(30),
  // The order of bots that are not pinned (bots.md UI-4.5).
  bot_order: z.enum(["recent", "created"]),
  bot_order_direction: z.enum(["desc", "asc"]),
} as const;

export const SETTING_DEFAULTS = {
  trash_days: 30,
  skill_name_max: 64,
  skill_body_max: 20_000,
  skill_body_warn_lines: 500,
  bot_name_max: 32,
  bot_description_max: 160,
  bot_persona_max: 8_000,
  bot_history_min_pct: 10,
  bot_history_max_pct: 80,
  bot_default_history_pct: 40,
  bot_default_request_limit: 30,
  bot_default_max_reply_chars: 6_000,
  health_recent_runs: 5,
  health_failed_runs: 2,
  health_limit_stops: 3,
  health_limit_window_days: 7,
  bot_order: "recent",
  bot_order_direction: "desc",
} as const satisfies { [K in keyof typeof SETTING_SCHEMAS]: z.infer<(typeof SETTING_SCHEMAS)[K]> };

export const Settings = z.object(SETTING_SCHEMAS).strict();
export type Settings = z.infer<typeof Settings>;
export type SettingKey = keyof Settings;
export const SETTING_KEYS = Settings.keyof().options;

// A PATCH changes only the keys it names; an unknown key fails (api.md §1, `.strict()`).
export const SettingsPatch = Settings.partial();
export type SettingsPatch = z.infer<typeof SettingsPatch>;

// Rules between two keys (domain-model.md §10 "Cross-field checks"): a save that breaks one is
// refused with the key that the save changed; the app never changes the other value. Returns
// null when every rule holds.
export function settingsCrossFieldProblem(
  settings: Settings,
  changed: readonly SettingKey[],
): { key: SettingKey; message: string } | null {
  const rules: { keys: readonly SettingKey[]; holds: boolean; message: string }[] = [
    {
      keys: ["bot_history_min_pct", "bot_history_max_pct"],
      holds: settings.bot_history_min_pct < settings.bot_history_max_pct,
      message: "The lowest history share must be below the highest.",
    },
    {
      keys: ["bot_default_history_pct", "bot_history_min_pct", "bot_history_max_pct"],
      holds:
        settings.bot_history_min_pct <= settings.bot_default_history_pct &&
        settings.bot_default_history_pct <= settings.bot_history_max_pct,
      message: "The default history share must be between the lowest and the highest.",
    },
    {
      keys: ["health_failed_runs", "health_recent_runs"],
      holds: settings.health_failed_runs <= settings.health_recent_runs,
      message: "Failed runs cannot be more than the recent runs they are counted in.",
    },
  ];
  for (const rule of rules) {
    if (rule.holds) continue;
    const key = rule.keys.find((candidate) => changed.includes(candidate)) ?? rule.keys[0];
    if (key !== undefined) return { key, message: rule.message };
  }
  return null;
}
