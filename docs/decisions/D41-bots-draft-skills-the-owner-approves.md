# D41. Bots draft skills; the owner approves and is the author

Status: accepted (2026-10-22, owner)

Decision: When the owner asks, a bot may draft a new skill, or a new version of an existing
skill, for itself or for another bot in the conversation. The draft is a proposal, never a
skill. The owner reviews it on a card in the chat, can edit it, and approves or rejects it.
Approving creates the skill version with the owner as author (D14) and, in one click, pins it
to the target bot.

The owner's answers (2026-10-22):

1. **New skills and edits.** A bot may draft a new skill or a new version of an existing one.
   An edit is shown as a diff against the version it was drafted from. Upgrading other bots
   stays the separate "Also upgrade these bots" offer (D6).
2. **For other bots.** A bot may draft for any active member of the conversation, itself
   included, for example BA writing a skill for Designer.
3. **Only when asked.** A bot drafts only when the owner asks for it. It may offer in one line
   ("Want me to save this as a skill?") but does not draft until the owner says yes.
4. **One click.** Approve creates the version and pins it to the target bot, with "Pin to
   <bot>" ticked by default and always-load off (D16).
5. **Text only.** A draft is name, description, body and changelog, within the usual skill
   limits (body 50 KB, description 300 characters). No files, no scripts, no tool
   permissions: a skill can never widen what a bot may do.

The flow:

1. The owner asks: "make this a skill for yourself".
2. The bot calls `propose_skill`. The call is a run step (D26). Nothing is written to skills.
   The text passes the sensitive-data guard (D39) or the call fails, with no override.
3. A card appears in the chat: the full text, or a diff for an edit; the target bot; "Pin to
   <bot>" (ticked); always-load (off); the message that asked for it. Buttons: Edit, Approve,
   Reject.
4. Approve, in one transaction: create the skill (v1) or version N+1, pin it to the target bot
   if ticked, mark the draft approved, write the events. If the skill gained a version since
   the draft was made, the draft is `stale` and the card offers to ask the bot to redraft.
5. From the next run, the bot uses the pinned version, and provenance chips show it (D15).

Why: Bots are good at turning a conversation into a reusable playbook, and the owner wants
that without losing control. A skill reaches the prompt of every run that loads it, so it is
a stronger persistence channel than memory: text injected from an untrusted file could live
on in a skill. Saving only through an owner-approved, owner-authored version keeps D6's promise
that a bot's behaviour changes only when the owner decides, and keeps D14 ownership clear.
Memory and skills stay distinct: memory holds facts and preferences (D38), skills hold
procedures.

Rejected:

- **Bots save skills directly, with Undo, as memory does.** Too strong for text that shapes
  every run; also breaks D6 (behaviour changing without a decision).
- **The bot as author.** Breaks D14: authors create versions without review.
- **Bots drafting on their own initiative.** Clutters the chat with cards; one-line offers
  cover the useful case.
- **Skills with attached files or tool grants.** Widens the security surface for little gain.

Consequences:

- New table `skill_drafts`, TypeID prefix `skilld` (D36); `skill_versions` records the draft it
  came from.
- New tool `propose_skill`, offered only in runs triggered by the owner's message.
- New card kind, events and endpoints.
- Delivered as slice M5c, after M4 (drafting for other members needs multi-bot chats).

Implemented in: `../domain-model.md` §3.9, `../conversation-rules.md` §7,
`../requirements/skill-hub.md` SK-5 (UI-7.9 to UI-7.15), `../api.md` §2a,
`../realtime-events.md` §4, `../security.md` §2.5.
