import { useEffect, useRef, useState } from "react";
import { showToast } from "../../components/ui/toast.tsx";

// The dialogs of a tab that each send one request (the pin dialogs of a bot's Skills tab and of a
// skill's Bots tab; bot-page.md §7, skills-page.md §2a). A request's result goes to the dialog
// that sent it while that dialog is open. After the owner closed it (Skip, Esc, another dialog,
// or the tab went), a success needs nothing more, because the list updates, and a failure shows
// as a toast, because no dialog would show it. Each open makes a new object, so a request never
// closes or writes into a newer dialog.
export function useDialogRequests<D extends object>({ refresh }: { refresh: () => unknown }) {
  const [dialog, setDialog] = useState<D | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<D | null>(null);
  // The dialog on screen, for an answer that comes later.
  const shown = useRef<D | null>(null);
  useEffect(() => {
    shown.current = dialog;
  }, [dialog]);
  // When the tab goes, no dialog is open any more.
  useEffect(
    () => () => {
      shown.current = null;
    },
    [],
  );

  const open = (next: D | null) => {
    shown.current = next;
    setDialog(next);
    setError(null);
  };
  const close = () => {
    open(null);
  };
  // Closes during render, when what the dialog is about is gone (a skill that left the bot in
  // another place); the ref follows after the render.
  const closeNow = () => {
    setDialog(null);
    setError(null);
  };

  const run = <T>({
    dialog: sent,
    request,
    done,
    failed,
    closes = () => false,
  }: {
    dialog: D;
    request: Promise<T>;
    done?: (result: T) => void;
    failed: (error: unknown) => string;
    // A failure that closes the dialog and shows as a toast (a stale pin, bot-page.md §7).
    closes?: (error: unknown) => boolean;
  }) => {
    setError(null);
    setBusy(sent);
    void request
      .then(
        (result) => {
          done?.(result);
          void refresh();
          if (shown.current === sent) close();
        },
        (cause: unknown) => {
          void refresh();
          const isOpen = shown.current === sent;
          if (isOpen && !closes(cause)) {
            setError(failed(cause));
            return;
          }
          if (isOpen) close();
          showToast(failed(cause));
        },
      )
      .finally(() => {
        setBusy((current) => (current === sent ? null : current));
      });
  };

  return {
    dialog,
    open,
    close,
    closeNow,
    error,
    // The open dialog's request is on its way.
    pending: dialog !== null && busy === dialog,
    run,
  };
}
