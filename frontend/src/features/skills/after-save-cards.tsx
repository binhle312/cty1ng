import { type QueryClient, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
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
import type { ListSkillUpgradeCandidatesResponse } from "../../lib/api/generated/types.gen.ts";
import { PIN_QUERIES } from "../../lib/api/operation-queries.ts";
import { BotPickList } from "../bots/bot-list.tsx";
import { type BotRow, useBots } from "../bots/bot-queries.ts";
import { VersionPill } from "./pills.tsx";
import { SaveButton } from "./save-bar.tsx";

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

// The skill's version with that number, read fresh: the card sends its id.
async function versionIdOf(
  queryClient: QueryClient,
  skillId: string,
  version: number,
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
  skill: { id: string; name: string },
  version: number,
): Promise<AfterSaveCard | null> {
  const toast = () => {
    showToast(`Saved v${String(version)} ✨`);
    return null;
  };
  try {
    const candidates = await queryClient.query({
      ...listSkillUpgradeCandidatesOptions({ path: { id: skill.id } }),
      staleTime: 0,
    });
    const older = candidates.filter((c) => c.version < version);
    if (older.length === 0) return toast();
    const versionId = await versionIdOf(queryClient, skill.id, version);
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
  skill: { id: string; name: string },
): Promise<AfterSaveCard | null> {
  const toast = () => {
    showToast(`Created ${skill.name} ✨`);
    return null;
  };
  try {
    const bots = await queryClient.query({ ...listBotsOptions(), staleTime: 0 });
    if (bots.length === 0) return toast();
    const versionId = await versionIdOf(queryClient, skill.id, 1);
    if (versionId === undefined) return toast();
    return { kind: "assign", skillId: skill.id, skillName: skill.name, versionId };
  } catch {
    return toast();
  }
}

export function AfterSaveCardHost({
  card,
  onClose,
}: {
  card: AfterSaveCard | null;
  onClose: () => void;
}) {
  // A new card each time, so its ticks start as the card says.
  if (card === null) return null;
  return card.kind === "upgrade" ? (
    <UpgradeCard key={card.versionId} card={card} onClose={onClose} />
  ) : (
    <AssignCard key={card.versionId} card={card} onClose={onClose} />
  );
}

function useSendPins(onDone: () => void) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const { mutateAsync, isPending } = useMutation(pinSkillToBotsMutation());
  const send = (...input: Parameters<typeof mutateAsync>) => {
    setError(null);
    mutateAsync(...input)
      .then(() => {
        onDone();
      })
      .catch((cause: unknown) => {
        setError(
          readApiError(cause)?.code === "stale_write"
            ? "A bot changed in another place. Check the list and try again."
            : apiErrorText(cause),
        );
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
  const [ticked, setTicked] = useState<ReadonlySet<string>>(
    () => new Set(card.candidates.map((c) => c.bot_id)),
  );
  const { send, pending, error } = useSendPins(onClose);
  // A bot that left (Trash) while the card is open drops out of the list.
  const rows = card.candidates.flatMap((candidate) => {
    const bot = bots.data?.find((b) => b.id === candidate.bot_id);
    return bot === undefined ? [] : [{ bot, candidate }];
  });
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
          setTicked((current) => toggled(current, botId));
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
                bots: chosen.map(({ candidate }) => ({
                  bot_id: candidate.bot_id,
                  expected_skill_version_id: candidate.skill_version_id,
                  always_load: candidate.always_load,
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
  const all: BotRow[] = bots.data ?? [];
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

function toggled(current: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const next = new Set(current);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}
