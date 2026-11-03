import { z } from "zod";
import { type LeaveWords, useLeaveGuard } from "../skills/leave-guard.tsx";

// Leave with unsaved changes on the bot page (bot-page.md §4.1, project-settings-page.md §5):
// Discard, Esc, ← Back, another bot, another tab or another page asks first, but only when
// something changed. "Let them go" drops the changes, then does what the owner asked. A reload or
// a closed browser tab asks the browser's own question.
const WORDS: LeaveWords = {
  title: "Leave without saving? 👀",
  leave: "Let them go",
  stay: "Stay on this page",
};

// The place on the bot page: the bot and the tab. The Usage view and range are not part of it.
const PageSearch = z.object({ tab: z.string().optional().catch(undefined) });

function botPlace(location: { pathname: string; search: unknown }): string {
  const parsed = PageSearch.safeParse(location.search);
  const tab = (parsed.success ? parsed.data.tab : undefined) ?? "profile";
  return `${location.pathname}?tab=${tab}`;
}

export function useBotLeaveGuard({
  dirty,
  text,
  onLetGo,
}: {
  dirty: boolean;
  text: string;
  // Drops every unsaved change.
  onLetGo: () => void;
}) {
  return useLeaveGuard({ dirty, text, words: WORDS, place: botPlace, onLetGo });
}
