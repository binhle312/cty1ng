# Skill hub

Writing, versioning, cloning, deprecating, importing and exporting skills.

## Stories

- **SK-1.** As the owner, I want to create and edit skills in the browser with a preview, so that I can write playbooks without touching files.  
  Acceptance criteria: UI-7.1 to UI-7.3.
- **SK-2.** As the author, I want every save to create a version and to choose which bots upgrade, so that bots change only when I decide.  
  Acceptance criteria: UI-7.4, UI-7.5.
- **SK-3.** As the owner, I want to deprecate instead of delete, so that bots using a skill keep working.  
  Acceptance criteria: UI-7.6.
- **SK-4.** As the owner, I want to import and export SKILL.md folders, so that I can write skills in my editor or with an AI agent.  
  Acceptance criteria: UI-7.7, UI-7.8.

## Acceptance criteria

Shared rules for every story: `README.md` §Applies to every story. Layouts referenced below are sketches in `../design/`, not final designs.

## Skill hub and editor (UI-7)

- UI-7.1: List: name, slug, description, author, latest version, "used by n bots (m on older
  versions)", last edited. Search by name/slug. "Show deprecated" filter.
- UI-7.2: Actions: New skill, Import, Export; per skill: Open, Clone, Deprecate (author only).
- UI-7.3: Editor: slug (only when creating), name, description (with 300-char counter), body
  (Markdown editor with live preview), changelog line. Non-authors see read-only content and a
  "Clone" button instead of Save.
- UI-7.4: Saving creates a new version, then shows the "Also upgrade these bots to vN?" dialog
  listing the author's bots on older versions, all unchecked, with "Done" (D6).
- UI-7.5: History tab: versions newest first with changelog; diff between any two; "Restore"
  (creates a new version).
- UI-7.6: Deprecate shows which bots pin the skill and explains they keep working.
- UI-7.7: Import: upload a zip (or, via the CLI, a folder) → preview table (new, changed with
  diff, unchanged, invalid with reason, conflict) → "Apply n changes". Nothing is written before
  Apply.
- UI-7.8: Export downloads a zip of `<slug>/SKILL.md` folders.
