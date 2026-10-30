import { useMatches } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { readStored, writeStored } from "../../lib/storage.ts";

// Whether bar 2 shows (left-bar.md §4). The owner's choice is saved per browser and is
// visible by default (M0c plan, decision E). A page can also hide the bar while it is open
// (the New project page, M5b) with the route's `staticData.hidesBarTwo`; that never changes
// the saved choice.
export const SHELL_KEY = "cty1ng.shell";
const ShellPrefs = z.object({ barTwoHidden: z.boolean() });

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    hidesBarTwo?: boolean;
  }
}

export function useBarTwo() {
  const [hiddenByOwner, setHiddenByOwner] = useState(
    () => readStored(SHELL_KEY, ShellPrefs, { barTwoHidden: false }).barTwoHidden,
  );
  const hiddenByPage = useMatches({
    select: (matches) => matches.some((match) => match.staticData.hidesBarTwo === true),
  });

  const setHidden = useCallback((barTwoHidden: boolean) => {
    setHiddenByOwner(barTwoHidden);
    writeStored(SHELL_KEY, { barTwoHidden });
  }, []);

  return { hidden: hiddenByOwner || hiddenByPage, hiddenByOwner, setHidden };
}

// Ctrl+B hides and shows bar 2, except while the focus is in a place where the owner types:
// there the key keeps its own job (bold in a Markdown box, composer.md §5.1) and the shell does
// not stop it (M0c plan, decision F).
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return (
    target.closest(
      "input, textarea, select, [contenteditable]:not([contenteditable='false']), [role='textbox']",
    ) !== null
  );
}

export function isToggleKey(event: KeyboardEvent): boolean {
  return (
    event.ctrlKey &&
    !event.altKey &&
    !event.shiftKey &&
    !event.metaKey &&
    event.key.toLowerCase() === "b"
  );
}

export function useToggleKey(onToggle: () => void): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!isToggleKey(event) || event.defaultPrevented || isTypingTarget(event.target)) return;
      event.preventDefault();
      onToggle();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onToggle]);
}
