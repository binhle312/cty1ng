# D65. Bots draft skills only when the owner asks; only the owner assigns them

Status: accepted (2026-10-27, owner, round 16 thread 04:41 to 04:43, 08:59 and 09:07). From the
M5c UI design review: the owner asked to keep skill drafting simple and to leave bot-to-bot work
for the coordinator.
Amends: D41, D64

Decision:

| Situation | Allowed |
| --- | --- |
| A bot drafts a new skill when the owner asks | Yes |
| A bot drafts a new version of a skill assigned to it, when the owner asks | Yes |
| A bot drafts a new version of a skill not assigned to it, when the owner asks | Yes |
| A bot changes a skill on its own (no ask, not in an approved plan) | No |
| A bot assigns or upgrades skills for any bot | No |
| The owner approves the draft, then assigns or upgrades bots | Yes |

- **No target bot.** A skill draft names only the bot that drafts it. This replaces D41 rule 2
  ("for other bots"): the draft is never "for" a bot. `propose_skill` has no `target` argument,
  and `skill_drafts` has no `target_bot_id` column. Which bots use the skill is the owner's
  choice after Approve.
- **The owner's ask is the plan.** A bot drafts only in an action run whose approved plan lists
  the draft (D41, D48). For a new version of a skill that is not assigned to the drafting bot,
  the plan card line says so: "`design-review` · New version · Not assigned to BA · Needs your
  final review". The owner's plan approval is the explicit ask.
- **Read access to the skill that it edits, nothing more.** `load_skill` stays as it is: it
  returns the version pinned to the bot, and only for skills assigned to it. A new version must
  start from the **latest** version, which can be newer than the bot's pin or not assigned at
  all. So the action run gets one more read-only tool, `read_skill_base(skill)`:
  - It is offered only in a run where `propose_skill` is offered.
  - It works only for a skill that the approved plan lists as a new version. Any other skill
    returns the tool error `draft_not_in_plan`, as for `propose_skill`.
  - It returns the latest version's description, body and version number.
  - It writes no pin and no `run_skills` row, so the reply's skill chips (D15) stay true.
- **The draft names the version it read.** For a new version, `propose_skill` must pass
  `base_version`, the version that `read_skill_base` returned. The server refuses the call with
  the tool error `skill_changed` ("design-review is now v4. Read it again.") when it is not the
  latest version, and with `skill_not_read` when the run has no `read_skill_base` step for that
  skill and version. So a draft never starts from text older than the latest version, and a
  number that the bot did not read is refused (PR #38 review, owner 10:09).
- **The owner assigns to any bot.** After Approve, the float card (D64) lists every bot that is
  not in Trash. The owner may tick any of them.
  - New skill: the drafting bot starts ticked, because the owner asked that bot. The owner may
    untick it. Text: "BA is ticked, because BA drafted it. Untick BA if you do not want it." If
    the drafting bot is in Trash (D50), no bot starts ticked and **Skip** is the default.
  - New version: two groups. **Uses an older version**: those bots start ticked, with their
    version pill, as in D64. **Does not have it**: every other bot not in Trash, not ticked,
    with an Always load switch (off) when ticked. So the owner can give v3 to BA even when only
    Designer had the skill. The float card opens while at least one bot can take the version.
- **The card names no target.** The card head is "Skill draft · New skill" (or "New version").
  The editor line is "BA drafted this skill in {conversation}".
- **Later.** A coordinator may ask a bot to draft a skill. The same plan, draft card, Approve and
  float card then still apply. That needs its own decision.

Example: Designer uses `design-review` v2; BA does not have it. The owner says "@BA add a check
for error texts to design-review." BA's plan lists "`design-review` · New version · Not
assigned to BA". The owner approves. BA calls `read_skill_base("design-review")` and gets v2,
then calls `propose_skill(skill="design-review", …)`. The owner approves the draft. The float
card "Saved v3 ✨ Also upgrade these bots to v3?" shows Designer ticked. BA is not in the list,
because BA does not have the skill.

Why: The owner wants a simple M5c. A draft "for" another bot adds a second bot to every rule
(who is a member, who is in Trash) for a case that the float card already covers: the owner can
give any skill to any bot after Approve. The owner may also want one bot to improve a skill
that another bot uses; the plan approval makes that an explicit owner choice, not bot-to-bot
work. Bot-to-bot work (a bot that asks another bot to change a skill) waits for the
coordinator.

Rejected:

- **Keep the target bot (D41 rule 2).** More rules and states (target in Trash, target not a
  member) for no gain over the float card.
- **Restrict the float card to the drafting bot.** It blocks normal reuse: the owner must be
  able to give a good skill to every bot that needs it.
- **Let `load_skill` read any skill in a drafting run.** It gives access to every skill, and it
  writes `run_skills` rows, so the chips would show a skill that the bot did not use.

Consequences: `propose_skill(name, description, body_md, slug?, skill?, base_version?,
changelog?)`, `base_version` required with `skill`. New tool `read_skill_base(skill)`, recorded
as a run step. New tool errors `skill_changed` and `skill_not_read`. `skill_drafts` loses `target_bot_id` (schema design only; no code
exists). The plan check matches a call by `slug` or `skill` only. The board "target bot in
Trash" is removed. M5c no longer needs conversations with several bots, so it depends on M3,
not M4.

Implemented in: `../design/components/skill-draft-card.md`, `../design/components/plan-card.md`,
`../design/components/skills-page.md` §7.3, §17, `../requirements/skill-hub.md` UI-7.9 to
UI-7.15, `../conversation-rules.md` §7, `../domain-model.md` §3.6, §3.9,
`../development-plan.md`.
