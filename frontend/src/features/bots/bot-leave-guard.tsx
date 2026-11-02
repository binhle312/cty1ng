import { useBlocker } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import { z } from "zod";
import { LeaveDialog } from "../skills/leave-guard.tsx";

// Leave with unsaved changes on the bot page (bot-page.md §4.1, project-settings-page.md §5):
// Discard, Esc, ← Back, another bot, another tab or another page asks first, but only when
// something changed. "Let them go" drops the changes, then does what the owner asked. A reload or
// a closed browser tab asks the browser's own question.
const WORDS = {
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
  // Set just before the page itself leaves after a Delete: nothing is lost.
  const allowRef = useRef(false);
  // An action the owner asked for on the page (Discard, Esc), waiting for the answer.
  const [asked, setAsked] = useState<{ then: () => void } | null>(null);
  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) =>
      dirty && !allowRef.current && botPlace(current) !== botPlace(next),
    enableBeforeUnload: () => dirty && !allowRef.current,
    withResolver: true,
  });
  const allowLeave = useCallback(() => {
    allowRef.current = true;
  }, []);
  const ask = (then: () => void) => {
    if (dirty) setAsked({ then });
    else then();
  };
  const dialog = (
    <LeaveDialog
      open={blocker.status === "blocked" || asked !== null}
      text={text}
      words={WORDS}
      onStay={() => {
        setAsked(null);
        blocker.reset?.();
      }}
      onLeave={() => {
        onLetGo();
        setAsked(null);
        if (blocker.status === "blocked") blocker.proceed();
        else asked?.then();
      }}
    />
  );
  return { ask, allowLeave, dialog };
}
