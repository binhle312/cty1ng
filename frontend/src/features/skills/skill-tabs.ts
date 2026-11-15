// The tabs of the skill page (skills-page.md §1), in their order. The route's `?tab=` and the page
// read this one list.
export const SKILL_TABS = ["skill", "bots", "history"] as const;

export type SkillTab = (typeof SKILL_TABS)[number];
