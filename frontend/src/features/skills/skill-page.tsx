import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notFound, useNavigate, useParams, useSearch } from "@tanstack/react-router";
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
import { SKILL_OR_BOT_QUERIES } from "../../lib/api/operation-queries.ts";
import { LoadError } from "./load-error.tsx";
import { useExportSkills } from "./export-card.tsx";
import { useLeaveGuard } from "./leave-guard.tsx";
import { Pill, VersionPill } from "./pills.tsx";
import { EditSaveBar, ReadOnlySaveBar } from "./save-bar.tsx";
import { CONFLICT_TEXT, saveErrorOf, type SaveError } from "./save-error.ts";
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
  markSaved,
  type SkillFields as FormFields,
  leaveText,
  newForm,
  saveKind,
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

// `/skills/{slug}` (skills-page.md §1, §2). The page finds the skill id from the slug in the list,
// which holds deprecated skills too, so a deprecated skill's URL opens after a reload. An unknown
// or trashed slug is Page not found.
export function SkillPage() {
  const { slug } = useParams({ from: "/skills/$slug" });
  const skills = useAllSkills();
  const row = skills.data?.find((skill) => skill.slug === slug);
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
  const search = useSearch({ from: "/skills/$slug" });
  const navigate = useNavigate({ from: "/skills/$slug" });
  const queryClient = useQueryClient();
  const settings = useEditorSettings();
  const { setDirtySlug } = useSkillsPage();

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
  // When the skill changes on the server, an editor with no changes takes the new text; an
  // editor with changes keeps them and shows the conflict.
  const serverKey = `${String(server.version)}:${String(server.rowVersion)}`;
  const [seenKey, setSeenKey] = useState(serverKey);
  if (seenKey !== serverKey) {
    setSeenKey(serverKey);
    if (!isDirty(form)) {
      setForm(newForm(saved, false));
      setBase(server);
    }
  }
  const conflict = base.version !== server.version || base.rowVersion !== server.rowVersion;
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
  const [dialog, setDialog] = useState<"deprecate" | "delete" | "remove" | null>(null);
  const bots = useBotUses(skill.id);
  const [dialogError, setDialogError] = useState<string | null>(null);

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

  const onError = (error: unknown) => {
    setSaveError(saveErrorOf(error));
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
      // The upgrade card of skills-page.md §7.1 is not built yet: only the toast.
      showToast(`Saved v${String(result.latest_version.version)} ✨`);
    },
    onError,
  });
  const saving = rename.isPending || saveVersion.isPending;

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
    // Clone takes the version on screen, the latest (§12).
    const versions = await queryClient.query(listSkillVersionsOptions({ path: { id: skill.id } }));
    const version = versions.find((item) => item.version === latest);
    if (version === undefined) return;
    void navigate({ to: "/skills/new", search: { from: version.id } });
  };

  const closeDialog = () => {
    setDialog(null);
    setDialogError(null);
  };
  const dialogFailed = (error: unknown) => {
    setDialogError(apiErrorText(error));
  };
  // Deprecate and Make active again change the skill here, so they move the base too, but
  // only when the edit was based on the newest data when the action started. Otherwise the
  // move would hide a change made in another place, and Save would overwrite it.
  const moveBase =
    (inSync: boolean) => (result: { latest_version: { version: number }; row_version: number }) => {
      if (inSync) {
        setBase({ version: result.latest_version.version, rowVersion: result.row_version });
      }
    };
  // A change of pins moves both sides: the bot list and the skill queries fetch again.
  const refreshPins = () => queryClient.invalidateQueries({ predicate: SKILL_OR_BOT_QUERIES });
  const deprecate = useMutation({
    ...deprecateSkillMutation(),
    onSuccess: () => {
      void refreshPins();
      closeDialog();
    },
    onError: dialogFailed,
  });
  // Remove from bots: one request for each ticked bot. A bot that fails stays in the list, so
  // the owner can try again; a pin that is already gone counts as removed (api.md §4).
  const removePin = useMutation(removeBotSkillMutation());
  const removeFromBots = async (botIds: string[]) => {
    setDialogError(null);
    const results = await Promise.allSettled(
      botIds.map((id) => removePin.mutateAsync({ path: { id, skill_id: skill.id } })),
    );
    void refreshPins();
    const failures = results.filter((result) => result.status === "rejected").length;
    if (failures === 0) {
      closeDialog();
      return;
    }
    setDialogError(
      `The app could not remove ${skill.name} from ${String(failures)} ${failures === 1 ? "bot" : "bots"}. Try again.`,
    );
  };
  const undeprecate = useMutation({
    ...undeprecateSkillMutation(),
    onError: (error) => {
      showToast(apiErrorText(error));
    },
  });
  const trash = useMutation({
    ...trashSkillMutation(),
    onSuccess: () => {
      void refreshPins();
      // The Trash page comes in M5b; until then "Trash" is plain text, not a link (§11).
      showToast(`${skill.name} is in Trash.`);
      closeDialog();
      allowLeave();
      void navigate({ to: "/skills", replace: true });
    },
    onError: dialogFailed,
  });

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
              setDialog("deprecate");
            }}
            onDelete={() => {
              setDialog("delete");
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
            setDialog("remove");
          }}
          onActivate={() => {
            undeprecate.mutate(
              { path: { id: skill.id }, body: { row_version: skill.row_version } },
              { onSuccess: moveBase(!conflict) },
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
        open={dialog === "deprecate"}
        skillName={skill.name}
        bots={bots}
        pending={deprecate.isPending}
        error={dialogError}
        onCancel={closeDialog}
        onConfirm={(removeBotIds) => {
          if (deprecate.isPending) return;
          deprecate.mutate(
            {
              path: { id: skill.id },
              body: { remove_bot_ids: removeBotIds, row_version: skill.row_version },
            },
            { onSuccess: moveBase(!conflict) },
          );
        }}
      />
      <RemoveFromBotsDialog
        open={dialog === "remove"}
        skillName={skill.name}
        bots={bots}
        pending={removePin.isPending}
        error={dialogError}
        onCancel={closeDialog}
        onConfirm={(botIds) => {
          if (removePin.isPending) return;
          void removeFromBots(botIds);
        }}
      />
      <DeleteDialog
        open={dialog === "delete"}
        skillName={skill.name}
        trashDays={settings.trashDays}
        bots={bots}
        pending={trash.isPending}
        error={dialogError}
        onCancel={closeDialog}
        onConfirm={() => {
          if (trash.isPending) return;
          trash.mutate({ path: { id: skill.id }, body: { row_version: skill.row_version } });
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
