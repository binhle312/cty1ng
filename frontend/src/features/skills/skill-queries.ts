import { SETTING_DEFAULTS } from "@cty1ng/shared/settings";
import type { SkillLimits } from "@cty1ng/shared/skills";
import { useQuery } from "@tanstack/react-query";
import {
  getSettingsOptions,
  listSkillsOptions,
} from "../../lib/api/generated/@tanstack/react-query.gen.ts";
import type { ListSkillsResponse } from "../../lib/api/generated/types.gen.ts";

export type SkillRow = ListSkillsResponse[number];

// The page always loads deprecated skills too, so the URL of a deprecated skill opens after a
// reload; Show deprecated only filters the rows on screen (skills-page.md §1).
export const allSkillsOptions = () => listSkillsOptions({ query: { include_deprecated: "true" } });

export function useAllSkills() {
  return useQuery(allSkillsOptions());
}

// The editor's limits come from `GET /settings`, so its counters and errors match the server
// (skills-page.md, "Requirement changes"). Until the settings load, the defaults apply.
export interface EditorSettings {
  limits: SkillLimits;
  warnLines: number;
  trashDays: number;
}

export function useEditorSettings(): EditorSettings {
  const { data } = useQuery(getSettingsOptions());
  const settings = data ?? SETTING_DEFAULTS;
  return {
    limits: { nameMax: settings.skill_name_max, bodyMax: settings.skill_body_max },
    warnLines: settings.skill_body_warn_lines,
    trashDays: settings.trash_days,
  };
}

// "used by 3 bots, 1 on an older version" (skills-page.md §2).
export function usedByLine(skill: Pick<SkillRow, "bots_using" | "bots_outdated">): string {
  const bots = skill.bots_using === 1 ? "1 bot" : `${String(skill.bots_using)} bots`;
  return skill.bots_outdated > 0
    ? `used by ${bots}, ${String(skill.bots_outdated)} on an older version`
    : `used by ${bots}`;
}
