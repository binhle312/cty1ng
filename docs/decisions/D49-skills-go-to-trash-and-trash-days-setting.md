# D49. Deleted skills go to Trash, Trash keeps items for a set number of days, and only a permanent delete has Undo

Status: accepted (2026-10-23, owner). The owner gave these rules in the UI design review, round 8. It amends D47 (project delete), the skill rules in `../domain-model.md` §3.4, and rule 5 of `../../AGENTS.md`.
Decision:
- **Delete a skill.** Only a deprecated skill has **Delete skill**. The delete works also while
  bots use the skill: the app removes it from every bot in the same transaction, and the dialog
  lists those bots. The skill and all its versions go to Trash as one item.
- **Trash days.** Trash keeps an item for the number of days in the setting `trash_days`
  (default 30). The setting applies to projects (D47) and skills. After that time, the app
  deletes the item permanently.
- **Restore.** A restore brings back the skill, deprecated, with all its versions. Trash keeps
  the list of bots that used the skill. After a restore, the app suggests to assign the skill
  again to those bots that are still active, never to bots in Trash.
- **Slug.** While the skill is in Trash, its slug stays taken, so a restore always works. After
  the permanent delete, a new skill can use the slug.
- **Old runs.** Runs refer to a skill version by its id and keep a copy of the slug and the
  version number. After the permanent delete, a chat shows "write-user-stories v4 (deleted)"
  and never links to a new skill with the same slug.
- **Undo.** Only a permanent delete (for example "Delete now" on the Trash page) shows a toast
  with Undo. A move to Trash and Deprecate show no Undo, because the owner can reverse them.
  This replaces the 10-second Undo toast of D47.
Example: The owner deprecates "Write user stories" and later deletes it while QA still uses it.
The dialog lists QA, BA and Designer. After Delete, no bot has the skill, and the toast says
"Write user stories is in Trash." Two weeks later, the owner restores it. The app offers to
assign it again to BA and QA; Designer is in Trash, so it is not in the list. If the owner
does not restore it, the app deletes it after 30 days, and the slug `write-user-stories` is
free again.
Not chosen:
- **No delete, deprecate only** (the old rule). Deprecated skills pile up in the list, and the
  owner has no way to remove a skill made by mistake.
- **Delete at once, with no Trash.** A mistake cannot be undone, and projects already use Trash
  (D47).
- **Delete only when no bot uses the skill.** The owner must first visit every bot. The dialog
  shows the bots instead.
- **The slug stays taken forever.** Old chats do not need it, because they keep their own copy.
Consequences: AGENTS.md rule 5 changes to "Skill versions are never updated or deleted,
except by the Trash purge (D49)." `domain-model.md`: `skills.trashed_at`, a Trash record with the bot
list, `run_skills` keeps `skill_slug` and `version`, the slug is unique only among skills that
are not purged, invariant 2 changes, and the setting `trash_days`. `api.md`: trash and restore
endpoints for skills. D47's Undo toast goes away. A migration is needed (M1 for skills; M5b
for the Trash page). Tests: delete removes every pin in one transaction; a purged skill frees
its slug; an old run shows the deleted slug and version; a restore never assigns to a bot in
Trash; Trash and Deprecate return no Undo.
Why: The owner wants to remove skills for good, but a mistake must be easy to fix for a
while. Old chats must still make sense after the delete.
Implemented in: `../design/components/skills-page.md` §11, `../design/components/buttons.md` §6, `../domain-model.md` §3.4, M1 and M5b.
