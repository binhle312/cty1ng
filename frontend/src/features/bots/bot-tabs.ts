// The tabs of the bot page (bot-page.md §1), in their order. The route's `?tab=`, the page and
// the leave question read this one list.
export const BOT_TABS = ["profile", "skills", "model", "activity", "usage"] as const;

export type BotTab = (typeof BOT_TABS)[number];
