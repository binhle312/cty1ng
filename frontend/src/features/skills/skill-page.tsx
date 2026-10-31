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
import { Tooltip } from "../../components/ui/tooltip.tsx";
import { apiErrorText } from "../../lib/api/api-error.ts";
import {
  createSkillVersionMutation,
  deprecateSkillMutation,
  getSkillOptions,
  listSkillVersionsOptions,
  renameSkillMutation,
  trashSkillMutation,
  undeprecateSkillMutation,
} from "../../lib/api/generated/@tanstack/react-query.gen.ts";
import type { GetSkillResponse } from "../../lib/api/generated/types.gen.ts";
import { formatFullTime, formatTime } from "../../lib/time-format.ts";
import { useExportSkills } from "./export-card.tsx";
import { useLeaveGuard } from "./leave-guard.tsx";
import { Pill, VersionPill } from "./pills.tsx";
import { EditSaveBar, ReadOnlySaveBar } from "./save-bar.tsx";
import { saveErrorOf, type SaveError } from "./save-error.ts";
import { SkillBotsTab } from "./skill-bots-tab.tsx";
import { DeleteDialog, DeprecateDialog } from "./skill-dialogs.tsx";
import { SkillEditorSkeleton } from "./skill-editor-skeleton.tsx";
import { SkillFields } from "./skill-fields.tsx";
import {
  changedFields,
  discard,
  fieldProblems,
  hasProblem,
  leaveText,
  newForm,
  saveKind,
  setField,
} from "./skill-form.ts";
import { SkillHistory } from "./skill-history.tsx";
import { usedByLine, useAllSkills, useEditorSettings } from "./skill-queries.ts";
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
  // The shell's Page not found replaces the whole Skills page (skills-page.md §1).
  // eslint-disable-next-line @typescript-eslint/only-throw-error -- the router's way to show Page not found
  if (row === undefined) throw notFound();
  if (detail.isPending) return <SkillEditorSkeleton />;
  if (detail.isError) {
    return <p className="px-8 py-6 text-on-surface-muted">{apiErrorText(detail.error)}</p>;
  }
  // A new version or a rename gives a new editor with the saved text; a refetch with the same
  // data keeps the edit.
  const key = `${detail.data.id}:${String(detail.data.latest_version.version)}:${String(detail.data.row_version)}`;
  return <SkillView key={key} skill={detail.data} />;
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
  const [changelog, setChangelog] = useState("");
  const [saveError, setSaveError] = useState<SaveError | null>(null);
  const [dialog, setDialog] = useState<"deprecate" | "delete" | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const readOnly = skill.deprecated || !skill.is_author;
  const changes = changedFields(form);
  const dirty = changes.length > 0 && !readOnly;
  const kind = saveKind(form);
  const problems = fieldProblems(form, settings.limits);
  const latest = skill.latest_version.version;

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
      // M1 has no bots, so no upgrade card opens: only the toast (skills-page.md §7).
      showToast(`Saved v${String(result.latest_version.version)} ✨`);
    },
    onError,
  });
  const saving = rename.isPending || saveVersion.isPending;

  const save = () => {
    setSaveError(null);
    if (kind === "rename") {
      rename.mutate({
        path: { id: skill.id },
        body: { name: form.current.name, row_version: skill.row_version },
      });
      return;
    }
    const renamed = form.current.name !== skill.name;
    const note = changelog.trim();
    saveVersion.mutate({
      path: { id: skill.id },
      body: {
        base_version: latest,
        description: form.current.description,
        body_md: form.current.body_md,
        upgrade_bot_ids: [],
        ...(note === "" ? {} : { changelog: note }),
        ...(renamed ? { name: form.current.name, row_version: skill.row_version } : {}),
      },
    });
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
  const deprecate = useMutation({
    ...deprecateSkillMutation(),
    onSuccess: closeDialog,
    onError: dialogFailed,
  });
  const undeprecate = useMutation({
    ...undeprecateSkillMutation(),
    onError: (error) => {
      showToast(apiErrorText(error));
    },
  });
  const trash = useMutation({
    ...trashSkillMutation(),
    onSuccess: () => {
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
          onActivate={() => {
            undeprecate.mutate({
              path: { id: skill.id },
              body: { row_version: skill.row_version },
            });
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
            <ReadOnlySaveBar text="Deprecated skills are read-only. Make it active again to edit it." />
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
                setForm(discard);
                setChangelog("");
                setSaveError(null);
              }}
              onSave={save}
              blockedReason={blockedReason}
              error={saveError?.field === null ? saveError.message : null}
            />
          )}
        </TabsPanel>
        <TabsPanel value="bots" className="min-h-0 grow overflow-y-auto">
          <SkillBotsTab />
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
        pending={deprecate.isPending}
        error={dialogError}
        onCancel={closeDialog}
        onConfirm={() => {
          if (deprecate.isPending) return;
          deprecate.mutate({
            path: { id: skill.id },
            body: { remove_bot_ids: [], row_version: skill.row_version },
          });
        }}
      />
      <DeleteDialog
        open={dialog === "delete"}
        skillName={skill.name}
        trashDays={settings.trashDays}
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

// The banner of a deprecated skill (skills-page.md §10.2). M1 has no bots, so Remove from bots
// is hidden.
function DeprecatedBanner({
  skill,
  pending,
  onActivate,
}: {
  skill: SkillDetail;
  pending: boolean;
  onActivate: () => void;
}) {
  const at = skill.deprecated_at;
  return (
    <div className="mx-8 mt-4 flex shrink-0 items-center gap-4 rounded-card border border-waiting bg-primary-container px-4 py-3">
      <div className="grow text-sm">
        <p className="font-semibold">
          Deprecated{" "}
          {at !== null && (
            <Tooltip label={formatFullTime(at)} side="top">
              <time dateTime={at}>{formatTime(at, new Date())}</time>
            </Tooltip>
          )}
        </p>
        <p className="text-on-surface-muted">
          {skill.bots_using === 0
            ? "No bot uses it."
            : `${String(skill.bots_using)} ${skill.bots_using === 1 ? "bot still uses" : "bots still use"} it.`}
        </p>
        <p className="text-on-surface-muted">New bots cannot add it.</p>
      </div>
      {skill.is_author && (
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
      )}
    </div>
  );
}
