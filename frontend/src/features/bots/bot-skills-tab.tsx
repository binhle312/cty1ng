import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ellipsis, Plus } from "lucide-react";
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
  listSkillsOptions,
  listSkillVersionsOptions,
  removeBotSkillMutation,
  setBotSkillMutation,
} from "../../lib/api/generated/@tanstack/react-query.gen.ts";
import { PIN_QUERIES } from "../../lib/api/operation-queries.ts";
import { Pill, VersionPill } from "../skills/pills.tsx";
import { ChangeVersionDialog, MoveVersionDialog } from "../skills/skill-pin-dialogs.tsx";
import { useDialogRequests } from "../skills/dialog-requests.ts";
import { AddSkillsDialog } from "./add-skills-dialog.tsx";
import { type BotPin, type BotRow, pinErrorText } from "./bot-queries.ts";
import {
  botListLoads,
  sendPinChange,
  sendPinRemove,
  useAlwaysLoadsOnTheirWay,
  writePinAnswer,
} from "./pin-answer.ts";

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
  const refresh = () => queryClient.invalidateQueries({ predicate: PIN_QUERIES });
  const {
    dialog,
    open: setDialog,
    close: closeDialog,
    closeNow: closeDialogNow,
    error: dialogError,
    pending: dialogPending,
    run: runInDialog,
  } = useDialogRequests<Dialog>({ refresh });
  // The Always load value of each toggle on its way; it outlives the tab (`pin-answer.ts`).
  const loadOnItsWay = useAlwaysLoadsOnTheirWay();

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

  // A pin answer writes only its own pin, and only when the page still shows the expected pin
  // and the list did not load since the request went out (`pin-answer.ts`).
  const staleText = (skillName: string, error: unknown) =>
    pinErrorText({ error, changed: skillName });

  // One hook serves every row, and a second `mutate` on a hook drops the callbacks of the first
  // (TanStack Query v5), so each request handles its own result through its promise.
  const setPin = useMutation(setBotSkillMutation());
  const removePin = useMutation(removeBotSkillMutation());

  const toggleLoad = (pin: BotPin, alwaysLoad: boolean) => {
    const expected = { skill_version_id: pin.skill_version_id, always_load: pin.always_load };
    // The switch shows the value on its way until the refresh after the answer (`pin-answer.ts`).
    void sendPinChange({
      queryClient,
      request: () =>
        setPin.mutateAsync({
          path: { id: bot.id, skill_id: pin.skill_id },
          body: { skill_version_id: pin.skill_version_id, always_load: alwaysLoad, expected },
        }),
      botId: bot.id,
      skillId: pin.skill_id,
      alwaysLoad,
      expected,
      onFailed: (error) => {
        showToast(staleText(pin.skill_name, error));
      },
      refresh,
    });
  };

  // Remove asks nothing and has no Undo: it deletes nothing (SK1). The row goes at once; a pin
  // that is already gone just stays away (204), and a failure brings it back with a toast.
  const remove = (pin: BotPin) => {
    sendPinRemove({
      queryClient,
      request: () => removePin.mutateAsync({ path: { id: bot.id, skill_id: pin.skill_id } }),
      botId: bot.id,
      skillId: pin.skill_id,
      onFailed: (error) => {
        showToast(apiErrorText(error));
      },
      refresh,
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
          const loadsAtSend = botListLoads(queryClient);
          const answer = await setPin.mutateAsync({
            path: { id: bot.id, skill_id: skillId },
            body: { skill_version_id: latest.id, always_load: false, expected: null },
          });
          writePinAnswer({ queryClient, answer, skillId, expected: null, loadsAtSend });
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
  if (dialogSkillId !== null && dialogPin === undefined) closeDialogNow();
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
                pendingLoad={loadOnItsWay({ botId: bot.id, skillId: pin.skill_id })}
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
        pending={dialogPending}
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
            dialog,
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
        pending={dialogPending}
        error={dialogError}
        onClose={closeDialog}
        onConfirm={(version) => {
          if (dialogPin === undefined || dialog?.kind !== "move") return;
          const expected = {
            skill_version_id: dialogPin.skill_version_id,
            always_load: dialogPin.always_load,
          };
          const loadsAtSend = botListLoads(queryClient);
          runInDialog({
            dialog,
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
                writePinAnswer({
                  queryClient,
                  answer,
                  skillId: dialogPin.skill_id,
                  expected,
                  loadsAtSend,
                });
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
