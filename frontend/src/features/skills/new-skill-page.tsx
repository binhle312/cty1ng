import { copyName, copySlug } from "@cty1ng/shared/skills";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "../../components/ui/button.tsx";
import { showToast } from "../../components/ui/toast.tsx";
import {
  createSkillMutation,
  getSkillVersionOptions,
  listSkillVersionsOptions,
} from "../../lib/api/generated/@tanstack/react-query.gen.ts";
import { NotFoundPage } from "../placeholder/not-found-page.tsx";
import { useLeaveGuard } from "./leave-guard.tsx";
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
  version: number;
  versionId: string;
  fields: Fields;
}

// `/skills/new` and `/skills/new?from={skill version id}` (skills-page.md §1, §4, §12). Clone
// saves nothing until Create, so no unwanted copies stay in the list.
export function NewSkillPage() {
  const { from } = useSearch({ from: "/skills/new" });
  const source = useCloneSource(from);
  if (from === undefined) return <NewSkillView key="new" source={null} />;
  if (source.isPending) return <SkillEditorSkeleton />;
  if (source.isError || source.data === null) return <NotFoundPage />;
  return <NewSkillView key={from} source={source.data} />;
}

// The version a Clone copies. The URL holds only the version id, so after a reload the page
// looks for it in each skill's version list (most are in the cache already).
function useCloneSource(versionId: string | undefined) {
  const queryClient = useQueryClient();
  const { limits } = useEditorSettings();
  return useQuery({
    queryKey: ["skill-clone-source", versionId, limits.nameMax],
    enabled: versionId !== undefined,
    staleTime: Infinity,
    queryFn: async (): Promise<CloneSource | null> => {
      const skills = await queryClient.query(allSkillsOptions());
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
          version: version.version,
          versionId: version.id,
          fields: {
            name: copyName(skill.name, limits.nameMax),
            slug: copySlug(skill.slug, (slug) => slugs.has(slug)),
            description: version.description,
            body_md: version.body_md,
          },
        };
      }
      return null;
    },
  });
}

function NewSkillView({ source }: { source: CloneSource | null }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const settings = useEditorSettings();
  const [form, setForm] = useState(() => {
    const form = newForm(source?.fields ?? EMPTY, true);
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
    ...createSkillMutation(),
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
          readOnly={false}
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
            create.mutate({
              body: {
                slug: form.current.slug,
                name: form.current.name,
                description: form.current.description,
                body_md: form.current.body_md,
                ...(source === null ? {} : { cloned_from_skill_version_id: source.versionId }),
              },
            });
          }}
        />
      </SaveBarFrame>
      {dialog}
    </>
  );
}
