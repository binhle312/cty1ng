import { Button } from "../../components/ui/button.tsx";
import { SaveBarFrame, SaveButton } from "../skills/save-bar.tsx";

// The save bar of the Profile and Model tabs (bot-page.md §4.1, PF2, PF3). It is always there, so
// it never jumps. M2 has no runs, so the "is running" line comes with M3.
export type BotSaveBarState =
  | { kind: "clean" }
  | { kind: "changes"; count: number; avatar: boolean }
  | { kind: "errors"; count: number }
  | { kind: "conflict" };

export function BotSaveBar({
  botName,
  state,
  saving,
  onDiscard,
  onSave,
}: {
  botName: string;
  state: BotSaveBarState;
  saving: boolean;
  onDiscard: () => void;
  onSave: () => void;
}) {
  const discard = (
    <Button
      aria-disabled={state.kind === "clean"}
      onClick={state.kind === "clean" ? undefined : onDiscard}
    >
      Discard
    </Button>
  );
  switch (state.kind) {
    case "clean":
      return (
        <SaveBarFrame>
          <span className="grow text-on-surface-muted">
            No changes. Edits apply from the next run.
          </span>
          {discard}
          <SaveButton label="Save" disabledReason="No changes to save." onClick={onSave} />
        </SaveBarFrame>
      );
    case "changes":
      return (
        <SaveBarFrame>
          <span className="flex grow flex-col">
            <span className="flex items-center gap-2">
              <span aria-hidden className="size-2 rounded-pill bg-waiting" />
              {state.count === 1
                ? "1 change not saved"
                : `${String(state.count)} changes not saved`}
            </span>
            {state.avatar && (
              <span className="text-sm text-on-surface-muted">
                The header and conversations still show the old avatar until you save.
              </span>
            )}
          </span>
          {discard}
          <SaveButton
            label="Save"
            busy={saving}
            disabledReason={saving ? "Saving." : null}
            onClick={onSave}
          />
        </SaveBarFrame>
      );
    case "errors":
      return (
        <SaveBarFrame>
          <span className="grow text-danger">
            {state.count === 1
              ? "Fix 1 field to save."
              : `Fix ${String(state.count)} fields to save.`}
          </span>
          {discard}
          <SaveButton label="Save" disabledReason="Fix the errors first." onClick={onSave} />
        </SaveBarFrame>
      );
    case "conflict":
      return (
        <SaveBarFrame>
          <span className="grow text-sm">
            {botName} changed in another place. Your changes are kept here. Copy what you need, then
            Discard to load the new values.
          </span>
          {discard}
          <SaveButton
            label="Save"
            disabledReason={`${botName} changed in another place. Discard first.`}
            onClick={onSave}
          />
        </SaveBarFrame>
      );
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}
