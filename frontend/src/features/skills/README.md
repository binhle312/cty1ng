# skills

The Skills page (`docs/design/components/skills-page.md`, M1b): the list column, the skill page
with its Skill, Bots and History tabs, the new skill and Clone editor, the import page and the
Export card. Routes: `src/routes/skills.tsx`.

| File | What it is for |
| --- | --- |
| `skills-layout.tsx` | The list column and the page beside it; the import file picker |
| `skills-context.tsx` | What the list needs from the page: the unsaved skill, the picked zip |
| `skill-list.tsx` | The list column: Create, search, Show deprecated, Import, Export, rows |
| `skills-index-page.tsx` | `/skills`: opens the top skill, or the empty state |
| `skill-page.tsx` | `/skills/{slug}`: page top, ⋯ menu, deprecated banner, tabs, save |
| `skill-fields.tsx` | The editor fields with counters, errors and the Write/Preview body |
| `skill-form.ts` | The editor's rules without React: changes, save kind, errors, leave text |
| `save-bar.tsx` | The save bars: edit, read-only, and the button with a "why off" tooltip |
| `save-error.ts` | Puts a failed save under its field or in the save bar |
| `leave-guard.tsx` | Leave without saving: the dialog and the browser's own question |
| `skill-dialogs.tsx` | The Deprecate and Delete dialogs |
| `skill-bots-tab.tsx` | The Bots tab (M1: no bots yet) |
| `skill-history.tsx` | The History tab: versions, Compare, Restore |
| `diff-view.tsx` | A read-only line diff with folded unchanged lines |
| `diff-fold.ts` | Which unchanged lines the diff folds |
| `new-skill-page.tsx` | `/skills/new` and Clone (`?from=` a version id) |
| `import-page.tsx` | `/skills/import`: the preview groups and Apply |
| `export-card.tsx` | The Export card and the zip download |
| `download.ts` | Saves a downloaded file under the server's file name |
| `skill-queries.ts` | The skill list query, the editor's limits from the settings |
| `pills.tsx` | Version, Deprecated, "not saved" and import status pills |
| `skill-editor-skeleton.tsx` | The page while it loads |

Start here: `skills-layout.tsx`. Do not: check a field's limit here; the rules are in
`shared/src/skills.ts`, so the editor and the server refuse the same text.
