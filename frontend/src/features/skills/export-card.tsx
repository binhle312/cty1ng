import { useMutation } from "@tanstack/react-query";
import { type RefObject, useRef, useState } from "react";
import { Button } from "../../components/ui/button.tsx";
import { Checkbox } from "../../components/ui/checkbox.tsx";
import { Dialog, DialogButtons, DialogText } from "../../components/ui/dialog.tsx";
import { showToast } from "../../components/ui/toast.tsx";
import { Tooltip } from "../../components/ui/tooltip.tsx";
import { apiErrorText } from "../../lib/api/api-error.ts";
import { exportSkills } from "../../lib/api/generated/sdk.gen.ts";
import { cn } from "../../lib/cn.ts";
import { fileNameFrom, saveFile } from "./download.ts";
import { VersionPill } from "./pills.tsx";
import type { SkillRow } from "./skill-queries.ts";

// Download a zip of the picked skills, each with its latest version (UI-7.8). The name is the
// server's `<n>-skills-<UTC timestamp>.zip`.
export function useExportSkills() {
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { data, response } = await exportSkills({
        query: { ids: ids.join(",") },
        throwOnError: true,
      });
      const fileName = fileNameFrom(response, "skills.zip");
      saveFile(data, fileName);
      return { count: ids.length, fileName };
    },
    onSuccess: ({ count, fileName }) => {
      showToast(`Exported ${count === 1 ? "1 skill" : `${String(count)} skills`} to ${fileName}.`);
    },
    onError: (error) => {
      showToast(apiErrorText(error));
    },
  });
}

// The Export card (skills-page.md §16): every active skill, all ticked, and Select all.
export function ExportCard({
  open,
  onClose,
  skills,
}: {
  open: boolean;
  onClose: () => void;
  skills: SkillRow[];
}) {
  const exportButton = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Export skills 📦"
      defaultButton={exportButton}
      className="w-dialog-wide"
    >
      {/* A new body each time the card opens, so every box starts ticked. */}
      {open && <ExportCardBody onClose={onClose} skills={skills} buttonRef={exportButton} />}
    </Dialog>
  );
}

function ExportCardBody({
  onClose,
  skills,
  buttonRef,
}: {
  onClose: () => void;
  skills: SkillRow[];
  buttonRef: RefObject<HTMLButtonElement | null>;
}) {
  const [picked, setPicked] = useState(() => new Set(skills.map((skill) => skill.id)));
  const exportMutation = useExportSkills();
  const count = picked.size;
  const allPicked = count === skills.length && count > 0;
  const toggle = (id: string, on: boolean) => {
    setPicked((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };
  const label = `Export ${count === 1 ? "1 skill" : `${String(count)} skills`}`;
  const exportButton = (
    <Button
      ref={buttonRef}
      kind="primary"
      aria-disabled={count === 0 || exportMutation.isPending}
      onClick={() => {
        if (count === 0 || exportMutation.isPending) return;
        exportMutation.mutate(
          skills.filter((skill) => picked.has(skill.id)).map((skill) => skill.id),
          { onSuccess: onClose },
        );
      }}
    >
      {label}
    </Button>
  );

  return (
    <>
      <DialogText>
        Tick the skills to put in the zip. Each one goes in with its latest version.
      </DialogText>
      {skills.length === 0 ? (
        <p className="mt-4 text-on-surface-muted">No active skill to export.</p>
      ) : (
        <>
          <div className="mt-4 flex items-center justify-between border-b border-outline pb-2">
            <Checkbox
              checked={allPicked}
              onChange={(on) => {
                setPicked(on ? new Set(skills.map((skill) => skill.id)) : new Set());
              }}
            >
              Select all
            </Checkbox>
            <span className="text-sm text-on-surface-muted">
              {count} of {skills.length}
            </span>
          </div>
          <ul className="mt-2 flex max-h-72 flex-col gap-1 overflow-y-auto">
            {skills.map((skill) => {
              const on = picked.has(skill.id);
              return (
                <li key={skill.id}>
                  <Checkbox
                    checked={on}
                    onChange={(next) => {
                      toggle(skill.id, next);
                    }}
                    className={cn(
                      "rounded-control border border-transparent px-2 py-1.5",
                      on && "border-primary",
                    )}
                  >
                    <span className="min-w-0 grow truncate">{skill.name}</span>
                    <span className="truncate font-mono text-sm text-on-surface-muted">
                      {skill.slug}
                    </span>
                    <VersionPill version={skill.latest_version.version} />
                  </Checkbox>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <DialogButtons>
        <Button onClick={onClose}>Cancel</Button>
        {count === 0 ? (
          <Tooltip label="Tick a skill to export." side="top">
            {exportButton}
          </Tooltip>
        ) : (
          exportButton
        )}
      </DialogButtons>
    </>
  );
}
