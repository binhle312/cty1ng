# D50. Deleted bots go to Trash and can be restored

Status: accepted (2026-10-24, owner). From the M2 Bots UI design review, round 9: the owner
approved **Delete** in the bot ⋯ menu as a move to Trash ("Skills and Projects already say Delete
for the same action") and then these rules. It amends D12.
Amends: D12

Decision:

- **Delete a bot.** Delete moves the bot to Trash (`bots.deleted_at`). The bot leaves the header,
  the Bots page and every conversation member list. It cannot be added to a conversation. Its
  queued runs are cancelled; a running run is stopped first. Its messages stay, with the name and
  avatar in grey (D12). It is unpinned.
- **Trash days.** Trash keeps the bot for `trash_days` (D49, default 30), the same setting as
  projects and skills. Then the app purges it (`bots.purged_at`): persona, pins, tool settings
  and bot memory are deleted. The row stays as a small record (name, slug, avatar style, colour,
  avatar file) so old messages still show who wrote them.
- **Name and slug.** While the bot is in Trash, its name stays taken, so a restore always works.
  After the purge, a new bot can use the name. The slug is never reused (D19), because old
  messages and run records refer to it.
- **Restore.** A restore brings back the bot with its persona, pins, tool settings and bot memory,
  not pinned. The app then suggests to add it again to the conversations it was in that are not in
  Trash, as one list with check boxes; nothing is added without the owner's click.
- **Undo.** None for the move to Trash (D49 Undo rule). A permanent delete from the Trash page has
  the Undo toast.
- The "Show deleted" filter on the Bots page is dropped; Trash is the one place for deleted items.

Example: The owner deletes Writer. Writer's replies in "Login flow" stay, in grey. The name
"Writer" stays taken. Ten days later the owner restores Writer from Trash; the app offers to add it
again to "Login flow" and "Help pages". If the owner does not restore it, the app purges it after
30 days and "Writer" is free for a new bot.

Why: Projects (D47) and skills (D49) already go to Trash. One rule for every delete is easier to
learn, and a bot holds work (persona, pins, memory) that is slow to rebuild after a mistake.

Rejected:

- **Soft delete with no restore (D12 as it is).** A mistake cannot be undone, and deleted bots pile
  up behind a "Show deleted" filter.
- **Hard delete.** Old messages lose their author.
- **Restore puts the bot back in every conversation at once.** It can start replies in
  conversations that moved on; the owner picks instead.

Consequences: `domain-model.md` §2 adds `bots.purged_at` and makes the name unique among bots
that are not purged. `api.md` needs trash and restore endpoints for bots (with the Trash page
round, M5b). A migration is needed. The Trash page design (M5b) shows bots.

Implemented in: `../domain-model.md` §2, `../requirements/bots.md` UI-4.3,
`../design/components/bots-page.md` §3.
