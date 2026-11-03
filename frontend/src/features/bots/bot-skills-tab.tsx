import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ellipsis, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/button.tsx";
import {
  MenuItem,
  MenuPopup,
  MenuRoot,
  MenuSeparator,
  MenuTrigger,
} from "../../components/ui/menu.tsx";
import { Switch } from "../../components/ui/switch.tsx";
import { showToast } from "../../components/ui/toast.tsx";
import { Tooltip } from "../../components/ui/tooltip.tsx";
import { apiErrorText, readApiError } from "../../lib/api/api-error.ts";
import {
  listBotsQueryKey,
  listSkillsOptions,
  listSkillVersionsOptions,
  removeBotSkillMutation,
  setBotSkillMutation,
} from "../../lib/api/generated/@tanstack/react-query.gen.ts";
import { PIN_QUERIES } from "../../lib/api/operation-queries.ts";
import { Pill, VersionPill } from "../skills/pills.tsx";
import { ChangeVersionDialog, MoveVersionDialog } from "../skills/skill-pin-dialogs.tsx";
import { AddSkillsDialog } from "./add-skills-dialog.tsx";
import type { BotPin, BotRow } from "./bot-queries.ts";

// The Skills tab of a bot (bot-page.md §7, SK1–SK4, UI-6.3–6.6): the skills the bot has, the
// version it uses, the Always load switch and a ⋯ menu. Changes save at once and apply from the
// next run; there is no save bar. Every change sends the pin as this tab shows it, so the server
// refuses a change over one made in another place (409 `stale_write`).
type Dialog =
  | { kind: "add" }
  | { kind: "change"; skillId: string }
  | { kind: "move"; skillId: string; version: number };

const ALWAYS_LOAD_TIP =
  "On: the whole skill goes into every run. Off: the bot sees the name and description and loads it when it needs it.";

// Always load first, then by name (SK1).
function sortedPins(pins: readonly BotPin[]): BotPin[] {
  return [...pins].sort(
    (a, b) =>
      Number(b.always_load) - Number(a.always_load) || a.skill_name.localeCompare(b.skill_name),
  );
}

export function BotSkillsTab({ bot }: { bot: BotRow }) {
  const queryClient = useQueryClient();
  const [dialog, setDialogState] = useState<Dialog | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  // The dialog whose request is on its way. Each open makes a new object, so a request started
  // in a dialog the owner closed never closes or writes into a newer one.
  const shownDialog = useRef<Dialog | null>(null);
  // When the tab goes (another tab, another page), no dialog is open any more: an answer that
  // comes after shows as a toast, not in a dialog that nobody sees.
  useEffect(
    () => () => {
      shownDialog.current = null;
    },
    [],
  );
  const [busyDialog, setBusyDialog] = useState<Dialog | null>(null);
  // The Always load value of each toggle on its way, by skill id.
  const [pendingLoads, setPendingLoads] = useState<ReadonlyMap<string, boolean>>(new Map());

  const dialogSkillId = dialog !== null && dialog.kind !== "add" ? dialog.skillId : null;
  const versions = useQuery({
    ...listSkillVersionsOptions({ path: { id: dialogSkillId ?? "" } }),
    enabled: dialogSkillId !== null,
  });
  const versionsLoad = {
    failed: versions.isError && versions.data === undefined,
    retry: () => void versions.refetch(),
  };
  // The skills + Add offers: not deprecated (the default list), and not on the bot yet.
  const skills = useQuery({ ...listSkillsOptions(), enabled: dialog?.kind === "add" });

  const setDialog = (next: Dialog | null) => {
    shownDialog.current = next;
    setDialogState(next);
    setDialogError(null);
  };
  const closeDialog = () => {
    setDialog(null);
  };
  const refresh = () => queryClient.invalidateQueries({ predicate: PIN_QUERIES });
  // A pin answer changes only the pin of its own skill. A pin change never raises `row_version`,
  // so nothing in the answer tells if the rest of the bot is older than the cache: a Profile save
  // or a change of another skill may have come first. The refresh after it loads the rest.
  // The pin itself changes only while the page still shows the pin the request expected: the
  // server refused any change made before this one (409), so a different pin in the page is this
  // change or a newer one, and the answer would take it back.
  const replacePin = ({
    answer,
    skillId,
    expected,
  }: {
    answer: BotRow;
    skillId: string;
    expected: { skill_version_id: string; always_load: boolean };
  }) => {
    const pin = answer.pins.find((item) => item.skill_id === skillId);
    if (pin === undefined) return;
    const asExpected = (old: BotPin) =>
      old.skill_version_id === expected.skill_version_id &&
      old.always_load === expected.always_load;
    queryClient.setQueryData<BotRow[]>(listBotsQueryKey(), (current) =>
      current?.map((item) => {
        if (item.id !== answer.id) return item;
        const nextPins = item.pins.map((old) =>
          old.skill_id === skillId && asExpected(old) ? pin : old,
        );
        // The same count as the server's (bots.service.ts).
        const updates = nextPins.filter((p) => p.version < p.latest_version).length;
        return { ...item, pins: nextPins, counts: { ...item.counts, skill_updates: updates } };
      }),
    );
  };
  const staleText = (skillName: string, error: unknown) =>
    readApiError(error)?.code === "stale_write"
      ? `${skillName} changed in another place. Check it and try again.`
      : apiErrorText(error);

  // One hook serves every row, and a second `mutate` on a hook drops the callbacks of the first
  // (TanStack Query v5), so each request handles its own result through its promise.
  const setPin = useMutation(setBotSkillMutation());
  const removePin = useMutation(removeBotSkillMutation());

  const toggleLoad = (pin: BotPin, alwaysLoad: boolean) => {
    setPendingLoads((current) => new Map(current).set(pin.skill_id, alwaysLoad));
    const expected = { skill_version_id: pin.skill_version_id, always_load: pin.always_load };
    void setPin
      .mutateAsync({
        path: { id: bot.id, skill_id: pin.skill_id },
        body: { skill_version_id: pin.skill_version_id, always_load: alwaysLoad, expected },
      })
      .then(
        (answer) => {
          replacePin({ answer, skillId: pin.skill_id, expected });
          void refresh();
        },
        (error: unknown) => {
          void refresh();
          showToast(staleText(pin.skill_name, error));
        },
      )
      .finally(() => {
        setPendingLoads((current) => {
          const next = new Map(current);
          next.delete(pin.skill_id);
          return next;
        });
      });
  };

  // Remove asks nothing and has no Undo: it deletes nothing (SK1). A pin that is already gone
  // just takes the row away (204).
  const remove = (pin: BotPin) => {
    void removePin.mutateAsync({ path: { id: bot.id, skill_id: pin.skill_id } }).then(
      () => void refresh(),
      (error: unknown) => {
        void refresh();
        showToast(apiErrorText(error));
      },
    );
  };

  const runInDialog = ({
    shown,
    request,
    failed,
    closes = () => false,
  }: {
    shown: Dialog;
    request: Promise<unknown>;
    failed: (e: unknown) => string;
    // A failure that closes the dialog and shows as a toast (a stale pin, bot-page.md §7).
    closes?: (e: unknown) => boolean;
  }) => {
    setDialogError(null);
    setBusyDialog(shown);
    void request
      .then(
        () => {
          void refresh();
          if (shownDialog.current === shown) closeDialog();
        },
        (error: unknown) => {
          void refresh();
          const open = shownDialog.current === shown;
          if (open && !closes(error)) {
            setDialogError(failed(error));
            return;
          }
          if (open) closeDialog();
          showToast(failed(error));
        },
      )
      .finally(() => {
        setBusyDialog((current) => (current === shown ? null : current));
      });
  };

  // + Add: each ticked skill gets its latest version, read just before the request, with Always
  // load off. A skill that fails stays in the card, so the owner can try again. A skill that got
  // on the bot in another place (409 `stale_write`) shows its toast instead (bot-page.md §7).
  const addSkills = async (skillIds: string[]) => {
    const outcomes = await Promise.all(
      skillIds.map(async (skillId) => {
        try {
          const list = await queryClient.query(listSkillVersionsOptions({ path: { id: skillId } }));
          const latest = list[0];
          if (latest === undefined) throw new Error("no version");
          await setPin.mutateAsync({
            path: { id: bot.id, skill_id: skillId },
            body: { skill_version_id: latest.id, always_load: false, expected: null },
          });
          return "added";
        } catch (error) {
          if (readApiError(error)?.code !== "stale_write") return "failed";
          const name = skills.data?.find((skill) => skill.id === skillId)?.name ?? "A skill";
          showToast(staleText(name, error));
          return "stale";
        }
      }),
    );
    const failures = outcomes.filter((outcome) => outcome === "failed").length;
    if (failures > 0) {
      throw new Error(
        `The app could not add ${String(failures)} ${failures === 1 ? "skill" : "skills"}. Try again.`,
      );
    }
  };

  const pins = sortedPins(bot.pins);
  const dialogPin =
    dialogSkillId === null ? undefined : bot.pins.find((pin) => pin.skill_id === dialogSkillId);
  // The skill of the open dialog left the bot (removed in another place): the dialog closes, so
  // an answer that comes after shows as a toast, not in a dialog that nobody sees.
  if (dialogSkillId !== null && dialogPin === undefined) {
    setDialogState(null);
    setDialogError(null);
  }
  // The dialog request checks this ref; it follows the dialog on screen, also after the close above.
  useEffect(() => {
    shownDialog.current = dialog;
  }, [dialog]);
  const has = new Set(bot.pins.map((pin) => pin.skill_id));
  // Undefined until the list comes, so the card says it is loading.
  const addable = skills.data?.filter((skill) => !skill.deprecated && !has.has(skill.id));

  return (
    <div className="px-8 py-5">
      <div className="flex items-center justify-between gap-4">
        <p className="text-on-surface-muted">
          Changes save at once. {bot.name} uses them from its next run.
        </p>
        <Button
          size="small"
          onClick={() => {
            setDialog({ kind: "add" });
          }}
        >
          <Plus aria-hidden className="size-3.5" />
          Add
        </Button>
      </div>
      {pins.length === 0 ? (
        <p className="mt-8 text-center text-on-surface-muted">{bot.name} has no skills yet.</p>
      ) : (
        // Fixed columns: the skill column takes the free width, so its description shows (UI-6.3).
        <table className="mt-4 w-full table-fixed text-left">
          <thead>
            <tr className="border-b border-outline text-xs tracking-wide text-on-surface-muted uppercase">
              <th scope="col" className="py-2 font-medium">
                Skill
              </th>
              <th scope="col" className="w-56 py-2 font-medium">
                Version
              </th>
              <th scope="col" className="w-32 py-2 font-medium">
                <Tooltip label={ALWAYS_LOAD_TIP} side="top">
                  <span
                    tabIndex={0}
                    className="cursor-help rounded-xs focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    Always load
                  </span>
                </Tooltip>
              </th>
              <th scope="col" className="w-10 py-2">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {pins.map((pin) => (
              <SkillPinRow
                key={pin.skill_id}
                pin={pin}
                pendingLoad={pendingLoads.get(pin.skill_id) ?? null}
                onToggle={(alwaysLoad) => {
                  toggleLoad(pin, alwaysLoad);
                }}
                onUpgrade={() => {
                  setDialog({ kind: "move", skillId: pin.skill_id, version: pin.latest_version });
                }}
                onChangeVersion={() => {
                  setDialog({ kind: "change", skillId: pin.skill_id });
                }}
                onRemove={() => {
                  remove(pin);
                }}
              />
            ))}
          </tbody>
        </table>
      )}
      <AddSkillsDialog
        open={dialog?.kind === "add"}
        botName={bot.name}
        skills={addable}
        pending={dialog !== null && busyDialog === dialog}
        error={
          dialogError ??
          (skills.isError && skills.data === undefined
            ? "The app could not load the skills."
            : null)
        }
        onClose={closeDialog}
        onConfirm={(skillIds) => {
          if (dialog?.kind !== "add") return;
          runInDialog({
            shown: dialog,
            request: addSkills(skillIds),
            failed: (error) => (error instanceof Error ? error.message : apiErrorText(error)),
          });
        }}
      />
      <ChangeVersionDialog
        open={dialog?.kind === "change" && dialogPin !== undefined}
        botName={bot.name}
        used={dialogPin?.version ?? 0}
        versions={versions.data}
        versionsLoad={versionsLoad}
        onClose={closeDialog}
        onPick={(version) => {
          if (dialog?.kind === "change") {
            setDialog({ kind: "move", skillId: dialog.skillId, version: version.version });
          }
        }}
      />
      <MoveVersionDialog
        open={dialog?.kind === "move" && dialogPin !== undefined}
        skillId={dialogPin?.skill_id ?? ""}
        skillName={dialogPin?.skill_name ?? ""}
        botName={bot.name}
        used={dialogPin?.version ?? 0}
        target={dialog?.kind === "move" ? dialog.version : 0}
        versions={versions.data}
        versionsLoad={versionsLoad}
        pending={dialog !== null && busyDialog === dialog}
        error={dialogError}
        onClose={closeDialog}
        onConfirm={(version) => {
          if (dialogPin === undefined || dialog?.kind !== "move") return;
          const expected = {
            skill_version_id: dialogPin.skill_version_id,
            always_load: dialogPin.always_load,
          };
          runInDialog({
            shown: dialog,
            request: setPin
              .mutateAsync({
                path: { id: bot.id, skill_id: dialogPin.skill_id },
                body: {
                  skill_version_id: version.id,
                  always_load: dialogPin.always_load,
                  expected,
                },
              })
              .then((answer) => {
                replacePin({ answer, skillId: dialogPin.skill_id, expected });
              }),
            failed: (error) => staleText(dialogPin.skill_name, error),
            // The tab loads the newest pins and keeps no change (bot-page.md §7).
            closes: (error) => readApiError(error)?.code === "stale_write",
          });
        }}
      />
    </div>
  );
}

function SkillPinRow({
  pin,
  pendingLoad,
  onToggle,
  onUpgrade,
  onChangeVersion,
  onRemove,
}: {
  pin: BotPin;
  // The Always load value of a change that is on its way, or null.
  pendingLoad: boolean | null;
  onToggle: (alwaysLoad: boolean) => void;
  onUpgrade: () => void;
  onChangeVersion: () => void;
  onRemove: () => void;
}) {
  const alwaysLoad = pendingLoad ?? pin.always_load;
  const outdated = pin.version < pin.latest_version;
  return (
    <tr data-skill={pin.skill_slug} className="border-b border-outline">
      <td className="overflow-hidden py-3 pr-4">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="shrink-0 font-semibold">{pin.skill_name}</span>
          <span className="truncate text-sm text-on-surface-muted">{pin.description}</span>
        </span>
      </td>
      <td className="py-3 pr-4 whitespace-nowrap">
        <span className="flex items-center gap-2">
          <VersionPill version={pin.version} />
          {pin.deprecated ? (
            // UI-6.5: a deprecated skill keeps working and has no upgrade link.
            <Tooltip label="Deprecated by its author; keeps working" side="top">
              <span
                tabIndex={0}
                className="rounded-pill focus-visible:outline-2 focus-visible:outline-primary"
              >
                <Pill>Deprecated</Pill>
              </span>
            </Tooltip>
          ) : outdated ? (
            <button
              type="button"
              className="rounded-xs text-sm text-primary underline focus-visible:outline-2 focus-visible:outline-primary"
              onClick={onUpgrade}
            >
              v{pin.latest_version} available
            </button>
          ) : null}
        </span>
      </td>
      <td className="py-3 pr-4">
        <Switch
          checked={alwaysLoad}
          label={`Always load ${pin.skill_name}`}
          disabled={pendingLoad !== null}
          onChange={onToggle}
        />
      </td>
      <td className="py-3 text-right">
        <MenuRoot>
          <MenuTrigger
            aria-label={`Actions for ${pin.skill_name}`}
            className="inline-flex size-button-small items-center justify-center rounded-card hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-primary"
          >
            <Ellipsis aria-hidden className="size-4" />
          </MenuTrigger>
          <MenuPopup
            side="bottom"
            align="end"
            sideOffset={6}
            label={`Actions for ${pin.skill_name}`}
          >
            <MenuItem onClick={onChangeVersion}>Change version</MenuItem>
            <MenuSeparator />
            <MenuItem danger onClick={onRemove}>
              Remove
            </MenuItem>
          </MenuPopup>
        </MenuRoot>
      </td>
    </tr>
  );
}
