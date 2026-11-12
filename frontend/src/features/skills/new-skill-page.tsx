import { copyName, copySlug } from "@cty1ng/shared/skills";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { showToast } from "../../components/ui/toast.tsx";
import { readApiError } from "../../lib/api/api-error.ts";
import {
  getSettingsOptions,
  getSkillVersionOptions,
  listSkillVersionsOptions,
} from "../../lib/api/generated/@tanstack/react-query.gen.ts";
import { createSkill } from "../../lib/api/generated/sdk.gen.ts";
import type { CreateSkillData } from "../../lib/api/generated/types.gen.ts";
import { readNewest } from "../../lib/api/query-reads.ts";
import { NotFoundPage } from "../placeholder/not-found-page.tsx";
import { assignCardAfterCreate } from "./after-save-cards.tsx";
import { useLeaveGuard } from "./leave-guard.tsx";
import { LoadError } from "./load-error.tsx";
import { useOnPage } from "./on-page.ts";
import { SaveBarFrame, SaveButton } from "./save-bar.tsx";
import { CLONE_LOAD_FAILED, lostSaveText, saveErrorOf, type SaveError } from "./save-error.ts";
import { SkillEditorSkeleton } from "./skill-editor-skeleton.tsx";
import { SkillFields } from "./skill-fields.tsx";
import {
  EDITOR_FIELDS,
  fieldProblems,
  hasProblem,
  isDirty,
  leaveText,
  newForm,
  setField,
  type SkillFields as Fields,
} from "./skill-form.ts";
import { allSkillsOptions, limitsReason, useEditorSettings } from "./skill-queries.ts";
import { useSkillsPage } from "./skills-context.tsx";

const EMPTY: Fields = { name: "", slug: "", description: "", body_md: "" };

interface CloneSource {
  skillName: string;
  skillSlug: string;
  version: number;
  versionId: string;
  description: string;
  body_md: string;
  // The slugs in the skill list when the Clone opened. Skills in Trash keep their slugs but are
  // not listed (api.md §2), so Create can still find a slug taken (see `createWithFreeSlug`).
  takenSlugs: ReadonlySet<string>;
}

// `/skills/new` and `/skills/new?from={skill version id}` (skills-page.md §1, §4, §12). Clone
// saves nothing until Create, so no unwanted copies stay in the list.
export function NewSkillPage() {
  const { from } = useSearch({ from: "/skills/new" });
  if (from === undefined) return <NewSkillView key="new" source={null} />;
  // One mount for each source version: the mount holds what its editor opened with.
  return <ClonePage key={from} from={from} />;
}

// The Clone of one version (skills-page.md §12). This mount owns one fact: the source that its
// editor opened with. The editor opens from a good answer of this visit, and then no later read
// closes it (frontend-conventions.md §5; DQ-180, DQ-191).
function ClonePage({ from }: { from: string }) {
  const source = useCloneSource(from);
  // The copy's name is cut to the name limit, so a Clone waits for the settings, once: after
  // the first answer, success or failure, it never waits again. After a failed load the editor
  // opens with no limit and the settings error; Create waits for the limits. (A query with no data goes back to pending on each new try, so waiting
  // on `isPending` would show the skeleton again and again while the settings fail.)
  const settings = useQuery(getSettingsOptions());
  const [settingsSettled, setSettingsSettled] = useState(false);
  if (!settingsSettled && !settings.isPending) setSettingsSettled(true);

  const [opened, setOpened] = useState<CloneSource | null>(null);
  // A good answer of this visit. Data that the cache had before this visit does not count: it
  // can be old (frontend-conventions.md §5, "A form that fills once").
  const answered = source.isFetchedAfterMount && source.isSuccess;
  // The source is kept at once. `answered` can go back to false, because a later read that
  // fails changes the status of the query; the kept source cannot.
  if (opened === null && answered && source.data !== null) setOpened(source.data);
  if (opened !== null) {
    if (!settingsSettled) return <SkillEditorSkeleton />;
    // Open. A later read that finds nothing, or that fails, keeps the editor on the source that
    // it opened with; a later good answer gives Create its newest slugs.
    return <NewSkillView source={source.data ?? opened} />;
  }
  if (!answered) {
    // A failed request is not a missing version: the error state with Try again.
    if (source.isError) {
      return <LoadError text={CLONE_LOAD_FAILED} onRetry={() => void source.refetch()} />;
    }
    return <SkillEditorSkeleton />;
  }
  return <NotFoundPage />;
}

// The version a Clone copies. The URL holds only the version id, so after a reload the page
// looks for it in each skill's version list (most are in the cache already).
function useCloneSource(versionId: string) {
  const queryClient = useQueryClient();
  return useQuery({
    // The settings are not in the key: a new limit must not open a new editor over a draft.
    queryKey: ["skill-clone-source", versionId],
    // Each Clone looks again at the slugs that are taken: a copy made since the last Clone
    // takes `-copy`, so the next one must get `-copy-2` (skills-page.md §12). `ClonePage` opens
    // its editor only from an answer of its own visit, so it does not use the data that the
    // cache keeps from an earlier visit.
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<CloneSource | null> => {
      const skills = await readNewest(() =>
        queryClient.query({ ...allSkillsOptions(), staleTime: 0 }),
      );
      const slugs = new Set(skills.map((skill) => skill.slug));
      for (const skill of skills) {
        const versions = await readNewest(() =>
          queryClient.query(listSkillVersionsOptions({ path: { id: skill.id } })),
        );
        const match = versions.find((version) => version.id === versionId);
        if (match === undefined) continue;
        const version = await readNewest(() =>
          queryClient.query(
            getSkillVersionOptions({ path: { id: skill.id, version: match.version } }),
          ),
        );
        return {
          skillName: skill.name,
          skillSlug: skill.slug,
          version: version.version,
          versionId: version.id,
          description: version.description,
          body_md: version.body_md,
          takenSlugs: slugs,
        };
      }
      // No listed skill has the version: it does not exist, or its skill is in Trash.
      return null;
    },
  });
}

// Create (skills-page.md §12). A copy's slug that the owner did not change is the app's
// proposal: when the server finds it taken (by a skill in Trash, or one made since the Clone
// opened), the app takes the next free suffix and tries again. A slug the owner typed shows
// the error instead.
async function createWithFreeSlug(
  body: CreateSkillData["body"],
  // The Clone source when the slug is still the app's proposal, else null.
  proposal: CloneSource | null,
) {
  const refused = new Set<string>();
  let slug = body.slug;
  for (;;) {
    try {
      const { data } = await createSkill({ body: { ...body, slug }, throwOnError: true });
      return data;
    } catch (error) {
      if (proposal === null || readApiError(error)?.code !== "slug_taken") throw error;
      refused.add(slug);
      slug = copySlug(
        proposal.skillSlug,
        (candidate) => proposal.takenSlugs.has(candidate) || refused.has(candidate),
      );
    }
  }
}

function NewSkillView({ source }: { source: CloneSource | null }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const settings = useEditorSettings();
  const { showBotCard } = useSkillsPage();
  const [proposedSlug] = useState(() =>
    source === null ? null : copySlug(source.skillSlug, (slug) => source.takenSlugs.has(slug)),
  );
  const [form, setForm] = useState(() => {
    const fields =
      source === null || proposedSlug === null
        ? EMPTY
        : {
            name: copyName(source.skillName, settings.limits.nameMax),
            slug: proposedSlug,
            description: source.description,
            body_md: source.body_md,
          };
    const form = newForm(fields, true);
    // A copy's slug is already set, so a new name does not change it.
    return { ...form, slugEdited: source !== null };
  });
  const [saveError, setSaveError] = useState<SaveError | null>(null);
  const problems = fieldProblems(form, settings.limits);
  const name = form.current.name.trim() === "" ? "this new skill" : form.current.name;
  const { allowLeave, dialog } = useLeaveGuard({
    dirty: isDirty(form),
    text: leaveText(form, name),
  });

  // A Create that ends after the owner left shows its toast but does not move the page that the
  // owner went to. Its failure shows as a toast too.
  const onPage = useOnPage();

  const create = useMutation({
    mutationFn: (input: Parameters<typeof createWithFreeSlug>) => createWithFreeSlug(...input),
    onSuccess: async (skill) => {
      // The assign card (§7.2), or only the toast when no bot exists.
      showBotCard(assignCardAfterCreate(queryClient, skill));
      // The skill page finds the skill in the list, so Create waits for the newest list before
      // it moves (frontend-conventions.md §5). A live event in that time starts a newer load,
      // and this wait follows it.
      await queryClient.invalidateQueries({ queryKey: allSkillsOptions().queryKey });
      if (!onPage.current) return;
      allowLeave();
      await navigate({ to: "/skills/$slug", params: { slug: skill.slug } });
    },
    onError: (error, [input]) => {
      if (onPage.current) {
        setSaveError(saveErrorOf(error));
      } else {
        showToast(lostSaveText({ name: input.name, error, verb: "create" }));
      }
    },
  });

  const filled = EDITOR_FIELDS.every((field) => form.current[field].trim() !== "");
  const reason = create.isPending
    ? "Saving."
    : limitsReason(settings) !== null
      ? limitsReason(settings)
      : !filled
        ? "Fill in every field."
        : hasProblem(problems) || saveError?.field != null
          ? "Fix the errors first."
          : null;

  return (
    <>
      <header className="shrink-0 px-8 pt-6">
        <h2 className="text-title font-semibold">
          New skill
          {source !== null && (
            <span className="font-normal text-on-surface-muted">
              {" "}
              · copy of {source.skillName} v{source.version}
            </span>
          )}
        </h2>
        <p className="mt-1 text-sm text-on-surface-muted">
          {source === null
            ? "A skill tells a bot how to do one task. You can assign it to bots after you save it."
            : "You are the author of the copy. Later changes to the original do not change it."}
        </p>
      </header>
      {settings.limitsFailed && (
        <LoadError
          className="shrink-0 py-3"
          text="The app could not load the limits for skills, so Create is off. Your text is kept."
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
          // The page leaves after Create, so text typed while it is pending would be lost: the
          // fields wait until the request ends.
          readOnly={create.isPending}
        />
      </div>
      <SaveBarFrame>
        <span className="grow text-sm text-danger">
          {saveError?.field === null ? saveError.message : ""}
        </span>
        <SaveButton
          label="Cancel"
          kind="secondary"
          // The request cannot be taken back, so Cancel waits for it (the skill may be created).
          disabledReason={create.isPending ? "Creating the skill." : null}
          onClick={() => {
            allowLeave();
            void navigate({ to: "/skills" });
          }}
        />
        <SaveButton
          label="Create"
          disabledReason={reason}
          onClick={() => {
            setSaveError(null);
            create.mutate([
              {
                slug: form.current.slug,
                name: form.current.name,
                description: form.current.description,
                body_md: form.current.body_md,
                ...(source === null ? {} : { cloned_from_skill_version_id: source.versionId }),
              },
              form.current.slug === proposedSlug ? source : null,
            ]);
          }}
        />
      </SaveBarFrame>
      {dialog}
    </>
  );
}
