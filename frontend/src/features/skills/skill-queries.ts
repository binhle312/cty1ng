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
// (skills-page.md, "Requirement changes"). The defaults can differ from the owner's saved
// limits, so until the settings load no limit applies: the counters show only the length, and
// Save and Create stay off (`limitsKnown`). A failed load shows an error with Try again
// (owner, 2026-10-31). The other values are not limits, and their defaults apply meanwhile.
export interface EditorSettings {
  limits: SkillLimits;
  limitsKnown: boolean;
  limitsFailed: boolean;
  retry: () => void;
  warnLines: number;
  trashDays: number;
}

const NO_LIMITS: SkillLimits = {
  nameMax: Number.POSITIVE_INFINITY,
  bodyMax: Number.POSITIVE_INFINITY,
};

export function useEditorSettings(): EditorSettings {
  const { data, isError, refetch } = useQuery(getSettingsOptions());
  const settings = data ?? SETTING_DEFAULTS;
  return {
    limits:
      data === undefined
        ? NO_LIMITS
        : { nameMax: data.skill_name_max, bodyMax: data.skill_body_max },
    limitsKnown: data !== undefined,
    limitsFailed: data === undefined && isError,
    retry: () => void refetch(),
    warnLines: settings.skill_body_warn_lines,
    trashDays: settings.trash_days,
  };
}

// Why Save or Create is off while the limits are not known, or null.
export function limitsReason(settings: EditorSettings): string | null {
  if (settings.limitsKnown) return null;
  return settings.limitsFailed ? "The limits did not load." : "Loading the limits.";
}

// "used by 3 bots, 1 on an older version" (skills-page.md §2).
export function usedByLine(skill: Pick<SkillRow, "bots_using" | "bots_outdated">): string {
  const bots = skill.bots_using === 1 ? "1 bot" : `${String(skill.bots_using)} bots`;
  return skill.bots_outdated > 0
    ? `used by ${bots}, ${String(skill.bots_outdated)} on an older version`
    : `used by ${bots}`;
}
