import { createContext, useContext } from "react";

// What the list column needs to know about the page beside it (skills-page.md §2, §4, §15):
// which skill has unsaved changes (the `primary` dot after its name), and the zip that Import
// picked, which the import page then previews.
export interface SkillsPageState {
  // The slug of the skill whose editor has unsaved changes, or null.
  dirtySlug: string | null;
  setDirtySlug: (slug: string | null) => void;
  importFile: File | null;
  // Opens the browser's file picker; a picked zip opens the import page.
  chooseImportFile: () => void;
  // After Apply or Cancel, so a later visit to the import page starts with no file.
  clearImportFile: () => void;
}

export const SkillsPageContext = createContext<SkillsPageState | null>(null);

export function useSkillsPage(): SkillsPageState {
  const state = useContext(SkillsPageContext);
  if (state === null) throw new Error("useSkillsPage is used outside the Skills page");
  return state;
}
