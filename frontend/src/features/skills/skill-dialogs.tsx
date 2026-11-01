import { useRef, useState, type RefObject } from "react";
import { Button } from "../../components/ui/button.tsx";
import { Dialog, DialogButtons, DialogText } from "../../components/ui/dialog.tsx";
import { BotNameList, BotPickList, type BotListRow } from "../bots/bot-list.tsx";
import { VersionPill } from "./pills.tsx";
import { SaveButton } from "./save-bar.tsx";
import type { BotUse, BotUses } from "./skill-bot-uses.ts";

// The dialogs of a skill's ⋯ menu and of its deprecated banner (skills-page.md §10.1, §10.3,
// §11). They list the bots that use the skill, read from the bot list.

interface ActionDialogProps {
  open: boolean;
  skillName: string;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  bots: BotUses;
}

const botCount = (n: number) => (n === 1 ? "1 bot" : `${String(n)} bots`);

const versionRows = (uses: BotUse[]): BotListRow[] =>
  uses.map(({ bot, pin }) => ({ bot, detail: <VersionPill version={pin.version} /> }));

// The ticks of a list where every box starts ticked (owner, 2026-10-23). It keeps the boxes the
// owner cleared, so bots that arrive later start ticked too.
function useTicks(uses: BotUse[]) {
  const [cleared, setCleared] = useState<ReadonlySet<string>>(new Set());
  const ticked = new Set(uses.filter(({ bot }) => !cleared.has(bot.id)).map(({ bot }) => bot.id));
  const toggle = (botId: string) => {
    setCleared((current) => {
      const next = new Set(current);
      if (next.has(botId)) next.delete(botId);
      else next.add(botId);
      return next;
    });
  };
  return { ticked, toggle };
}

// A line for a bot list that has not loaded, or null once it has.
function BotsNotReady({ bots }: { bots: BotUses }) {
  if (bots.kind === "ready") return null;
  return bots.kind === "loading" ? (
    <DialogText>Loading the bots.</DialogText>
  ) : (
    <p role="alert" className="mt-2 text-danger">
      The app could not load the bots. Close this card and try again.
    </p>
  );
}

// Why a confirm button is off while the bots that use the skill are not known (ui-rules B5).
function botsReason(bots: BotUses): string | null {
  if (bots.kind === "loading") return "Loading the bots that use it.";
  if (bots.kind === "error") return "The bots did not load. Close this card and try again.";
  return null;
}

// D1, UI-7.6. Cancel is the default: Enter never deprecates. No Undo toast, because Deprecate is
// not permanent. Every box starts ticked; the ticked bots stop using the skill.
export function DeprecateDialog(
  props: ActionDialogProps & { onConfirm: (removeBotIds: string[]) => void },
) {
  const cancel = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      kind="alert"
      open={props.open}
      onClose={props.onCancel}
      title={`Time for ${props.skillName} to rest? 🌙`}
      defaultButton={cancel}
    >
      <DeprecateBody {...props} cancel={cancel} />
    </Dialog>
  );
}

function DeprecateBody({
  bots,
  pending,
  error,
  onCancel,
  onConfirm,
  cancel,
}: ActionDialogProps & {
  onConfirm: (removeBotIds: string[]) => void;
  cancel: RefObject<HTMLButtonElement | null>;
}) {
  const uses = bots.kind === "ready" ? bots.uses : [];
  const { ticked, toggle } = useTicks(uses);
  const n = ticked.size;
  const reason = pending ? "Deprecating the skill." : botsReason(bots);
  return (
    <>
      {bots.kind === "ready" && uses.length === 0 && <DialogText>No bot uses it.</DialogText>}
      {uses.length > 0 && (
        <>
          <DialogText>
            The ticked bots stop using it. Untick a bot to let it keep the skill, and it works for
            that bot as before 💪
          </DialogText>
          <BotPickList
            label="Bots that use this skill"
            rows={versionRows(uses)}
            ticked={ticked}
            onToggle={toggle}
          />
        </>
      )}
      <BotsNotReady bots={bots} />
      <ul className="mt-3 flex flex-col gap-1 text-on-surface-muted">
        <li>😴 New bots cannot add it. The list hides it, and Export leaves it out.</li>
        <li>↩️ Changed your mind? Make it active again at any time.</li>
      </ul>
      {error !== null && <p className="mt-3 text-sm text-danger">{error}</p>}
      <DialogButtons>
        <Button ref={cancel} onClick={onCancel}>
          Cancel
        </Button>
        <SaveButton
          kind="danger"
          label={n === 0 ? "Deprecate" : `Deprecate and remove from ${botCount(n)}`}
          disabledReason={reason}
          onClick={() => {
            onConfirm(uses.filter(({ bot }) => ticked.has(bot.id)).map(({ bot }) => bot.id));
          }}
        />
      </DialogButtons>
    </>
  );
}

// D2b: the owner removes a deprecated skill from the bots that still use it. Every box starts
// ticked. Skip is the default, so Enter never removes.
export function RemoveFromBotsDialog(
  props: ActionDialogProps & { onConfirm: (botIds: string[]) => void },
) {
  const skip = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      open={props.open}
      onClose={props.onCancel}
      title={`Remove ${props.skillName} from bots? 🧹`}
      defaultButton={skip}
    >
      <RemoveBody {...props} skip={skip} />
    </Dialog>
  );
}

function RemoveBody({
  bots,
  pending,
  error,
  onCancel,
  onConfirm,
  skip,
}: ActionDialogProps & {
  onConfirm: (botIds: string[]) => void;
  skip: RefObject<HTMLButtonElement | null>;
}) {
  const uses = bots.kind === "ready" ? bots.uses : [];
  const { ticked, toggle } = useTicks(uses);
  const n = ticked.size;
  const reason = pending
    ? "Removing the skill from the bots."
    : (botsReason(bots) ??
      (uses.length === 0 ? "No bot uses this skill." : n === 0 ? "Tick a bot first." : null));
  return (
    <>
      <DialogText>
        Tick the bots that must stop using it. They stop on their next run. A run that works now
        keeps it to the end.
      </DialogText>
      <BotsNotReady bots={bots} />
      {bots.kind === "ready" && uses.length === 0 && <DialogText>No bot uses it.</DialogText>}
      {uses.length > 0 && (
        <BotPickList
          label="Bots that use this skill"
          rows={versionRows(uses)}
          ticked={ticked}
          onToggle={toggle}
        />
      )}
      {error !== null && <p className="mt-3 text-sm text-danger">{error}</p>}
      <DialogButtons>
        <Button ref={skip} onClick={onCancel}>
          Skip
        </Button>
        <SaveButton
          kind="danger"
          label={n === 0 ? "Remove from bots" : `Remove from ${botCount(n)}`}
          disabledReason={reason}
          onClick={() => {
            onConfirm(uses.filter(({ bot }) => ticked.has(bot.id)).map(({ bot }) => bot.id));
          }}
        />
      </DialogButtons>
    </>
  );
}

// D7b, D49: the skill goes to Trash for `trash_days`. Delete skill is the last step of a delete,
// so it is the only danger fill button (buttons.md §1). The bots that use the skill are listed
// with no check boxes: removing the skill from every bot is a required step.
export function DeleteDialog(
  props: ActionDialogProps & { trashDays: number; onConfirm: () => void },
) {
  const cancel = useRef<HTMLButtonElement>(null);
  const { bots } = props;
  const uses = bots.kind === "ready" ? bots.uses : [];
  // The owner sees the bots before the skill leaves them.
  const reason = props.pending ? "Deleting the skill." : botsReason(bots);
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
        {uses.length > 0 && " These bots stop using it now:"}
      </DialogText>
      {uses.length > 0 && <BotNameList label="Bots that use this skill" rows={versionRows(uses)} />}
      <BotsNotReady bots={bots} />
      {props.error !== null && <p className="mt-3 text-sm text-danger">{props.error}</p>}
      <DialogButtons>
        <Button ref={cancel} onClick={props.onCancel}>
          Cancel
        </Button>
        <SaveButton
          kind="danger-fill"
          label="Delete skill"
          disabledReason={reason}
          onClick={props.onConfirm}
        />
      </DialogButtons>
    </Dialog>
  );
}
