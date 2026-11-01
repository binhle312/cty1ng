import type { ReactNode, Ref } from "react";
import { Button } from "../../components/ui/button.tsx";
import { Tooltip } from "../../components/ui/tooltip.tsx";

// The save bar at the bottom of the Skill tab (skills-page.md §5, §4, §8, §10.2). Buttons sit at
// the right, the primary one last (buttons.md §3).
export function SaveBarFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex shrink-0 items-center gap-3 border-t border-outline bg-surface px-8 py-3">
      {children}
    </div>
  );
}

// A button that is off says why in a tooltip (ui-rules B5). It stays focusable, so the
// tooltip also shows on keyboard focus. The pin cards use it too (skill-pin-dialogs.tsx).
export function SaveButton({
  label,
  disabledReason,
  onClick,
  kind = "primary",
  ref,
}: {
  label: string;
  disabledReason: string | null;
  onClick: () => void;
  kind?: "primary" | "secondary" | "danger" | "danger-fill";
  ref?: Ref<HTMLButtonElement>;
}) {
  // Always inside the tooltip, off when there is no reason: a wrapper that came and went would
  // make React mount a new button, and a focused button (a dialog's default) would lose focus.
  return (
    <Tooltip label={disabledReason ?? ""} side="top" disabled={disabledReason === null}>
      <Button
        ref={ref}
        kind={kind}
        aria-disabled={disabledReason !== null}
        onClick={() => {
          if (disabledReason === null) onClick();
        }}
      >
        {label}
      </Button>
    </Tooltip>
  );
}

interface EditSaveBarProps {
  changes: number;
  renameOnly: boolean;
  nextVersion: number;
  changelog: string;
  onChangelog: (text: string) => void;
  onDiscard: () => void;
  onSave: () => void;
  // Why Save is off (an error in a field, a save in progress), or null.
  blockedReason: string | null;
  error: string | null;
}

// An existing skill: "All changes are saved." or "{n} changes not saved", the changelog line,
// Discard and Save as v{n+1}. A rename only saves with **Save** and no changelog (§5).
export function EditSaveBar(props: EditSaveBarProps) {
  const label = props.renameOnly ? "Save" : `Save as v${String(props.nextVersion)}`;
  if (props.changes === 0) {
    return (
      <SaveBarFrame>
        <span className="grow text-on-surface-muted">All changes are saved.</span>
        <SaveButton label={label} disabledReason="No changes to save." onClick={props.onSave} />
      </SaveBarFrame>
    );
  }
  const reason = props.blockedReason;
  return (
    <SaveBarFrame>
      <span className="flex shrink-0 items-center gap-2">
        <span aria-hidden className="size-2 rounded-pill bg-primary" />
        {props.changes === 1 ? "1 change not saved" : `${String(props.changes)} changes not saved`}
      </span>
      {props.error !== null && <span className="text-sm text-danger">{props.error}</span>}
      {props.renameOnly ? (
        <span className="grow" />
      ) : (
        <input
          value={props.changelog}
          onChange={(event) => {
            props.onChangelog(event.target.value);
          }}
          onKeyDown={(event) => {
            // Enter is the same as the Save button, when it is on (§5).
            if (event.key === "Enter") {
              event.preventDefault();
              if (reason === null) props.onSave();
            }
          }}
          placeholder="What changed? One line, optional"
          aria-label="What changed"
          className="h-9 min-w-0 grow rounded-control border border-outline-strong bg-surface px-2.5 outline-none placeholder:text-on-surface-muted focus:border-primary"
        />
      )}
      <Button onClick={props.onDiscard}>Discard</Button>
      <SaveButton label={label} disabledReason={reason} onClick={props.onSave} />
    </SaveBarFrame>
  );
}

// A skill that the owner cannot edit: a deprecated one, or one by another author (§8, §10.2).
export function ReadOnlySaveBar({ text, onClone }: { text: string; onClone?: () => void }) {
  return (
    <SaveBarFrame>
      <span className="grow text-on-surface-muted">{text}</span>
      {onClone !== undefined && (
        <Button kind="primary" onClick={onClone}>
          Clone to edit
        </Button>
      )}
    </SaveBarFrame>
  );
}
