# D65. A bot drafts skills only for itself; the owner assigns them to any bot

Status: accepted (2026-10-27, owner, round 16 thread 04:41, 04:42 and 04:43). From the M5c
UI design review: the owner asked to keep skill drafting simple and to leave bot-to-bot work
for the coordinator.
Amends: D41, D64

Decision:

- **No target bot.** A skill draft has no target bot. The bot that drafts it is the only bot
  named on it. This removes D41 rule 2 ("for other bots"): a bot never drafts a skill for
  another bot. `propose_skill` has no `target` argument, and `skill_drafts` has no
  `target_bot_id` column.
- **New versions only of the bot's own skills.** A bot may draft a new version only of a skill
  that it uses now (`bot_skills` has a row for the bot and the skill). A call for another skill
  returns the tool error `skill_not_used`. A new skill has no such limit.
- **The owner assigns to any bot.** After Approve, the float card (D64) lists every bot that is
  not in Trash. The owner may tick any of them: the drafting bot, other bots, or both. This is
  the owner's reuse of a skill, not bot-to-bot work.
  - New skill: the drafting bot starts ticked, because the owner asked that bot. The owner may
    untick it. Text: "BA is ticked, because BA drafted it. Untick BA if you do not want it."
  - New version: every bot on an older version starts ticked, as in D64.
  - If the drafting bot is in Trash (D50), no bot starts ticked and **Skip** is the default.
- **The card and the plan card name no target.** The card head is "Skill draft · New skill"
  (or "New version"). The plan card's Skill drafts line is "`write-login-stories` · New skill ·
  Needs your final review". The editor line is "BA drafted this skill in {conversation}".
- **Later.** A coordinator may ask another bot to draft a skill. The same draft card, Approve
  and float card then still apply. That needs its own decision.

Example: The owner says "@BA make the way you wrote these stories a skill." BA drafts
`write-login-stories`. The owner approves. The float card shows BA ticked. The owner also ticks
Designer and presses **Assign**. Both bots use v1 from their next run.

Why: The owner wants a simple M5c. A draft for another bot adds a second bot to every rule
(who is a member, who is in Trash, who may be named) for a case that the float card already
covers: the owner can give any skill to any bot after Approve. A bot that rewrites another
bot's skill is bot-to-bot work, which waits for the coordinator.

Rejected:

- **Keep the target bot (D41 rule 2).** More rules and states (target in Trash, target not a
  member) for no gain over the float card.
- **Restrict the float card to the drafting bot.** It blocks normal reuse: the owner must be
  able to give a good skill to every bot that needs it.
- **Let a bot draft a new version of any skill.** It is bot-to-bot editing by another name.

Consequences: `propose_skill(name, description, body_md, slug?, skill?, changelog?)`.
`skill_drafts` loses `target_bot_id` (schema design only; no code exists). The plan check
matches a call by `slug` or `skill` only. The board "target bot in Trash" (K8) is removed. M5c
no longer needs conversations with several bots, so it depends on M3, not M4.

Implemented in: `../design/components/skill-draft-card.md`, `../design/components/plan-card.md`,
`../design/components/skills-page.md` §7.3, §17, `../requirements/skill-hub.md` UI-7.9 to
UI-7.15, `../conversation-rules.md` §7, `../domain-model.md` §3.9, `../development-plan.md`.
