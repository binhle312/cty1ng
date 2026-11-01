import { useQuery } from "@tanstack/react-query";
import { useRef, useState, type RefObject } from "react";
import { Button } from "../../components/ui/button.tsx";
import { Dialog, DialogButtons, DialogText } from "../../components/ui/dialog.tsx";
import { Skeleton, SkeletonArea } from "../../components/ui/skeleton.tsx";
import { Tab, TabsList, TabsPanel, TabsRoot } from "../../components/ui/tabs.tsx";
import { TimeText } from "../../components/ui/time-text.tsx";
import { getSkillDiffOptions } from "../../lib/api/generated/@tanstack/react-query.gen.ts";
import type { ListSkillVersionsResponse } from "../../lib/api/generated/types.gen.ts";
import { cn } from "../../lib/cn.ts";
import { formatTime } from "../../lib/time-format.ts";
import { BotPickList } from "../bots/bot-list.tsx";
import { LoadError } from "./load-error.tsx";
import { SaveButton } from "./save-bar.tsx";
import type { BotRow } from "../bots/bot-queries.ts";
import { DiffView } from "./diff-view.tsx";
import { VersionPill } from "./pills.tsx";

// The cards that change which version of a skill a bot uses, shared by the Bots tab of a skill
// and (M2b) the Skills tab of a bot: + Add (skills-page.md §2a), Upgrade or Move to a version
// (bot-page.md §7 SK3) and Change version (SK4).
export type VersionRow = ListSkillVersionsResponse[number];

// The versions are loaded by the tab that opens a card. When that load failed, the card says so
// and offers Try again, so it never waits for a list that is not coming.
export interface VersionsLoad {
  failed: boolean;
  retry: () => void;
}

function VersionsFailed({ load }: { load: VersionsLoad }) {
  return load.failed ? (
    <LoadError
      text="The app could not load the versions."
      onRetry={load.retry}
      className="mt-3 px-0 py-0"
    />
  ) : null;
}

// Why a confirm button that needs the versions is off (ui-rules B5).
const versionsReason = (load: VersionsLoad) =>
  load.failed ? "The versions did not load. Try again first." : "Loading the versions.";

const noteOf = (version: VersionRow) =>
  version.changelog ?? (version.version === 1 ? "First version" : "No note");

// SK2 and §2a: the bots that do not use the skill, no box ticked. The added bots get the latest
// version and Always load off. Add is off with no tick (40%).
export function AddBotsDialog({
  open,
  skillName,
  latest,
  versionsLoad,
  bots,
  pending,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  skillName: string;
  // Null until the versions load.
  latest: VersionRow | undefined;
  versionsLoad: VersionsLoad;
  bots: BotRow[];
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (botIds: string[]) => void;
}) {
  const skip = useRef<HTMLButtonElement>(null);
  return (
    <Dialog open={open} onClose={onClose} title={`Add ${skillName} to bots`} defaultButton={skip}>
      <AddBody
        latest={latest}
        versionsLoad={versionsLoad}
        bots={bots}
        pending={pending}
        error={error}
        onClose={onClose}
        onConfirm={onConfirm}
        skip={skip}
      />
    </Dialog>
  );
}

function AddBody({
  latest,
  versionsLoad,
  bots,
  pending,
  error,
  onClose,
  onConfirm,
  skip,
}: {
  latest: VersionRow | undefined;
  versionsLoad: VersionsLoad;
  bots: BotRow[];
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (botIds: string[]) => void;
  skip: RefObject<HTMLButtonElement | null>;
}) {
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set());
  // A ticked bot can leave the list while the card is open (another tab gave it the skill, or it
  // went to Trash). Only the ticked bots still in the list count and are sent.
  const chosen = bots.filter((bot) => ticked.has(bot.id)).map((bot) => bot.id);
  const n = chosen.length;
  const off = pending
    ? "Adding the bots."
    : latest === undefined
      ? versionsReason(versionsLoad)
      : n === 0
        ? "Tick a bot first."
        : null;
  return (
    <>
      <DialogText>
        Tick the bots that must use this skill. They get{" "}
        {latest === undefined ? "the latest version" : `v${String(latest.version)}`}, with Always
        load off.
      </DialogText>
      <BotPickList
        label="Bots that do not use this skill"
        rows={bots.map((bot) => ({ bot }))}
        ticked={ticked}
        onToggle={(botId) => {
          setTicked((current) => {
            const next = new Set(current);
            if (next.has(botId)) next.delete(botId);
            else next.add(botId);
            return next;
          });
        }}
      />
      <VersionsFailed load={versionsLoad} />
      {error !== null && <p className="mt-3 text-sm text-danger">{error}</p>}
      <p className="mt-3 text-sm text-on-surface-muted">
        A click outside this card is the same as Skip.
      </p>
      <DialogButtons>
        <Button ref={skip} onClick={onClose}>
          Skip
        </Button>
        <SaveButton
          label={n === 0 ? "Add" : `Add ${String(n)}`}
          disabledReason={off}
          onClick={() => {
            onConfirm(chosen);
          }}
        />
      </DialogButtons>
    </>
  );
}

// SK3: see what changed before a bot moves to another version. On top, the changelog line of each
// version after the one the bot uses (an upgrade), then the diff from the used version to the
// new one, with the colours of the skill History. Words say "uses v3", never "pins".
export function MoveVersionDialog({
  open,
  skillId,
  skillName,
  botName,
  used,
  target,
  versions,
  versionsLoad,
  pending,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  skillId: string;
  skillName: string;
  botName: string;
  used: number;
  target: number;
  // Undefined until the versions load.
  versions: VersionRow[] | undefined;
  versionsLoad: VersionsLoad;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (version: VersionRow) => void;
}) {
  const confirm = useRef<HTMLButtonElement>(null);
  const upgrade = target > used;
  const to = versions?.find((version) => version.version === target);
  const newer = (versions ?? []).filter((v) => v.version > used && v.version <= target);
  const off = pending
    ? "Saving the change."
    : versions === undefined
      ? versionsReason(versionsLoad)
      : to === undefined
        ? `v${String(target)} no longer exists. Cancel and pick another version.`
        : null;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        upgrade
          ? `Upgrade ${skillName} to v${String(target)}?`
          : `Move ${skillName} to v${String(target)}?`
      }
      defaultButton={confirm}
      className="w-dialog-wide"
    >
      <DialogText>
        {botName} uses v{used}. {botName} gets v{target} from its next run; a run that works now
        keeps v{used}.
      </DialogText>
      {upgrade && newer.length > 0 && (
        <ol aria-label="Changes in the newer versions" className="mt-3 flex flex-col gap-1">
          {newer.map((version) => (
            <li key={version.id} className="flex items-center gap-2 text-sm">
              <VersionPill version={version.version} />
              <span className="min-w-0 grow">{noteOf(version)}</span>
              <TimeText iso={version.created_at} className="text-on-surface-muted" />
            </li>
          ))}
        </ol>
      )}
      <div className="mt-3">
        <Changes skillId={skillId} from={used} to={target} />
      </div>
      {versions === undefined &&
        (versionsLoad.failed ? (
          <VersionsFailed load={versionsLoad} />
        ) : (
          <DialogText>Loading the versions.</DialogText>
        ))}
      {error !== null && <p className="mt-3 text-sm text-danger">{error}</p>}
      <DialogButtons>
        <Button onClick={onClose}>Cancel</Button>
        <SaveButton
          ref={confirm}
          label={upgrade ? `Upgrade to v${String(target)}` : `Use v${String(target)}`}
          disabledReason={off}
          onClick={() => {
            if (to !== undefined) onConfirm(to);
          }}
        />
      </DialogButtons>
    </Dialog>
  );
}

// The Body and Description tabs of the diff, and a line when the other tab has changes too.
function Changes({ skillId, from, to }: { skillId: string; from: number; to: number }) {
  const diff = useQuery(getSkillDiffOptions({ path: { id: skillId }, query: { from, to } }));
  const [tab, setTab] = useState<"body" | "description">("body");
  if (diff.isPending) {
    return (
      <SkeletonArea label="Loading the changes">
        <Skeleton className="h-32" />
      </SkeletonArea>
    );
  }
  if (diff.isError) {
    return <p className="text-on-surface-muted">The app could not load the changes.</p>;
  }
  const bodyChanged = diff.data.body.some((line) => line.op !== "same");
  const descriptionChanged = diff.data.description !== null;
  return (
    <TabsRoot
      value={tab}
      onValueChange={(value) => {
        setTab(value === "description" ? "description" : "body");
      }}
    >
      <TabsList className="border-b border-outline">
        <Tab value="body">Body</Tab>
        <Tab value="description">Description</Tab>
      </TabsList>
      {/* A long diff scrolls here, so the card's buttons stay in view. */}
      <TabsPanel value="body" className="mt-3 max-h-80 overflow-y-auto">
        <DiffView lines={diff.data.body} label="Body changes" />
        {descriptionChanged && (
          <p className="mt-2 text-sm text-on-surface-muted">
            The description changed too. Open the Description tab to see it.
          </p>
        )}
      </TabsPanel>
      <TabsPanel value="description" className="mt-3 max-h-80 overflow-y-auto">
        {diff.data.description === null ? (
          <p className="text-on-surface-muted">The description has no change.</p>
        ) : (
          <DiffView lines={diff.data.description} label="Description changes" />
        )}
        {bodyChanged && (
          <p className="mt-2 text-sm text-on-surface-muted">
            The body changed too. Open the Body tab to see it.
          </p>
        )}
      </TabsPanel>
    </TabsRoot>
  );
}

// SK4: every version, newest first, with its changelog line and local time. The mark and "{bot}
// uses this" show the current one; "latest" is in `success`. A pick opens SK3 for that version.
// A deprecated skill can change to any version that exists.
export function ChangeVersionDialog({
  open,
  botName,
  used,
  versions,
  versionsLoad,
  onClose,
  onPick,
}: {
  open: boolean;
  botName: string;
  used: number;
  versions: VersionRow[] | undefined;
  versionsLoad: VersionsLoad;
  onClose: () => void;
  onPick: (version: VersionRow) => void;
}) {
  const cancel = useRef<HTMLButtonElement>(null);
  return (
    <Dialog open={open} onClose={onClose} title="Change version" defaultButton={cancel}>
      <DialogText>Pick the version that {botName} uses.</DialogText>
      {versions === undefined ? (
        versionsLoad.failed ? (
          <VersionsFailed load={versionsLoad} />
        ) : (
          <DialogText>Loading the versions.</DialogText>
        )
      ) : (
        <ol aria-label="Versions" className="mt-3 flex max-h-72 flex-col gap-1 overflow-y-auto">
          {versions.map((version, index) => {
            const current = version.version === used;
            return (
              <li key={version.id}>
                <button
                  type="button"
                  aria-current={current ? "true" : undefined}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-control border border-transparent px-3 py-2 text-left outline-none hover:bg-surface-bubble focus-visible:outline-2 focus-visible:outline-primary",
                    current && "border-primary bg-primary-tint",
                  )}
                  onClick={() => {
                    if (!current) onPick(version);
                  }}
                >
                  <span aria-hidden className="w-3 shrink-0 text-primary">
                    {current ? "✓" : ""}
                  </span>
                  <VersionPill version={version.version} />
                  <span className="min-w-0 grow">
                    {noteOf(version)}
                    <span className="block text-sm text-on-surface-muted">
                      {current && `${botName} uses this · `}
                      {formatTime(version.created_at, new Date())}
                    </span>
                  </span>
                  {index === 0 && <span className="text-sm text-success">latest</span>}
                </button>
              </li>
            );
          })}
        </ol>
      )}
      <DialogButtons>
        <Button ref={cancel} onClick={onClose}>
          Cancel
        </Button>
      </DialogButtons>
    </Dialog>
  );
}
