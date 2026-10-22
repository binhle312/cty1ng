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
- **SK-5.** As the owner, I want to ask a bot to turn its work into a skill for itself or another bot, and approve it before it is used, so that good ways of working are kept without the bots changing on their own (D41).  
  Acceptance criteria: UI-7.9 to UI-7.15.

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

## Skills drafted by bots (D41)

- UI-7.9: When the owner asks, a bot drafts a skill and a card appears in the chat: "<Bot>
  drafted a skill for <target bot>: <name>", with the slug, description, changelog and body
  (Markdown preview, raw HTML disabled), and the owner's message that asked for it.
- UI-7.10: A draft that edits an existing skill shows a diff against the version it was based
  on ("v3 → draft"), as on the History tab (UI-7.5).
- UI-7.11: The card has "Pin to <target bot>" (ticked) and "Always load" (off), and the buttons
  Edit, Approve and Reject. Approve creates the version and, if ticked, pins it, in one step.
  The card then says "Approved: <slug> v<N>, pinned to <bot>" with a link to the skill.
- UI-7.12: Edit opens the skill editor (UI-7.3) filled with the draft. Saving there approves
  it, and the card notes "edited by you before approving".
- UI-7.13: A draft whose skill gained a version, or was deprecated, since it was made shows
  "Out of date" instead of Approve, with "Ask <bot> to redraft", which fills the composer.
- UI-7.14: The skill's History tab marks versions that came from a draft: "drafted by <bot>",
  linking to the card's message.
- UI-7.15: A test with the fake model checks that `propose_skill` writes no skill and no pin
  until Approve, that the tool is not offered in bot turns, and that a draft containing a
  secret pattern is refused.
