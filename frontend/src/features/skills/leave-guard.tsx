import { useBlocker } from "@tanstack/react-router";
import { useCallback, useRef } from "react";
import { Button } from "../../components/ui/button.tsx";
import { Dialog, DialogButtons, DialogText } from "../../components/ui/dialog.tsx";

// Leave with unsaved changes (skills-page.md §14, C6): a click on another skill, the rail or
// + Create asks first, but only when something changed. A tab of the same skill keeps the edit,
// so it does not ask. A reload or a closed browser tab asks the browser's own "Leave site?"
// question (§1).
export function useLeaveGuard({ dirty, text }: { dirty: boolean; text: string }) {
  // Set just before the page itself leaves after a Create, Cancel or Delete: nothing is lost.
  const allowRef = useRef(false);
  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) =>
      dirty && !allowRef.current && current.pathname !== next.pathname,
    enableBeforeUnload: () => dirty && !allowRef.current,
    withResolver: true,
  });
  const allowLeave = useCallback(() => {
    allowRef.current = true;
  }, []);
  const dialog = (
    <LeaveDialog
      open={blocker.status === "blocked"}
      text={text}
      onStay={() => blocker.reset?.()}
      onLeave={() => blocker.proceed?.()}
    />
  );
  return { allowLeave, dialog };
}

function LeaveDialog({
  open,
  text,
  onStay,
  onLeave,
}: {
  open: boolean;
  text: string;
  onStay: () => void;
  onLeave: () => void;
}) {
  const stay = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      kind="alert"
      open={open}
      onClose={onStay}
      title="Leave without saving? 👀"
      defaultButton={stay}
    >
      <DialogText>{text}</DialogText>
      <DialogButtons>
        <Button kind="danger" onClick={onLeave}>
          Let them go
        </Button>
        <Button ref={stay} kind="primary" onClick={onStay}>
          Stay on this skill
        </Button>
      </DialogButtons>
    </Dialog>
  );
}
