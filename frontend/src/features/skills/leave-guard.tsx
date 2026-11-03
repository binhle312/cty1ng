import { useBlocker } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import { z } from "zod";
import { Button } from "../../components/ui/button.tsx";
import { Dialog, DialogButtons, DialogText } from "../../components/ui/dialog.tsx";

// Where the editor is: the path, and for a Clone the version it copies, because
// `/skills/new?from=…` and `/skills/new` are two editors on one path. The tab and the History
// pair are not part of it.
const EditorSearch = z.object({ from: z.string().optional().catch(undefined) });

export function editorPlace(location: { pathname: string; search: unknown }): string {
  const parsed = EditorSearch.safeParse(location.search);
  const from = parsed.success ? parsed.data.from : undefined;
  return from === undefined ? location.pathname : `${location.pathname}?from=${from}`;
}

// Leave with unsaved changes (skills-page.md §14, C6): a click on another skill, the rail or
// + Create asks first, but only when something changed. A tab of the same skill keeps the edit,
// so it does not ask; a Clone and a new skill are different editors, so a move between them
// asks. A reload or a closed browser tab asks the browser's own "Leave site?" question (§1).
// The Create bot page asks its own question (create-bot-page.md E6), so the words can change.
export interface LeaveWords {
  title: string;
  leave: string;
  stay: string;
}

const SKILL_WORDS: LeaveWords = {
  title: "Leave without saving? 👀",
  leave: "Let them go",
  stay: "Stay on this skill",
};

// Where a page is, for the question: a move to the same place keeps the edit, so it does not ask.
export type PlaceOf = (location: { pathname: string; search: unknown }) => string;

export function useLeaveGuard({
  dirty,
  text,
  words = SKILL_WORDS,
  place = editorPlace,
  onLetGo,
}: {
  dirty: boolean;
  text: string;
  words?: LeaveWords;
  place?: PlaceOf;
  // Drops every unsaved change before the page does what the owner asked.
  onLetGo?: () => void;
}) {
  // Set just before the page itself leaves after a Create, Cancel or Delete: nothing is lost.
  const allowRef = useRef(false);
  // An action the owner asked for on the page (the bot page's Discard and Esc), waiting for the
  // answer.
  const [asked, setAsked] = useState<{ then: () => void } | null>(null);
  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) =>
      dirty && !allowRef.current && place(current) !== place(next),
    enableBeforeUnload: () => dirty && !allowRef.current,
    withResolver: true,
  });
  const allowLeave = useCallback(() => {
    allowRef.current = true;
  }, []);
  // Asks first when something changed, else does it at once.
  const ask = (then: () => void) => {
    if (dirty) setAsked({ then });
    else then();
  };
  const dialog = (
    <LeaveDialog
      open={blocker.status === "blocked" || asked !== null}
      text={text}
      words={words}
      onStay={() => {
        setAsked(null);
        blocker.reset?.();
      }}
      onLeave={() => {
        onLetGo?.();
        setAsked(null);
        if (blocker.status === "blocked") blocker.proceed();
        else asked?.then();
      }}
    />
  );
  return { ask, allowLeave, dialog };
}

function LeaveDialog({
  open,
  text,
  words,
  onStay,
  onLeave,
}: {
  open: boolean;
  text: string;
  words: LeaveWords;
  onStay: () => void;
  onLeave: () => void;
}) {
  const stay = useRef<HTMLButtonElement>(null);
  return (
    <Dialog kind="alert" open={open} onClose={onStay} title={words.title} defaultButton={stay}>
      <DialogText>{text}</DialogText>
      <DialogButtons>
        <Button kind="danger" onClick={onLeave}>
          {words.leave}
        </Button>
        <Button ref={stay} kind="primary" onClick={onStay}>
          {words.stay}
        </Button>
      </DialogButtons>
    </Dialog>
  );
}
