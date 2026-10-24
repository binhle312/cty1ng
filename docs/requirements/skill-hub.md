# Skill hub

Writing, versioning, cloning, deprecating, importing and exporting skills.

## Stories

- **SK-1.** As the owner, I want to create and edit skills in the browser with a preview, so that I can write playbooks without touching files.  
  Acceptance criteria: UI-7.1 to UI-7.3.
- **SK-2.** As the author, I want every save to create a version and to choose which bots upgrade, so that bots change only when I decide.  
  Acceptance criteria: UI-7.4, UI-7.5.
- **SK-3.** As the owner, I want to deprecate a skill, and later delete it through Trash, so that bots change only when I decide and a mistake is easy to undo (D49).  
  Acceptance criteria: UI-7.6, UI-7.6a.
- **SK-4.** As the owner, I want to import and export SKILL.md folders, so that I can write skills in my editor or with an AI agent.  
  Acceptance criteria: UI-7.7, UI-7.8.
- **SK-5.** As the owner, I want to ask a bot to turn its work into a skill for itself or another bot, and approve it before it is used, so that good ways of working are kept without the bots changing on their own (D41).  
  Acceptance criteria: UI-7.9 to UI-7.15.

## Acceptance criteria

Shared rules for every story: `README.md` §Applies to every story. Layouts referenced below are sketches in `../design/`, not final designs.

## Skill hub and editor (UI-7)

- UI-7.1: List: name, slug, latest version, "n bots" with "m older" when bots use an older
  version, or "Not used". Order: last change first. Search by name or slug. "Show deprecated"
  check box. Layout, states and copy: `../design/components/skills-page.md`.
- UI-7.2: Actions: New, Import, Export in the list; History and the ⋯ menu in the skill header.
  ⋯ for an active skill: Clone, Export, Deprecate; for a deprecated skill: Clone, Delete skill.
  Deprecate and Delete are author only.
- UI-7.3: Editor: name (≤ 64 characters), slug (only when creating, made from the name until the
  owner edits it, accents removed), description (≤ 1,024), body (≤ 20,000, Markdown, Write and
  Preview tabs, opens in Preview when it has text), changelog line in the save bar. Every field
  except the changelog is required. A body over 500 lines gets a warning only. Non-authors see
  disabled fields and "Clone to edit" instead of Save.
- UI-7.4: Saving creates a new version, then shows "Also upgrade these bots to vN?" with the
  author's bots on older versions, all ticked, and Skip / Upgrade (D6). After Create, the card
  "Add {skill} to bots?" lists the bots, none ticked, with Skip / Assign.
- UI-7.5: History panel: versions newest first with changelog; diff between any two; "Restore"
  (creates a new version).
- UI-7.6: Deprecate lists the bots that use the skill, all ticked: ticked bots stop using it,
  unticked bots keep it and it works as before. A deprecated skill is read-only and has "Remove
  from bots" and "Make active again".
- UI-7.6a: Delete (deprecated skills only) sends the skill to Trash and removes it from every bot
  that uses it; the dialog lists those bots. Trash keeps it for `trash_days` (D49). Restore
  suggests assigning it again to those bots that are still active.
- UI-7.7: Import: upload a zip (or, via the CLI, a folder) → preview grouped as New skills, New
  versions of your skills (with diff), No change, Skipped (invalid or conflict, with the
  reason); each good row has a check box, all ticked → "Apply n changes". Files other than
  `SKILL.md` are listed as skipped. Nothing is written before Apply.
- UI-7.8: Export opens a card with every active skill ticked and "Select all", then downloads
  `<n>-skills-<UTC timestamp>.zip` with `<slug>/SKILL.md` folders.

## Suggested skill layout

A skill body is free Markdown. The editor help and the example skills (`seed/skills/`) suggest
this layout, because a fixed list of steps and a finish check make a bot's work easier to plan
and to check:

| Section | What it holds |
| --- | --- |
| `## Steps` | Numbered steps that the bot follows, in order |
| `## Done when` | Yes or no checks that say the work is complete |
| `## Reply` | What the reply names: the files, counts, open questions, unmet checks |

The app does not validate the layout. A skill without these sections works as before. A shared
skill `working-principles` holds general working rules (plan, check, finish, name sources). The
example bots pin it with "Always load" (D16). It is a normal skill: the owner turns it off or
unpins it per bot. Only rules about the app's own guarantees (for example how tool errors reach
the bot, `conversation-rules.md` §4) are fixed in the prompt. Process belongs in skills, not in the persona: skills have
versions and rollback (D6), and the Improve bot can change them (D51).

## Skills drafted by bots (D41)

- UI-7.9: When the owner asks, a bot drafts a skill and a card appears in the conversation: "<Bot>
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
