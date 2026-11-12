import { useIsMutating, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notFound, useNavigate, useParams, useRouter, useSearch } from "@tanstack/react-router";
import { Bot, Ellipsis, FileText, History } from "lucide-react";
import { useEffect, useState } from "react";
import {
  MenuItem,
  MenuPopup,
  MenuRoot,
  MenuSeparator,
  MenuTrigger,
} from "../../components/ui/menu.tsx";
import { Button } from "../../components/ui/button.tsx";
import { Tab, TabsList, TabsPanel, TabsRoot } from "../../components/ui/tabs.tsx";
import { showToast } from "../../components/ui/toast.tsx";
import { TimeText } from "../../components/ui/time-text.tsx";
import { apiErrorText, readApiError } from "../../lib/api/api-error.ts";
import {
  createSkillVersionMutation,
  deprecateSkillMutation,
  getSkillOptions,
  listSkillVersionsOptions,
  removeBotSkillMutation,
  renameSkillMutation,
  trashSkillMutation,
  undeprecateSkillMutation,
} from "../../lib/api/generated/@tanstack/react-query.gen.ts";
import type { GetSkillResponse } from "../../lib/api/generated/types.gen.ts";
import { PIN_QUERIES } from "../../lib/api/operation-queries.ts";
import { readNewest, refreshQueries } from "../../lib/api/query-reads.ts";
import { sendPinChanges } from "../bots/bot-list-store.ts";
import { upgradeCardAfterSave } from "./after-save-cards.tsx";
import { useDialogRequests } from "./dialog-requests.ts";
import { LoadError } from "./load-error.tsx";
import { useExportSkills } from "./export-card.tsx";
import { useLeaveGuard } from "./leave-guard.tsx";
import { useOnPage } from "./on-page.ts";
import { Pill, VersionPill } from "./pills.tsx";
import { EditSaveBar, ReadOnlySaveBar } from "./save-bar.tsx";
import {
  CLONE_LOAD_FAILED,
  CONFLICT_TEXT,
  lostSaveText,
  saveErrorOf,
  type SaveError,
} from "./save-error.ts";
import { useBotUses } from "./skill-bot-uses.ts";
import { SkillBotsTab } from "./skill-bots-tab.tsx";
import { DeleteDialog, DeprecateDialog, RemoveFromBotsDialog } from "./skill-dialogs.tsx";
import { SkillEditorSkeleton } from "./skill-editor-skeleton.tsx";
import { SkillFields } from "./skill-fields.tsx";
import {
  changedFields,
  fieldProblems,
  hasProblem,
  isDirty,
  isNewer,
  markSaved,
  type SkillFields as FormFields,
  leaveText,
  newForm,
  saveKind,
  takesServerText,
  setField,
} from "./skill-form.ts";
import { SkillHistory } from "./skill-history.tsx";
import {
  allSkillsOptions,
  limitsReason,
  usedByLine,
  useAllSkills,
  useEditorSettings,
} from "./skill-queries.ts";
import { useSkillsPage } from "./skills-context.tsx";

type SkillDetail = GetSkillResponse;
type TabName = "skill" | "bots" | "history";

const trashKey = (slug: string) => ["trash-skill", slug];

// `/skills/{slug}` (skills-page.md §1, §2). The page finds the skill id from the slug in the list,
// which holds deprecated skills too, so a deprecated skill's URL opens after a reload. An unknown
// or trashed slug is Page not found.
export function SkillPage() {
  const { slug } = useParams({ from: "/skills/$slug" });
  const skills = useAllSkills();
  const row = skills.data?.find((skill) => skill.slug === slug);
  // A Delete of this skill is on its way. The query client holds the request, so the wait has the
  // same life as the request: it ends once, it is per skill, and it survives a later visit.
  // A live event can take the skill from the list before the answer, so Page not found waits.
  const trashing = useIsMutating({ mutationKey: trashKey(slug) }) > 0;
  const detail = useQuery({
    ...getSkillOptions({ path: { id: row?.id ?? "" } }),
    enabled: row !== undefined,
  });

  if (skills.isPending) return <SkillEditorSkeleton />;
  // A failed request is not a missing skill: the error state comes before Page not found. A
  // failed background refresh keeps the editor and its unsaved text on the data it has.
  if (skills.data === undefined) {
    return (
      <LoadError text="The app could not load the skills." onRetry={() => void skills.refetch()} />
    );
  }
  if (row === undefined && trashing) return <SkillEditorSkeleton />;
  // A list on its way may bring the skill, for example after a link from another tab. Page not
  // found waits for the newest list.
  if (row === undefined && skills.isFetching) return <SkillEditorSkeleton />;
  // A refresh that failed is not a missing skill either: the list did not load.
  if (row === undefined && skills.isError) {
    return (
      <LoadError text="The app could not load the skills." onRetry={() => void skills.refetch()} />
    );
  }
  // The shell's Page not found replaces the whole Skills page (skills-page.md §1).
  // eslint-disable-next-line @typescript-eslint/only-throw-error -- the router's way to show Page not found
  if (row === undefined) throw notFound();
  if (detail.isPending) return <SkillEditorSkeleton />;
  if (detail.data === undefined) {
    return <LoadError text={apiErrorText(detail.error)} onRetry={() => void detail.refetch()} />;
  }
  return <SkillView key={detail.data.id} skill={detail.data} />;
}

function SkillView({ skill }: { skill: SkillDetail }) {
  const router = useRouter();
  const search = useSearch({ from: "/skills/$slug" });
  const navigate = useNavigate({ from: "/skills/$slug" });
  const queryClient = useQueryClient();
  const settings = useEditorSettings();
  const { setDirtySlug, showBotCard } = useSkillsPage();

  const saved = {
    name: skill.name,
    slug: skill.slug,
    description: skill.latest_version.description,
    body_md: skill.body_md,
  };
  const [form, setForm] = useState(() => newForm(saved, false));
  // The saved state that the edit started from. Saves send it, so the server refuses a save
  // over a change made in another place (409 `stale_write`) instead of overwriting it.
  const server = { version: skill.latest_version.version, rowVersion: skill.row_version };
  const [base, setBase] = useState(server);
  // After this page's own save, the text it sent is the saved text, based on the result.
  const savedHere = (
    result: { latest_version: { version: number }; row_version: number },
    sent: FormFields,
    note: string,
  ) => {
    setBase({ version: result.latest_version.version, rowVersion: result.row_version });
    setForm((current) => markSaved(current, sent));
    setChangelog((current) => (current.trim() === note ? "" : current));
  };
  const [changelog, setChangelog] = useState("");
  const [saveError, setSaveError] = useState<SaveError | null>(null);
  // A request that ends after its dialog closed (Cancel, Esc) never closes or writes into a newer
  // dialog; its failure shows as a toast instead (`dialog-request-state.ts`).
  const {
    dialog,
    open: openDialog,
    close: closeDialog,
    error: dialogError,
    run: runInDialog,
  } = useDialogRequests<{ kind: "deprecate" | "delete" | "remove" }>();
  const bots = useBotUses(skill.id);

  const onPage = useOnPage();
  const onError = (error: unknown) => {
    // The save bar shows an error only while the form has changes. An owner who left, typed the
    // text back or clicked Discard gets a toast, because nothing else shows the failure.
    if (onPage.current && isDirty(form)) {
      setSaveError(saveErrorOf(error));
    } else {
      showToast(lostSaveText({ name: skill.name, error }));
    }
    // A stale save: load the newest version now. The edit stays, and the conflict shows.
    if (readApiError(error)?.code === "stale_write") {
      void queryClient.invalidateQueries({
        queryKey: getSkillOptions({ path: { id: skill.id } }).queryKey,
      });
      void queryClient.invalidateQueries({ queryKey: allSkillsOptions().queryKey });
    }
  };
  const rename = useMutation({
    ...renameSkillMutation(),
    onSuccess: () => {
      showToast("Saved ✨");
    },
    onError,
  });
  const saveVersion = useMutation({
    ...createSkillVersionMutation(),
    onSuccess: (result) => {
      // The upgrade card (§7.1), or only the toast when no bot uses an older version. The save
      // bar does not wait for it.
      showBotCard(upgradeCardAfterSave(queryClient, result));
    },
    onError,
  });
  const saving = rename.isPending || saveVersion.isPending;
  // The server data that the editor text last came from.
  const [taken, setTaken] = useState(server);
  if (takesServerText({ server, base, taken, saving, dirty: isDirty(form) })) {
    setTaken(server);
    setForm(newForm(saved, false));
    setBase(server);
    // An error was about the text that this replaces.
    setSaveError(null);
  }
  // The server has a change that this edit did not start from.
  const serverAhead = isNewer({ point: server, than: base });
  const conflict = serverAhead && !saving;
  const readOnly = skill.deprecated || !skill.is_author;
  const changes = changedFields(form);
  // Unsaved text is protected also when the skill turns read-only under it (deprecated in
  // another place): the text stays on screen, and leaving asks first.
  const dirty = changes.length > 0;
  const kind = saveKind(form);
  const problems = fieldProblems(form, settings.limits);
  const latest = server.version;

  useEffect(() => {
    setDirtySlug(dirty ? skill.slug : null);
    return () => {
      setDirtySlug(null);
    };
  }, [dirty, skill.slug, setDirtySlug]);

  const { allowLeave, dialog: leaveDialog } = useLeaveGuard({
    dirty,
    text: leaveText(form, skill.name),
  });

  const save = () => {
    setSaveError(null);
    // The text this request sends; typing goes on while it is pending.
    const sent = form.current;
    const note = changelog.trim();
    if (kind === "rename") {
      rename.mutate(
        { path: { id: skill.id }, body: { name: sent.name, row_version: base.rowVersion } },
        {
          onSuccess: (result) => {
            savedHere(result, sent, note);
          },
        },
      );
      return;
    }
    const renamed = sent.name !== form.saved.name;
    saveVersion.mutate(
      {
        path: { id: skill.id },
        body: {
          base_version: base.version,
          description: sent.description,
          body_md: sent.body_md,
          ...(note === "" ? {} : { changelog: note }),
          ...(renamed ? { name: sent.name, row_version: base.rowVersion } : {}),
        },
      },
      {
        onSuccess: (result) => {
          savedHere(result, sent, note);
        },
      },
    );
  };

  const exportSkill = useExportSkills();
  const clone = async () => {
    // Clone takes the version on screen, the latest (§12). A read that fails leaves the page as it
    // is. An owner who left has moved on, so only an owner who stayed hears about it.
    const version = await readNewest(() =>
      queryClient.query(listSkillVersionsOptions({ path: { id: skill.id } })),
    ).then(
      (versions) => versions.find((item) => item.version === latest),
      () => undefined,
    );
    if (!onPage.current) return;
    if (version === undefined) {
      showToast(CLONE_LOAD_FAILED);
      return;
    }
    void navigate({ to: "/skills/new", search: { from: version.id } });
  };

  // Deprecate and Make active again change the skill here, so they move the base too, but
  // only when the edit was based on the newest data when the action started. Otherwise the
  // move would hide a change made in another place, and Save would overwrite it.
  const moveBase =
    (inSync: boolean) => (result: { latest_version: { version: number }; row_version: number }) => {
      if (inSync) {
        const next = { version: result.latest_version.version, rowVersion: result.row_version };
        // A late answer can be older than a Save that ended first, and the base only goes up.
        setBase((current) => (isNewer({ point: next, than: current }) ? next : current));
      }
    };
  // A change of pins moves both sides: the bot list and the skill queries fetch again.
  const refreshPins = () => refreshQueries(queryClient, { predicate: PIN_QUERIES });
  const deprecate = useMutation(deprecateSkillMutation());
  const deprecateSkill = (removeBotIds: string[]) => {
    if (dialog === null) return;
    const inSync = !serverAhead;
    runInDialog({
      dialog,
      // Also after a failure, the lists refresh: a 422 on remove_bot_ids means the bot list here
      // is stale. The rows of the removed bots stay off until then.
      request: sendPinChanges({
        queryClient,
        pins: removeBotIds.map((botId) => ({ botId, skillId: skill.id, expected: null })),
        request: () =>
          deprecate.mutateAsync({
            path: { id: skill.id },
            body: { remove_bot_ids: removeBotIds, row_version: skill.row_version },
          }),
        botsOf: () => [],
        refresh: refreshPins,
      }),
      done: moveBase(inSync),
      failed: apiErrorText,
    });
  };
  // Remove from bots: one request for each ticked bot. A bot that fails stays in the list, so
  // the owner can try again; a pin that is already gone counts as removed (api.md §4). Each bot's
  // removal is a pin change of its own, so one that fails ends nothing of that pin. The requests
  // share one hook, whose `isPending` follows only the last one, so the whole group is a mutation
  // of its own.
  const removePin = useMutation(removeBotSkillMutation());
  const removeFromBots = useMutation({
    mutationFn: (botIds: string[]) =>
      Promise.allSettled(
        botIds.map((botId) =>
          sendPinChanges({
            queryClient,
            pins: [{ botId, skillId: skill.id, expected: null }],
            request: () => removePin.mutateAsync({ path: { id: botId, skill_id: skill.id } }),
            botsOf: () => [],
            refresh: refreshPins,
          }),
        ),
      ),
  });
  const removeSkillFromBots = (botIds: string[]) => {
    if (dialog === null) return;
    runInDialog({
      dialog,
      request: removeFromBots.mutateAsync(botIds).then((results) => {
        const failures = results.filter((result) => result.status === "rejected").length;
        if (failures > 0) {
          throw new Error(
            `The app could not remove ${skill.name} from ${String(failures)} ${failures === 1 ? "bot" : "bots"}. Try again.`,
          );
        }
      }),
      failed: (error) => (error instanceof Error ? error.message : apiErrorText(error)),
    });
  };
  const undeprecate = useMutation({
    ...undeprecateSkillMutation(),
    onError: (error) => {
      showToast(apiErrorText(error));
    },
  });
  const trash = useMutation({
    ...trashSkillMutation(),
    mutationKey: trashKey(skill.slug),
    // These run before the request ends, so the wait lasts until the page has moved.
    onSuccess: async () => {
      // The answer says that the skill is gone, so `/skills` must not read it from an old list and
      // come back here. The refresh cuts any older load before the move, so none can bring it back.
      queryClient.setQueryData(allSkillsOptions().queryKey, (list) =>
        list?.filter((row) => row.id !== skill.id),
      );
      void refreshPins();
      // The Trash page comes in M5b; until then "Trash" is plain text, not a link (§11).
      showToast(`${skill.name} is in Trash.`);
      allowLeave();
      // The skill is gone, so the page leaves it even when the dialog was closed meanwhile. An
      // owner who already went to another page stays there.
      if (router.state.location.pathname === `/skills/${skill.slug}`) {
        await navigate({ to: "/skills", replace: true });
      }
    },
  });
  const trashSkill = () => {
    if (dialog === null) return;
    runInDialog({
      dialog,
      request: trash.mutateAsync({
        path: { id: skill.id },
        body: { row_version: skill.row_version },
      }),
      done: closeDialog,
      failed: apiErrorText,
    });
  };

  const tab: TabName = search.tab ?? "skill";
  const setTab = (next: TabName) => {
    void navigate({ search: { tab: next === "skill" ? undefined : next } });
  };

  const blockedReason = saving
    ? "Saving."
    : limitsReason(settings) !== null
      ? limitsReason(settings)
      : conflict
        ? "This skill changed in another place."
        : hasProblem(problems) || saveError?.field != null
          ? "Fix the errors first."
          : null;

  return (
    <>
      <header className="shrink-0 px-8 pt-6">
        <div className="flex items-center gap-2">
          <h2 className="min-w-0 truncate text-title font-semibold">{skill.name}</h2>
          <VersionPill version={latest} />
          {skill.deprecated && <Pill>Deprecated</Pill>}
          <span className="grow" />
          <SkillMenu
            skill={skill}
            onClone={() => void clone()}
            onExport={() => {
              exportSkill.mutate([skill.id]);
            }}
            onDeprecate={() => {
              openDialog({ kind: "deprecate" });
            }}
            onDelete={() => {
              openDialog({ kind: "delete" });
            }}
          />
        </div>
        <p className="mt-1 text-sm text-on-surface-muted">
          <span className="font-mono">{skill.slug}</span> · by{" "}
          {skill.is_author ? "You" : "another author"} · {usedByLine(skill)}
        </p>
      </header>
      {skill.deprecated && (
        <DeprecatedBanner
          skill={skill}
          pending={undeprecate.isPending}
          onRemoveFromBots={() => {
            openDialog({ kind: "remove" });
          }}
          onActivate={() => {
            undeprecate.mutate(
              { path: { id: skill.id }, body: { row_version: skill.row_version } },
              { onSuccess: moveBase(!serverAhead) },
            );
          }}
        />
      )}
      <TabsRoot
        value={tab}
        onValueChange={(value) => {
          setTab(value === "bots" ? "bots" : value === "history" ? "history" : "skill");
        }}
        className="flex min-h-0 grow flex-col"
      >
        <TabsList className="mx-8 mt-4 shrink-0 border-b border-outline">
          <Tab value="skill">
            <FileText aria-hidden className="size-4" />
            Skill
          </Tab>
          <Tab value="bots">
            <Bot aria-hidden className="size-4" />
            Bots
            <span className="text-sm text-on-surface-muted">{skill.bots_using}</span>
            {skill.bots_outdated > 0 && (
              <span className="text-sm text-primary">↑{skill.bots_outdated}</span>
            )}
          </Tab>
          <Tab value="history">
            <History aria-hidden className="size-4" />
            History
            <span className="text-sm text-on-surface-muted">{latest}</span>
          </Tab>
        </TabsList>
        <TabsPanel value="skill" className="flex min-h-0 grow flex-col">
          {settings.limitsFailed && !readOnly && (
            <LoadError
              className="shrink-0 py-3"
              text="The app could not load the limits for skills, so Save is off. Your changes are kept."
              onRetry={settings.retry}
            />
          )}
          <div className="min-h-0 grow overflow-y-auto px-8 py-5">
            <SkillFields
              form={form}
              onChange={(field, value) => {
                setForm((current) => setField(current, field, value));
                if (saveError?.field === field) setSaveError(null);
              }}
              settings={settings}
              problems={problems}
              serverError={saveError?.field == null ? null : saveError}
              readOnly={readOnly}
            />
          </div>
          {skill.deprecated ? (
            <ReadOnlySaveBar
              text={
                dirty
                  ? "This skill was deprecated. Your changes are still here, but you cannot save them. Copy what you need before you leave."
                  : "Deprecated skills are read-only. Make it active again to edit it."
              }
            />
          ) : !skill.is_author ? (
            <ReadOnlySaveBar
              text="You cannot edit this skill. Only its author can change it."
              onClone={() => void clone()}
            />
          ) : (
            <EditSaveBar
              changes={changes.length}
              renameOnly={kind === "rename"}
              nextVersion={latest + 1}
              changelog={changelog}
              onChangelog={setChangelog}
              onDiscard={() => {
                // Discard puts back the saved text: the newest one, also after a conflict.
                setForm(newForm(saved, false));
                setBase(server);
                setChangelog("");
                setSaveError(null);
              }}
              onSave={save}
              blockedReason={blockedReason}
              error={
                conflict ? CONFLICT_TEXT : saveError?.field === null ? saveError.message : null
              }
            />
          )}
        </TabsPanel>
        <TabsPanel value="bots" className="min-h-0 grow overflow-y-auto">
          <SkillBotsTab skill={skill} />
        </TabsPanel>
        <TabsPanel value="history" className="flex min-h-0 grow flex-col">
          <SkillHistory
            skill={skill}
            from={search.from}
            to={search.to}
            onPick={(pair) => {
              void navigate({
                search: { tab: "history", from: pair?.from, to: pair?.to },
                replace: true,
              });
            }}
          />
        </TabsPanel>
      </TabsRoot>
      <DeprecateDialog
        open={dialog?.kind === "deprecate"}
        skillName={skill.name}
        bots={bots}
        pending={deprecate.isPending}
        error={dialogError}
        onCancel={closeDialog}
        onConfirm={(removeBotIds) => {
          if (deprecate.isPending) return;
          deprecateSkill(removeBotIds);
        }}
      />
      <RemoveFromBotsDialog
        open={dialog?.kind === "remove"}
        skillName={skill.name}
        bots={bots}
        pending={removeFromBots.isPending}
        error={dialogError}
        onCancel={closeDialog}
        onConfirm={(botIds) => {
          if (removeFromBots.isPending) return;
          removeSkillFromBots(botIds);
        }}
      />
      <DeleteDialog
        open={dialog?.kind === "delete"}
        skillName={skill.name}
        trashDays={settings.trashDays}
        bots={bots}
        pending={trash.isPending}
        error={dialogError}
        onCancel={closeDialog}
        onConfirm={() => {
          if (trash.isPending) return;
          trashSkill();
        }}
      />
      {leaveDialog}
    </>
  );
}

// The ⋯ menu (skills-page.md §9, §8): Clone, Export and Deprecate for an active skill; Clone and
// Delete skill for a deprecated one. Only the author can deprecate or delete.
function SkillMenu({
  skill,
  onClone,
  onExport,
  onDeprecate,
  onDelete,
}: {
  skill: SkillDetail;
  onClone: () => void;
  onExport: () => void;
  onDeprecate: () => void;
  onDelete: () => void;
}) {
  return (
    <MenuRoot>
      <MenuTrigger
        aria-label="Skill actions"
        className="flex size-button-small items-center justify-center rounded-card border border-outline-strong hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-primary"
      >
        <Ellipsis aria-hidden className="size-4" />
      </MenuTrigger>
      <MenuPopup side="bottom" align="end" sideOffset={6} label="Skill actions">
        <MenuItem onClick={onClone}>Clone</MenuItem>
        {!skill.deprecated && <MenuItem onClick={onExport}>Export</MenuItem>}
        {skill.is_author && (
          <>
            <MenuSeparator />
            {skill.deprecated ? (
              <MenuItem danger onClick={onDelete}>
                Delete skill
              </MenuItem>
            ) : (
              <MenuItem danger onClick={onDeprecate}>
                Deprecate
              </MenuItem>
            )}
          </>
        )}
      </MenuPopup>
    </MenuRoot>
  );
}

// The banner of a deprecated skill (skills-page.md §10.2). Remove from bots is hidden when no bot
// uses the skill.
function DeprecatedBanner({
  skill,
  pending,
  onActivate,
  onRemoveFromBots,
}: {
  skill: SkillDetail;
  pending: boolean;
  onActivate: () => void;
  onRemoveFromBots: () => void;
}) {
  const at = skill.deprecated_at;
  return (
    <div className="mx-8 mt-4 flex shrink-0 items-center gap-4 rounded-card border border-waiting bg-primary-container px-4 py-3">
      <div className="grow text-sm">
        <p className="font-semibold">Deprecated {at !== null && <TimeText iso={at} />}</p>
        <p className="text-on-surface-muted">
          {skill.bots_using === 0
            ? "No bot uses it."
            : `${String(skill.bots_using)} ${skill.bots_using === 1 ? "bot still uses" : "bots still use"} it.`}
        </p>
        <p className="text-on-surface-muted">New bots cannot add it.</p>
      </div>
      {skill.is_author && (
        <div className="flex shrink-0 gap-2">
          {skill.bots_using > 0 && (
            <Button size="small" kind="danger" onClick={onRemoveFromBots}>
              Remove from bots
            </Button>
          )}
          <Button
            size="small"
            kind="primary"
            aria-disabled={pending}
            onClick={() => {
              if (!pending) onActivate();
            }}
          >
            Make active again
          </Button>
        </div>
      )}
    </div>
  );
}
