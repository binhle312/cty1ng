import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ellipsis, Plus } from "lucide-react";
import { useRef, useState } from "react";
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
import { apiErrorText, readApiError } from "../../lib/api/api-error.ts";
import {
  listBotsOptions,
  listSkillVersionsOptions,
  pinSkillToBotsMutation,
  removeBotSkillMutation,
  setBotSkillMutation,
} from "../../lib/api/generated/@tanstack/react-query.gen.ts";
import type { GetSkillResponse } from "../../lib/api/generated/types.gen.ts";
import { PIN_QUERIES } from "../../lib/api/operation-queries.ts";
import { BotAvatar } from "../bots/bot-avatar.tsx";
import { modelLine } from "../bots/bot-lines.ts";
import type { BotRow } from "../bots/bot-queries.ts";
import { LoadError } from "./load-error.tsx";
import { VersionPill } from "./pills.tsx";
import type { BotUse } from "./skill-bot-uses.ts";
import { useBotUses } from "./skill-bot-uses.ts";
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
  const [dialog, setDialogState] = useState<Dialog | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  // The dialog whose request is on its way. Each open makes a new `Dialog` object, so a request
  // started in a dialog the owner closed (Skip, Esc) never closes or writes into a newer one.
  const shownDialog = useRef<Dialog | null>(null);
  const [busyDialog, setBusyDialog] = useState<Dialog | null>(null);
  // The Always load value of each toggle on its way, by bot id.
  const [pendingLoads, setPendingLoads] = useState<ReadonlyMap<string, boolean>>(new Map());

  const setDialog = (next: Dialog | null) => {
    shownDialog.current = next;
    setDialogState(next);
    setDialogError(null);
  };
  const closeDialog = () => {
    setDialog(null);
  };
  const isShown = (shown: Dialog) => shownDialog.current === shown;
  // A pin changed here changes both sides: the bot list shows it at once, and everything that
  // counts pins (the skill's header and list, the bot page) fetches again.
  const refresh = () => queryClient.invalidateQueries({ predicate: PIN_QUERIES });
  const replaceBots = (changed: BotRow[]) => {
    queryClient.setQueryData(listBotsOptions().queryKey, (current) =>
      current?.map((bot) => changed.find((item) => item.id === bot.id) ?? bot),
    );
  };
  // A stale pin: load the newest and say so; the change is not made.
  const failed = (botName: string) => (error: unknown) => {
    void refresh();
    showToast(
      readApiError(error)?.code === "stale_write"
        ? `${botName} changed in another place. Check it and try again.`
        : apiErrorText(error),
    );
  };

  // One hook serves every row, and a second `mutate` on a hook drops the callbacks of the first
  // (TanStack Query v5). So each request handles its own result through its promise, and the
  // pending state is kept per bot, not read from the hook.
  const setPin = useMutation(setBotSkillMutation());
  const removePin = useMutation(removeBotSkillMutation());
  const addPins = useMutation(pinSkillToBotsMutation());

  const toggleLoad = ({ bot, pin }: BotUse, alwaysLoad: boolean) => {
    setPendingLoads((current) => new Map(current).set(bot.id, alwaysLoad));
    void setPin
      .mutateAsync({
        path: { id: bot.id, skill_id: skill.id },
        body: {
          skill_version_id: pin.skill_version_id,
          always_load: alwaysLoad,
          expected: { skill_version_id: pin.skill_version_id, always_load: pin.always_load },
        },
      })
      .then((changed) => {
        replaceBots([changed]);
        void refresh();
      }, failed(bot.name))
      .finally(() => {
        setPendingLoads((current) => {
          const next = new Map(current);
          next.delete(bot.id);
          return next;
        });
      });
  };

  // A dialog's request: its result goes to that dialog while it is open. After the owner closed
  // it, a success needs nothing more (the list updates) and a failure shows as a toast.
  const runInDialog = <T,>(
    shown: Dialog,
    request: Promise<T>,
    done: (result: T) => void,
    errorText: (error: unknown) => string,
  ) => {
    setDialogError(null);
    setBusyDialog(shown);
    void request
      .then(
        (result) => {
          done(result);
          void refresh();
          if (isShown(shown)) closeDialog();
        },
        (error: unknown) => {
          void refresh();
          if (isShown(shown)) setDialogError(errorText(error));
          else showToast(errorText(error));
        },
      )
      .finally(() => {
        setBusyDialog((current) => (current === shown ? null : current));
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
                pendingLoad={pendingLoads.get(use.bot.id) ?? null}
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
                  void removePin
                    .mutateAsync({ path: { id: use.bot.id, skill_id: skill.id } })
                    .then(() => {
                      void refresh();
                    }, failed(use.bot.name));
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
        pending={dialog !== null && busyDialog === dialog}
        error={dialogError}
        onClose={closeDialog}
        onConfirm={(botIds) => {
          if (latestVersion === undefined || dialog?.kind !== "add") return;
          runInDialog(
            dialog,
            addPins.mutateAsync({
              path: { id: skill.id },
              body: {
                skill_version_id: latestVersion.id,
                bots: botIds.map((bot_id) => ({ bot_id, expected_skill_version_id: null })),
              },
            }),
            replaceBots,
            (error) =>
              readApiError(error)?.code === "stale_write"
                ? "A bot changed in another place. Check the list and try again."
                : apiErrorText(error),
          );
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
        pending={dialog !== null && busyDialog === dialog}
        error={dialogError}
        onClose={closeDialog}
        onConfirm={(version) => {
          if (dialogBot === undefined || dialog?.kind !== "move") return;
          const { bot, pin } = dialogBot;
          runInDialog(
            dialog,
            setPin.mutateAsync({
              path: { id: bot.id, skill_id: skill.id },
              body: {
                skill_version_id: version.id,
                always_load: pin.always_load,
                expected: { skill_version_id: pin.skill_version_id, always_load: pin.always_load },
              },
            }),
            (changed) => {
              replaceBots([changed]);
            },
            (error) =>
              readApiError(error)?.code === "stale_write"
                ? `${bot.name} changed in another place. Check it and try again.`
                : apiErrorText(error),
          );
        }}
      />
    </div>
  );
}

function BotPinRow({
  use: { bot, pin },
  skillDeprecated,
  pendingLoad,
  onToggle,
  onUpgrade,
  onChangeVersion,
  onRemove,
}: {
  use: BotUse;
  skillDeprecated: boolean;
  // The Always load value of a change that is on its way, or null.
  pendingLoad: boolean | null;
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
              className="rounded-xs text-sm text-primary underline focus-visible:outline-2 focus-visible:outline-primary"
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
          disabled={pendingLoad !== null}
          onChange={onToggle}
        />
      </td>
      <td className="py-3 text-right">
        <MenuRoot>
          <MenuTrigger
            aria-label={`Actions for ${bot.name}`}
            className="inline-flex size-button-small items-center justify-center rounded-card hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-primary"
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
