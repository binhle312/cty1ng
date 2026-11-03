import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/button.tsx";
import { Dialog, DialogButtons, DialogText } from "../../components/ui/dialog.tsx";
import { showToast } from "../../components/ui/toast.tsx";
import { apiErrorText, readApiError } from "../../lib/api/api-error.ts";
import {
  listBotsOptions,
  listSkillUpgradeCandidatesOptions,
  listSkillVersionsOptions,
  pinSkillToBotsMutation,
} from "../../lib/api/generated/@tanstack/react-query.gen.ts";
import type {
  CreateSkillResponse,
  CreateSkillVersionResponse,
  ListSkillUpgradeCandidatesResponse,
} from "../../lib/api/generated/types.gen.ts";
import { PIN_QUERIES } from "../../lib/api/operation-queries.ts";
import { BotPickList } from "../bots/bot-list.tsx";
import { type BotRow, useBots } from "../bots/bot-queries.ts";
import { VersionPill } from "./pills.tsx";
import { SaveButton } from "./save-bar.tsx";
import { toggled } from "../../lib/sets.ts";

// The bot cards after a save (skills-page.md §7): C4 offers the new version to the bots that use
// an older one, every box ticked; C4b offers a new skill to the bots, no box ticked. When no bot
// fits, the card does not open and only the toast shows. The card lives in the Skills layout,
// because a Create moves from `/skills/new` to the new skill's page while the card is open.
type Candidate = ListSkillUpgradeCandidatesResponse[number];

export type AfterSaveCard =
  | {
      kind: "upgrade";
      skillId: string;
      skillName: string;
      version: number;
      versionId: string;
      candidates: Candidate[];
    }
  | { kind: "assign"; skillId: string; skillName: string; versionId: string };

// The toasts that stand for a card: when no bot fits, or when the card's page is gone.
const savedToast = (version: number) => `Saved v${String(version)} ✨`;
const createdToast = (skillName: string) => `Created ${skillName} ✨`;

// The skill's version with that number, read fresh: the card sends its id.
async function versionIdOf(
  queryClient: QueryClient,
  { skillId, version }: { skillId: string; version: number },
): Promise<string | undefined> {
  const versions = await queryClient.query({
    ...listSkillVersionsOptions({ path: { id: skillId } }),
    staleTime: 0,
  });
  return versions.find((v) => v.version === version)?.id;
}

// After "Save as vN": the upgrade card, or the toast when no bot uses an older version. A failed
// read also ends in the toast: nothing is lost, the Bots tab still offers "Upgrade to vN".
export async function upgradeCardAfterSave(
  queryClient: QueryClient,
  skill: Pick<CreateSkillVersionResponse, "id" | "name" | "latest_version">,
): Promise<AfterSaveCard | null> {
  const version = skill.latest_version.version;
  const toast = () => {
    showToast(savedToast(version));
    return null;
  };
  try {
    const candidates = await queryClient.query({
      ...listSkillUpgradeCandidatesOptions({ path: { id: skill.id } }),
      staleTime: 0,
    });
    const older = candidates.filter((c) => c.version < version);
    if (older.length === 0) return toast();
    const versionId = await versionIdOf(queryClient, { skillId: skill.id, version });
    if (versionId === undefined) return toast();
    return {
      kind: "upgrade",
      skillId: skill.id,
      skillName: skill.name,
      version,
      versionId,
      candidates: older,
    };
  } catch {
    return toast();
  }
}

// After Create: the assign card, or the toast when no bot exists.
export async function assignCardAfterCreate(
  queryClient: QueryClient,
  skill: Pick<CreateSkillResponse, "id" | "name">,
): Promise<AfterSaveCard | null> {
  const toast = () => {
    showToast(createdToast(skill.name));
    return null;
  };
  try {
    const bots = await queryClient.query({ ...listBotsOptions(), staleTime: 0 });
    if (bots.length === 0) return toast();
    const versionId = await versionIdOf(queryClient, { skillId: skill.id, version: 1 });
    if (versionId === undefined) return toast();
    return { kind: "assign", skillId: skill.id, skillName: skill.name, versionId };
  } catch {
    return toast();
  }
}

// The toast that stands for a card when its page is gone (the owner left the Skills page while
// the save was on its way): the save is not lost, and the Bots tab still offers the change.
export function cardToast(card: AfterSaveCard): string {
  return card.kind === "upgrade" ? savedToast(card.version) : createdToast(card.skillName);
}

export function AfterSaveCardHost({
  card,
  onClose,
}: {
  card: AfterSaveCard | null;
  // Gets the card that asks to close: the host closes it only while it is still the one shown.
  onClose: (card: AfterSaveCard) => void;
}) {
  // A new card each time, so its ticks start as the card says.
  if (card === null) return null;
  const close = () => {
    onClose(card);
  };
  return card.kind === "upgrade" ? (
    <UpgradeCard key={card.versionId} card={card} onClose={close} />
  ) : (
    <AssignCard key={card.versionId} card={card} onClose={close} />
  );
}

// A request can end after its card closed (Skip, Esc or a newer card while it was on its way):
// a success then closes nothing, because the host closes only the card that asks, and a failure
// shows as a toast, because the card that would show it is gone.
function useSendPins(onDone: () => void) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const shown = useRef(true);
  useEffect(() => {
    shown.current = true;
    return () => {
      shown.current = false;
    };
  }, []);
  const { mutateAsync, isPending } = useMutation(pinSkillToBotsMutation());
  const send = (...input: Parameters<typeof mutateAsync>) => {
    setError(null);
    mutateAsync(...input)
      .then(() => {
        onDone();
      })
      .catch((cause: unknown) => {
        const text =
          readApiError(cause)?.code === "stale_write"
            ? "A bot changed in another place. Check the list and try again."
            : apiErrorText(cause);
        if (shown.current) setError(text);
        else showToast(text);
      })
      .finally(() => void queryClient.invalidateQueries({ predicate: PIN_QUERIES }));
  };
  return { send, pending: isPending, error };
}

// C4 (UI-7.4): every box starts ticked, so one click upgrades every bot (owner, 2026-10-23).
function UpgradeCard({
  card,
  onClose,
}: {
  card: Extract<AfterSaveCard, { kind: "upgrade" }>;
  onClose: () => void;
}) {
  const upgrade = useRef<HTMLButtonElement>(null);
  const bots = useBots();
  // The list follows the server while the card is open: after a conflict (409 `stale_write`) the
  // pin queries refresh, so a retry sends the version each bot uses now, and a bot that is on v{n}
  // already drops out. The card's own list stands in until the first answer.
  const live = useQuery(listSkillUpgradeCandidatesOptions({ path: { id: card.skillId } }));
  const candidates = (live.data ?? card.candidates).filter((c) => c.version < card.version);
  // The bots the owner unticked: every other row is ticked, also one that comes in a refresh.
  const [unticked, setUnticked] = useState<ReadonlySet<string>>(new Set());
  const { send, pending, error } = useSendPins(onClose);
  // A bot that left (Trash) while the card is open drops out of the list.
  const rows = candidates.flatMap((candidate) => {
    const bot = bots.data?.find((b) => b.id === candidate.bot_id);
    return bot === undefined ? [] : [{ bot, candidate }];
  });
  const ticked = new Set(rows.filter(({ bot }) => !unticked.has(bot.id)).map(({ bot }) => bot.id));
  const chosen = rows.filter(({ bot }) => ticked.has(bot.id));
  const v = String(card.version);
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Saved v${v} ✨ Also upgrade these bots to v${v}?`}
      defaultButton={upgrade}
    >
      <DialogText>
        These bots use an older version. They keep it until you upgrade them. Tick the bots to move
        to v{v}.
      </DialogText>
      <BotPickList
        label="Bots that use an older version"
        rows={rows.map(({ bot, candidate }) => ({
          bot,
          detail: <VersionPill version={candidate.version} />,
        }))}
        ticked={ticked}
        onToggle={(botId) => {
          setUnticked((current) => toggled(current, botId));
        }}
      />
      {error !== null && <p className="mt-3 text-sm text-danger">{error}</p>}
      <p className="mt-3 text-sm text-on-surface-muted">
        A click outside this card is the same as Skip.
      </p>
      <DialogButtons>
        <Button onClick={onClose}>Skip</Button>
        <SaveButton
          ref={upgrade}
          label="Upgrade"
          busy={pending}
          disabledReason={
            pending ? "Upgrading the bots." : chosen.length === 0 ? "Tick a bot first." : null
          }
          onClick={() => {
            send({
              path: { id: card.skillId },
              body: {
                skill_version_id: card.versionId,
                // No `always_load`: the server keeps each bot's own value (§7.3), so a change
                // made in another place while the card is open is not overwritten.
                bots: chosen.map(({ candidate }) => ({
                  bot_id: candidate.bot_id,
                  expected_skill_version_id: candidate.skill_version_id,
                })),
              },
            });
          }}
        />
      </DialogButtons>
    </Dialog>
  );
}

// C4b: no box starts ticked, and Skip is the default.
function AssignCard({
  card,
  onClose,
}: {
  card: Extract<AfterSaveCard, { kind: "assign" }>;
  onClose: () => void;
}) {
  const skip = useRef<HTMLButtonElement>(null);
  const bots = useBots();
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set());
  const { send, pending, error } = useSendPins(onClose);
  // A bot that got the skill in another place leaves the list, so a retry after a conflict
  // (409 `stale_write`) sends only the bots that still have no pin.
  const all: BotRow[] = (bots.data ?? []).filter(
    (bot) => !bot.pins.some((pin) => pin.skill_id === card.skillId),
  );
  const chosen = all.filter((bot) => ticked.has(bot.id));
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Created ✨ Add ${card.skillName} to bots?`}
      defaultButton={skip}
    >
      <DialogText>Tick the bots that must use this skill. They get v1.</DialogText>
      <BotPickList
        label="Bots"
        rows={all.map((bot) => ({ bot }))}
        ticked={ticked}
        onToggle={(botId) => {
          setTicked((current) => toggled(current, botId));
        }}
      />
      {error !== null && <p className="mt-3 text-sm text-danger">{error}</p>}
      <p className="mt-3 text-sm text-on-surface-muted">
        A click outside this card is the same as Skip.
      </p>
      <DialogButtons>
        <Button ref={skip} onClick={onClose}>
          Skip
        </Button>
        <SaveButton
          label="Assign"
          busy={pending}
          disabledReason={
            pending ? "Assigning the skill." : chosen.length === 0 ? "Tick a bot first." : null
          }
          onClick={() => {
            send({
              path: { id: card.skillId },
              body: {
                skill_version_id: card.versionId,
                bots: chosen.map((bot) => ({ bot_id: bot.id, expected_skill_version_id: null })),
              },
            });
          }}
        />
      </DialogButtons>
    </Dialog>
  );
}
