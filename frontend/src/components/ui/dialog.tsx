import { AlertDialog as BaseAlertDialog } from "@base-ui/react/alert-dialog";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import type { ReactNode, RefObject } from "react";
import { cn } from "../../lib/cn.ts";

// Dialogs on Base UI: the focus stays inside, Esc closes, and the focus goes back to where it
// was. A `card` closes with no change on a click outside (buttons.md §3, the bot, import and
// export lists); an `alert` asks a question and closes only with one of its buttons (Leave
// without saving, Delete).
interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  // The button that Enter presses when the dialog opens (buttons.md §3).
  defaultButton: RefObject<HTMLButtonElement | null>;
  // `alert`: a click outside does not close it.
  kind?: "card" | "alert";
  className?: string;
}

const BACKDROP = "fixed inset-0 z-40 bg-surface/70";
const POPUP =
  "fixed top-1/2 left-1/2 z-50 w-dialog -translate-x-1/2 -translate-y-1/2 rounded-card border border-outline-strong bg-surface-raised p-5 text-on-surface shadow-2xl outline-none";
const TITLE = "text-lg font-semibold";

export function Dialog({
  open,
  onClose,
  title,
  children,
  defaultButton,
  kind = "card",
  className,
}: DialogProps) {
  const onOpenChange = (next: boolean) => {
    if (!next) onClose();
  };
  if (kind === "alert") {
    return (
      <BaseAlertDialog.Root open={open} onOpenChange={onOpenChange}>
        <BaseAlertDialog.Portal>
          <BaseAlertDialog.Backdrop className={BACKDROP} />
          <BaseAlertDialog.Popup initialFocus={defaultButton} className={cn(POPUP, className)}>
            <BaseAlertDialog.Title className={TITLE}>{title}</BaseAlertDialog.Title>
            {children}
          </BaseAlertDialog.Popup>
        </BaseAlertDialog.Portal>
      </BaseAlertDialog.Root>
    );
  }
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className={BACKDROP} />
        <BaseDialog.Popup initialFocus={defaultButton} className={cn(POPUP, className)}>
          <BaseDialog.Title className={TITLE}>{title}</BaseDialog.Title>
          {children}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}

export function DialogText({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-on-surface-muted">{children}</p>;
}

// The buttons at the bottom right, the primary or danger fill button last (buttons.md §3).
export function DialogButtons({ children }: { children: ReactNode }) {
  return <div className="mt-5 flex justify-end gap-2">{children}</div>;
}
