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

// A pin joins a bot and a skill: both sides show it, and each side's counts move with it.
export const SKILL_OR_BOT_QUERIES = (query: Query): boolean =>
  SKILL_QUERIES(query) || BOT_QUERIES(query);
