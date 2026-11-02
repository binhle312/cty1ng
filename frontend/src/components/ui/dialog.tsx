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
// A dialog taller than the window scrolls inside, and its buttons stay at the bottom
// (DialogButtons is sticky), so no action is ever out of reach.
const POPUP =
  "fixed top-1/2 left-1/2 z-50 max-h-dialog-height w-dialog -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-card border border-outline-strong bg-surface-raised p-5 text-on-surface shadow-2xl outline-none";
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

// The buttons at the bottom right, the primary or danger fill button last (buttons.md §3). They
// stick to the bottom of a dialog that scrolls; the gaps above and below stay 20px. A sticky
// box stops inside the popup's 20 px padding, so `-bottom-5` puts that line at the popup's
// edge: with `bottom-0` the bar rose by 20 px and hid the last line of text (M2b).
export function DialogButtons({ children }: { children: ReactNode }) {
  return (
    <div className="sticky -bottom-5 -mx-5 mt-2 -mb-5 flex justify-end gap-2 bg-surface-raised px-5 pt-3 pb-5">
      {children}
    </div>
  );
}
