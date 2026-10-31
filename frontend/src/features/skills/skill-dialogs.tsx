import { useRef } from "react";
import { Button } from "../../components/ui/button.tsx";
import { Dialog, DialogButtons, DialogText } from "../../components/ui/dialog.tsx";

// The dialogs of a skill's ⋯ menu (skills-page.md §10.1, §11). M1 has no bots, so the bot lists
// are empty and not drawn: Deprecate has no box to tick, and Delete names no bot.

interface ActionDialogProps {
  open: boolean;
  skillName: string;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

// D1, UI-7.6. Cancel is the default: Enter never deprecates. No Undo toast, because Deprecate is
// not permanent.
export function DeprecateDialog(props: ActionDialogProps) {
  const cancel = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      kind="alert"
      open={props.open}
      onClose={props.onCancel}
      title={`Time for ${props.skillName} to rest? 🌙`}
      defaultButton={cancel}
    >
      <DialogText>No bot uses it.</DialogText>
      <ul className="mt-3 flex flex-col gap-1 text-on-surface-muted">
        <li>😴 New bots cannot add it. The list hides it, and Export leaves it out.</li>
        <li>↩️ Changed your mind? Make it active again at any time.</li>
      </ul>
      {props.error !== null && <p className="mt-3 text-sm text-danger">{props.error}</p>}
      <DialogButtons>
        <Button ref={cancel} onClick={props.onCancel}>
          Cancel
        </Button>
        <Button kind="danger" aria-disabled={props.pending} onClick={props.onConfirm}>
          Deprecate
        </Button>
      </DialogButtons>
    </Dialog>
  );
}

// D7b, D49: the skill goes to Trash for `trash_days`. Delete skill is the last step of a delete,
// so it is the only danger fill button (buttons.md §1).
export function DeleteDialog(props: ActionDialogProps & { trashDays: number }) {
  const cancel = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      kind="alert"
      open={props.open}
      onClose={props.onCancel}
      title={`Delete ${props.skillName}? 🧹`}
      defaultButton={cancel}
    >
      <DialogText>
        The skill goes to Trash. After {props.trashDays} {props.trashDays === 1 ? "day" : "days"},
        the app deletes it permanently.
      </DialogText>
      {props.error !== null && <p className="mt-3 text-sm text-danger">{props.error}</p>}
      <DialogButtons>
        <Button ref={cancel} onClick={props.onCancel}>
          Cancel
        </Button>
        <Button kind="danger-fill" aria-disabled={props.pending} onClick={props.onConfirm}>
          Delete skill
        </Button>
      </DialogButtons>
    </Dialog>
  );
}
