import type { Query } from "@tanstack/react-query";

// The generated query keys start with `{ _id: <operationId> }` (Hey API). Every skill operation
// id has "Skill" in it, every bot one "Bot" and every settings one "Settings" (api.md §2, §4,
// §7). The realtime reducer and the mutations use these to refresh a whole group of queries.
function operationMatches(pattern: RegExp) {
  return (query: Query): boolean => {
    const [first] = query.queryKey;
    return (
      typeof first === "object" &&
      first !== null &&
      "_id" in first &&
      typeof first._id === "string" &&
      pattern.test(first._id)
    );
  };
}

export const SKILL_QUERIES = operationMatches(/Skill/);
export const BOT_QUERIES = operationMatches(/Bot/);
export const SETTINGS_QUERIES = operationMatches(/Settings/);

// A settings change can move the bot list: its order follows `bot_order` (bots.md UI-4.5).
export const SETTINGS_OR_BOT_QUERIES = (query: Query): boolean =>
  SETTINGS_QUERIES(query) || BOT_QUERIES(query);

// A skill change moves both sides: a bot's pins show the skill's name, latest version and state.
export const SKILL_OR_BOT_QUERIES = (query: Query): boolean =>
  SKILL_QUERIES(query) || BOT_QUERIES(query);

// The skill queries whose answer counts pins (`bots_using`, `bots_outdated`, the upgrade
// candidates). A diff, an export or a version's text never changes with a pin.
const SKILL_PIN_QUERIES = operationMatches(
  /^(listSkills|getSkill|listSkillVersions|getSkillVersion|listSkillUpgradeCandidates)$/,
);

// A pin or bot change: the bot queries, and the skill queries that count pins.
export const PIN_QUERIES = (query: Query): boolean =>
  BOT_QUERIES(query) || SKILL_PIN_QUERIES(query);
