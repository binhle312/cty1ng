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
import { Skeleton, SkeletonArea } from "../../components/ui/skeleton.tsx";
import { Switch } from "../../components/ui/switch.tsx";
import { showToast } from "../../components/ui/toast.tsx";
import { Tooltip } from "../../components/ui/tooltip.tsx";
import {
  listSkillVersionsOptions,
  pinSkillToBotsMutation,
  removeBotSkillMutation,
  setBotSkillMutation,
} from "../../lib/api/generated/@tanstack/react-query.gen.ts";
import type { GetSkillResponse } from "../../lib/api/generated/types.gen.ts";
import { PIN_QUERIES } from "../../lib/api/operation-queries.ts";
import { refreshQueries } from "../../lib/api/query-reads.ts";
import { BotAvatar } from "../bots/bot-avatar.tsx";
import { modelLine } from "../bots/bot-lines.ts";
import {
  sendPinChange,
  sendPinChanges,
  sendPinRemove,
  useAlwaysLoadsOnTheirWay,
  usePinChangesOnTheirWay,
} from "../bots/bot-list-store.ts";
import { pinErrorText } from "../bots/bot-queries.ts";
import { LoadError } from "./load-error.tsx";
import { VersionPill } from "./pills.tsx";
import type { BotUse } from "./skill-bot-uses.ts";
import { useBotUses } from "./skill-bot-uses.ts";
import { useDialogRequests } from "./dialog-requests.ts";
import { AddBotsDialog, ChangeVersionDialog, MoveVersionDialog } from "./skill-pin-dialogs.tsx";

// The Bots tab (skills-page.md §2a, UI-7.5a): the bots that use the skill, with the version, the
// Always load switch and a ⋯ menu. Changes save at once and apply from each bot's next run.
// Every change sends the pin as this tab shows it, so the server refuses a change over one made
// in another place (409 `stale_write`).
type Dialog =
  | { kind: "add" }
  | { kind: "change"; botId: string }
  | { kind: "move"; botId: string; version: number };

export function SkillBotsTab({ skill }: { skill: GetSkillResponse }) {
  const queryClient = useQueryClient();
  const bots = useBotUses(skill.id);
  const versions = useQuery(listSkillVersionsOptions({ path: { id: skill.id } }));
  // Data from an earlier load stays usable after a failed refetch.
  const versionsLoad = {
    failed: versions.isError && versions.data === undefined,
    retry: () => void versions.refetch(),
  };
  // The Always load value of each toggle on its way; it outlives the tab (`bot-list-store.ts`).
  const loadOnItsWay = useAlwaysLoadsOnTheirWay();
  // A row whose change is on its way has its actions off (bot-page.md §4.2, Q3).
  const changeOnItsWay = usePinChangesOnTheirWay();

  // A pin changed here changes both sides: the bot list shows it at once, and everything that
  // counts pins (the skill's header and list, the bot page) fetches again.
  const refresh = () => refreshQueries(queryClient, { predicate: PIN_QUERIES });
  const {
    dialog,
    open: setDialog,
    close: closeDialog,
    error: dialogError,
    pending: dialogPending,
    run: runInDialog,
  } = useDialogRequests<Dialog>();
  // One hook serves every row, and a second `mutate` on a hook drops the callbacks of the first
  // (TanStack Query v5). So each request handles its own result through its promise, and the
  // pending state is kept per bot, not read from the hook.
  const setPin = useMutation(setBotSkillMutation());
  const removePin = useMutation(removeBotSkillMutation());
  const addPins = useMutation(pinSkillToBotsMutation());

  const toggleLoad = ({ bot, pin }: BotUse, alwaysLoad: boolean) => {
    const expected = { skill_version_id: pin.skill_version_id, always_load: pin.always_load };
    // The switch shows the value on its way until the refresh after the answer (`bot-list-state.ts`).
    void sendPinChange({
      queryClient,
      request: () =>
        setPin.mutateAsync({
          path: { id: bot.id, skill_id: skill.id },
          body: { skill_version_id: pin.skill_version_id, always_load: alwaysLoad, expected },
        }),
      botId: bot.id,
      skillId: skill.id,
      alwaysLoad,
      expected,
      onFailed: (error) => {
        showToast(pinErrorText({ error, changed: bot.name }));
      },
      refresh,
    });
  };

  if (bots.kind === "loading") {
    return (
      <div className="px-8 py-5">
        <SkeletonArea label="Loading the bots">
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="mb-2 h-14" />
          ))}
        </SkeletonArea>
      </div>
    );
  }
  if (bots.kind === "error") {
    return <LoadError text="The app could not load the bots." onRetry={bots.retry} />;
  }

  const using = new Set(bots.uses.map(({ bot }) => bot.id));
  const others = bots.all.filter((bot) => !using.has(bot.id));
  const latestVersion = versions.data?.[0];
  const openBot = (botId: string) => bots.uses.find(({ bot }) => bot.id === botId);
  const dialogBot = dialog !== null && dialog.kind !== "add" ? openBot(dialog.botId) : undefined;

  // Why + Add is off, or null. A deprecated skill takes no new bot (api.md §2), so it has no Add.
  const addOffReason =
    bots.all.length === 0
      ? "Create a bot first."
      : others.length === 0
        ? "Every bot uses this skill."
        : null;

  return (
    <div className="px-8 py-5">
      <div className="flex items-center justify-between gap-4">
        <p className="text-on-surface-muted">
          Changes save at once. Each bot uses them from its next run.
        </p>
        {!skill.deprecated &&
          (addOffReason === null ? (
            <Button
              size="small"
              onClick={() => {
                setDialog({ kind: "add" });
              }}
            >
              <Plus aria-hidden className="size-3.5" />
              Add
            </Button>
          ) : (
            <Tooltip label={addOffReason} side="left">
              <Button size="small" aria-disabled>
                <Plus aria-hidden className="size-3.5" />
                Add
              </Button>
            </Tooltip>
          ))}
      </div>
      {bots.uses.length === 0 ? (
        <p className="mt-8 text-center text-on-surface-muted">No bot uses this skill yet.</p>
      ) : (
        <table className="mt-4 w-full text-left">
          <thead>
            <tr className="border-b border-outline text-xs tracking-wide text-on-surface-muted uppercase">
              <th scope="col" className="py-2 font-medium">
                Bot
              </th>
              <th scope="col" className="py-2 font-medium">
                Version
              </th>
              <th scope="col" className="py-2 font-medium">
                Always load
              </th>
              <th scope="col" className="w-10 py-2">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {bots.uses.map((use) => (
              <BotPinRow
                key={use.bot.id}
                use={use}
                skillDeprecated={skill.deprecated}
                pendingLoad={loadOnItsWay({ botId: use.bot.id, skillId: skill.id })}
                busy={changeOnItsWay({ botId: use.bot.id, skillId: skill.id })}
                onToggle={(alwaysLoad) => {
                  toggleLoad(use, alwaysLoad);
                }}
                onUpgrade={() => {
                  setDialog({ kind: "move", botId: use.bot.id, version: use.pin.latest_version });
                }}
                onChangeVersion={() => {
                  setDialog({ kind: "change", botId: use.bot.id });
                }}
                onRemove={() => {
                  // The row goes at once; a failure brings it back with a toast (`bot-list-state.ts`).
                  sendPinRemove({
                    queryClient,
                    request: () =>
                      removePin.mutateAsync({ path: { id: use.bot.id, skill_id: skill.id } }),
                    botId: use.bot.id,
                    skillId: skill.id,
                    onFailed: (error) => {
                      showToast(pinErrorText({ error, changed: use.bot.name }));
                    },
                    refresh,
                  });
                }}
              />
            ))}
          </tbody>
        </table>
      )}
      <AddBotsDialog
        open={dialog?.kind === "add"}
        skillName={skill.name}
        latest={latestVersion}
        versionsLoad={versionsLoad}
        bots={others}
        pending={dialogPending}
        error={dialogError}
        onClose={closeDialog}
        onConfirm={(botIds) => {
          if (latestVersion === undefined || dialog?.kind !== "add") return;
          runInDialog({
            dialog,
            // One request adds the skill to many bots: each bot's pin is a change of its own.
            request: sendPinChanges({
              queryClient,
              pins: botIds.map((botId) => ({ botId, skillId: skill.id, expected: null })),
              request: () =>
                addPins.mutateAsync({
                  path: { id: skill.id },
                  body: {
                    skill_version_id: latestVersion.id,
                    bots: botIds.map((bot_id) => ({ bot_id, expected_skill_version_id: null })),
                  },
                }),
              botsOf: (answers) => answers,
              refresh,
            }),
            failed: (error) => pinErrorText({ error, changed: null }),
          });
        }}
      />
      <ChangeVersionDialog
        open={dialog?.kind === "change" && dialogBot !== undefined}
        botName={dialogBot?.bot.name ?? ""}
        used={dialogBot?.pin.version ?? 0}
        versions={versions.data}
        versionsLoad={versionsLoad}
        onClose={closeDialog}
        onPick={(version) => {
          if (dialog?.kind === "change") {
            setDialog({ kind: "move", botId: dialog.botId, version: version.version });
          }
        }}
      />
      <MoveVersionDialog
        open={dialog?.kind === "move" && dialogBot !== undefined}
        skillId={skill.id}
        skillName={skill.name}
        botName={dialogBot?.bot.name ?? ""}
        used={dialogBot?.pin.version ?? 0}
        target={dialog?.kind === "move" ? dialog.version : 0}
        versions={versions.data}
        versionsLoad={versionsLoad}
        pending={dialogPending}
        error={dialogError}
        onClose={closeDialog}
        onConfirm={(version) => {
          if (dialogBot === undefined || dialog?.kind !== "move") return;
          const { bot, pin } = dialogBot;
          const expected = { skill_version_id: pin.skill_version_id, always_load: pin.always_load };
          runInDialog({
            dialog,
            request: sendPinChanges({
              queryClient,
              pins: [{ botId: bot.id, skillId: skill.id, expected }],
              request: () =>
                setPin.mutateAsync({
                  path: { id: bot.id, skill_id: skill.id },
                  body: { skill_version_id: version.id, always_load: pin.always_load, expected },
                }),
              botsOf: (answer) => [answer],
              refresh,
            }),
            failed: (error) => pinErrorText({ error, changed: bot.name }),
          });
        }}
      />
    </div>
  );
}

function BotPinRow({
  use: { bot, pin },
  skillDeprecated,
  pendingLoad,
  busy,
  onToggle,
  onUpgrade,
  onChangeVersion,
  onRemove,
}: {
  use: BotUse;
  skillDeprecated: boolean;
  // The Always load value of a change that is on its way, or null.
  pendingLoad: boolean | null;
  // A change of this row is on its way: the switch, the link and ⋯ are off, so no second change
  // goes out with an old `expected` pin (bot-page.md §4.2, Q3).
  busy: boolean;
  onToggle: (alwaysLoad: boolean) => void;
  onUpgrade: () => void;
  onChangeVersion: () => void;
  onRemove: () => void;
}) {
  // While a toggle is pending, the switch shows the value it asked for.
  const alwaysLoad = pendingLoad ?? pin.always_load;
  const outdated = pin.version < pin.latest_version;
  return (
    <tr className="border-b border-outline">
      <td className="py-3 pr-4">
        <span className="flex items-center gap-3">
          <BotAvatar bot={bot} />
          <span className="min-w-0">
            <span className="block font-semibold">{bot.name}</span>
            <span className="block text-sm text-on-surface-muted">{modelLine(bot)}</span>
          </span>
        </span>
      </td>
      <td className="py-3 pr-4">
        <span className="flex items-center gap-2">
          <VersionPill version={pin.version} />
          {!outdated ? (
            <span className="text-sm text-on-surface-muted">latest</span>
          ) : skillDeprecated ? null : (
            <button
              type="button"
              className="rounded-xs text-sm text-primary underline focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40"
              disabled={busy}
              onClick={onUpgrade}
            >
              Upgrade to v{pin.latest_version}
            </button>
          )}
        </span>
      </td>
      <td className="py-3 pr-4">
        <Switch
          checked={alwaysLoad}
          label={`Always load for ${bot.name}`}
          disabled={busy}
          onChange={onToggle}
        />
      </td>
      <td className="py-3 text-right">
        <MenuRoot>
          <MenuTrigger
            aria-label={`Actions for ${bot.name}`}
            disabled={busy}
            className="inline-flex size-button-small items-center justify-center rounded-card hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-primary data-disabled:cursor-not-allowed data-disabled:opacity-40"
          >
            <Ellipsis aria-hidden className="size-4" />
          </MenuTrigger>
          <MenuPopup side="bottom" align="end" sideOffset={6} label={`Actions for ${bot.name}`}>
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
