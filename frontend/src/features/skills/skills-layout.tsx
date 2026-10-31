import { Outlet, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { SkillList } from "./skill-list.tsx";
import { SkillsPageContext, type SkillsPageState } from "./skills-context.tsx";

// The Skills page (skills-page.md §2): the list column and, beside it, the skill page, the new
// skill editor or the import page.
export function SkillsLayout() {
  const navigate = useNavigate();
  const [dirtySlug, setDirtySlug] = useState<string | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const state = useMemo<SkillsPageState>(
    () => ({
      dirtySlug,
      setDirtySlug,
      importFile,
      chooseImportFile: () => fileInput.current?.click(),
      clearImportFile: () => {
        setImportFile(null);
      },
    }),
    [dirtySlug, importFile],
  );

  return (
    <SkillsPageContext.Provider value={state}>
      <div className="flex h-full min-h-0">
        <SkillList />
        <section className="flex h-full min-w-0 grow flex-col">
          <Outlet />
        </section>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        aria-label="Choose a zip to import"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file === undefined) return;
          setImportFile(file);
          void navigate({ to: "/skills/import" });
        }}
      />
    </SkillsPageContext.Provider>
  );
}
