import { copyName, copySlug } from "@cty1ng/shared/skills";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "../../components/ui/button.tsx";
import { showToast } from "../../components/ui/toast.tsx";
import { readApiError } from "../../lib/api/api-error.ts";
import {
  getSettingsOptions,
  getSkillVersionOptions,
  listSkillVersionsOptions,
} from "../../lib/api/generated/@tanstack/react-query.gen.ts";
import { createSkill } from "../../lib/api/generated/sdk.gen.ts";
import type { CreateSkillData } from "../../lib/api/generated/types.gen.ts";
import { NotFoundPage } from "../placeholder/not-found-page.tsx";
import { useLeaveGuard } from "./leave-guard.tsx";
import { LoadError } from "./load-error.tsx";
import { SaveBarFrame, SaveButton } from "./save-bar.tsx";
import { saveErrorOf, type SaveError } from "./save-error.ts";
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
import { allSkillsOptions, useEditorSettings } from "./skill-queries.ts";

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
  const source = useCloneSource(from);
  // The copy's name is cut to the name limit, so a Clone waits for the settings (a failed load
  // uses the defaults, as the editor does).
  const settings = useQuery(getSettingsOptions());
  if (from === undefined) return <NewSkillView key="new" source={null} />;
  // A failed request is not a missing version: the error state with Try again. A failed
  // background refresh keeps the editor on the data it has.
  if (source.data === undefined) {
    if (source.isError) {
      return (
        <LoadError
          text="The app could not load the skill to copy."
          onRetry={() => void source.refetch()}
        />
      );
    }
    return <SkillEditorSkeleton />;
  }
  if (source.data === null) return <NotFoundPage />;
  if (settings.isPending) return <SkillEditorSkeleton />;
  return <NewSkillView key={from} source={source.data} />;
}

// The version a Clone copies. The URL holds only the version id, so after a reload the page
// looks for it in each skill's version list (most are in the cache already).
function useCloneSource(versionId: string | undefined) {
  const queryClient = useQueryClient();
  return useQuery({
    // The settings are not in the key: a new limit must not open a new editor over a draft.
    queryKey: ["skill-clone-source", versionId],
    enabled: versionId !== undefined,
    // Each Clone looks again at the slugs that are taken: a copy made since the last Clone
    // takes `-copy`, so the next one must get `-copy-2` (skills-page.md §12). Nothing is kept
    // after the page closes, and the open editor keeps its text when this fetches again.
    gcTime: 0,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<CloneSource | null> => {
      const skills = await queryClient.query({ ...allSkillsOptions(), staleTime: 0 });
      const slugs = new Set(skills.map((skill) => skill.slug));
      for (const skill of skills) {
        const versions = await queryClient.query(
          listSkillVersionsOptions({ path: { id: skill.id } }),
        );
        const match = versions.find((version) => version.id === versionId);
        if (match === undefined) continue;
        const version = await queryClient.query(
          getSkillVersionOptions({ path: { id: skill.id, version: match.version } }),
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

  const create = useMutation({
    mutationFn: (input: Parameters<typeof createWithFreeSlug>) => createWithFreeSlug(...input),
    onSuccess: async (skill) => {
      // M1 has no bots, so the assign card does not open: only the toast (skills-page.md §7).
      showToast(`Created ${skill.name} ✨`);
      allowLeave();
      // The skill page finds the skill in the list, so the list must have it first.
      await queryClient.invalidateQueries({ queryKey: allSkillsOptions().queryKey });
      await navigate({ to: "/skills/$slug", params: { slug: skill.slug } });
    },
    onError: (error) => {
      setSaveError(saveErrorOf(error));
    },
  });

  const filled = EDITOR_FIELDS.every((field) => form.current[field].trim() !== "");
  const reason = create.isPending
    ? "Saving."
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
        <Button
          onClick={() => {
            allowLeave();
            void navigate({ to: "/skills" });
          }}
        >
          Cancel
        </Button>
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
