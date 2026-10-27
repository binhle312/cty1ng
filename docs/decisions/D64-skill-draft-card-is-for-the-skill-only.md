# D64. The skill draft card is for the skill only; bot actions follow on a float card

Status: accepted (2026-10-27, owner, PR #38 review 04:28). From the M5c UI design review, round 16: the owner asked to
separate the skill from the bot actions (03:22), chose the bot page layout for the Skills page
(03:36) and approved the boards and the six open items (03:53).
Amends: D41
Amended 2026-10-27 (owner): D65 removes the target bot. Where this file says "target bot", read
"drafting bot" (new skill, ticked) or "every bot" (new version: bots on an older version ticked,
bots without the skill not ticked).

Decision:

- **The card shows the skill only.** The skill draft card in the conversation shows the head
  "Skill draft · New skill · For BA" (or "New version · For BA"), the name and slug, the
  description, the body (or the diff for a new version), What changed, and the owner's message
  that asked. It has no "Pin to <bot>" and no "Always load". Buttons: **Reject**, **Edit**,
  **Approve**. The card is a preview: the owner does not type on it.
- **Approve saves the skill, nothing more.** Approve creates the skill (v1) or the new version,
  with the owner as author (D14). It does not pin it. This replaces D41 rule 4 ("one click":
  Approve pins to the target bot) and step 4 of the D41 flow.
- **Then a float card asks about the bots.** After Approve, a float card opens in the centre of
  the screen, with the same bot list as the Skills page (`skills-page.md` §7):
  - New skill: "Created ✨ Add {slug} to bots?". The target bot is ticked, with an Always load
    switch (off) on its row. The other bots are not ticked. **Skip** / **Assign**.
  - New version: "Saved v{N} ✨ Also upgrade these bots to v{N}?". Every bot on an older version
    is ticked, the target bot included. Always load stays as it is for each bot. **Skip** /
    **Upgrade**. This settles the conflict between `conversation-rules.md` §7 (unticked) and
    `skills-page.md` §7.1 (ticked): the boxes start ticked.
  - A click outside the card, or Esc, is Skip. Skip leaves the skill saved and unused.
  - A target bot in Trash (D50) is not in the list.
- **Edit uses the same path.** Edit on the card opens the draft on the Skills page (Skill tab
  only, D41 rule 7 stays). **Approve as v{N}** there saves the version, goes back to the
  conversation and opens the same float card. This replaces "with the card's pin and
  always-load choices" in D41 rule 7.
- **Slug already taken.** A new-skill draft whose slug is taken does not block Approve. The app
  picks the next free slug (`write-login-stories-2`, `-3`, …), and the card says so before
  Approve. To pick another slug, the owner uses Edit.
- **Out of date at once.** When a skill gets a new version or is deprecated, the app marks its
  pending edit drafts `stale` in the same transaction, with an event, so the card shows "Out of
  date" and **Ask <bot> to redraft** before the owner presses Approve. Approve on a stale draft
  still returns 409 as a guard.
- **A new version keeps Always load.** Upgrading a bot to the new version keeps that bot's
  Always load value.

Example: BA drafts `write-login-stories` for BA. The owner reads the card and presses
**Approve**. The card folds: "Skill draft · Approved · 11:24 · write-login-stories v1". The
float card "Created ✨ Add write-login-stories to bots?" shows BA ticked, Designer and QA not
ticked. The owner presses **Assign**. BA's next reply shows `write-login-stories v1` in its
provenance chips (D15).

Why: The owner wants one card for one decision: is this skill text good? Which bots use the
skill is a second decision, and the Skills page already has a card for it (§7). One card for
both made the draft card long and mixed two kinds of choice. A float card after Approve reuses
an agreed pattern, and works the same from the card and from the editor.

Rejected:

- **Pin and Always load switches on the card (D41 as written).** Two decisions in one card;
  the editor path needed the card's choices to be carried over.
- **No Edit; the owner asks the bot for changes, as on the plan card.** The owner chose the
  original D41 Edit flow (2026-10-27 03:17).
- **409 `slug_taken` and a slug field on the card.** The card would need an input, and a
  preview card is simpler. Edit covers the owner who wants another slug.
- **Mark a draft stale only when the owner presses Approve.** The owner learns too late, after
  reading the whole draft.

Consequences: `POST /skill-drafts/{id}/decision` drops `pin` and `always_load`, and loses the
409 `slug_taken` for a slug that the bot proposed. Creating a skill version or deprecating a
skill marks the pending edit drafts of that skill `stale` and emits `skill_draft.decided`. The
float card sends one call, `POST /skills/{id}/bots`, that assigns or upgrades the ticked bots in
one transaction (`../api.md` §2). The Skills page moves to the bot
page layout (Skill, Bots and History tabs), which changes `skills-page.md` (round 8).

Implemented in: `../design/components/skill-draft-card.md`, `../design/components/skills-page.md`,
`../requirements/skill-hub.md` UI-7.9 to UI-7.15, `../conversation-rules.md` §7,
`../domain-model.md` §3.9, `../api.md` §2a, `../realtime-events.md`, task M5c.
