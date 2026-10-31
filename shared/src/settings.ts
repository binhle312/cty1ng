import { z } from "zod";

// The settings that are built so far, with their defaults and ranges (domain-model.md §10, the
// one source for the Zod schema of `PATCH /settings`). Each slice adds its keys here. A key with
// no row in the `settings` table has its default.

const WholeNumber = z.number().int();

export const SETTING_SCHEMAS = {
  // Days an item stays in Trash (D49, D62). At least 1, no upper limit.
  trash_days: WholeNumber.min(1),
  // Skill limits (M1 spec gap pass): app choices, not the Agent Skills format rules.
  skill_name_max: WholeNumber.min(16).max(128),
  skill_body_max: WholeNumber.min(1_000).max(100_000),
  skill_body_warn_lines: WholeNumber.min(50).max(5_000),
} as const;

export const SETTING_DEFAULTS = {
  trash_days: 30,
  skill_name_max: 64,
  skill_body_max: 20_000,
  skill_body_warn_lines: 500,
} as const satisfies { [K in keyof typeof SETTING_SCHEMAS]: z.infer<(typeof SETTING_SCHEMAS)[K]> };

export const Settings = z.object(SETTING_SCHEMAS).strict();
export type Settings = z.infer<typeof Settings>;
export type SettingKey = keyof Settings;
export const SETTING_KEYS = Settings.keyof().options;

// A PATCH changes only the keys it names; an unknown key fails (api.md §1, `.strict()`).
export const SettingsPatch = Settings.partial();
export type SettingsPatch = z.infer<typeof SettingsPatch>;
