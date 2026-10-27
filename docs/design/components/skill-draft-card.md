# Skill draft card

> **Status: agreed in the M5c UI design review (2026-10-27)**, canvas round 16, boards K1–K7,
> K9, K10 (K8 removed by D65), E1–E7 and S1–S3. Previews: `../previews/command-dark/skill-draft-card.*` (K1–K7, K9, K10),
> `skill-draft-edit.*` (E1–E5, E7) and `skills-page-tabs.*` (S1–S3), each a `.png` and a
> `.html`. Follows D41, D64 and D65, with D6, D14, D15, D16, D39, D48, D50 and D51. Card
> parts, buttons and the fold come from `conversation-cards.md` §3 and `buttons.md`. The labels
> and messages use Simplified Technical English.

A bot shows this card when it drafts a skill in an action run that the owner approved (D48,
`conversation-rules.md` §7). The card is about **the skill only**: is the text good? Which bots
use the skill is a second question, on a float card after Approve (§4, D64).

## 1. The card (K1, K2)

The card sits inside the bot's reply, under a line such as "I wrote the skill as a draft. The
app saves nothing until you approve it." Top to bottom:

1. **Head:** "**Skill draft** · New skill" (or "New version"), then the pill **Waiting
   for you** (`primary-tint`).
2. **Name** (weight 600) and the slug (mono 12 px, `on-surface-muted`).
3. **Description**, as text.
4. **Body** for a new skill: the Markdown preview (raw HTML off, `security.md`) in a box
   (`outline` border, `surface` fill). It shows the first 8 lines, then "{n} more lines · Show".
   **Changes** for a new version (K2): the diff from the version it was drafted from ("v3 →
   draft"), in the History colours (added `success`, removed `danger` with a strike), unchanged
   lines folded as "{n} lines with no change · Show". "Description: no change" when only the
   body changed.
5. **What changed:** the changelog line. For a new skill, for example "First version. Made from
   the sign-in stories in this conversation."
6. "Asked in your message at 11:20: {the message}", in `on-surface-muted`, with the message as a
   link that scrolls to it.
7. **Buttons** (30 px, `conversation-cards.md` §3): **× Reject**, **✎ Edit**, **✓ Approve**
   (primary, far right).

The card has no pin and no Always load choice (D64). The owner does not type on the card: to
change the text or the slug, the owner uses **Edit** (§3).

## 2. Decisions and the folded line (K3, K5)

After a decision the card folds (`conversation-cards.md` §3):

| Decision | Folded line |
| --- | --- |
| Approve | "**Skill draft** [Approved] 11:24 · write-login-stories v1 · Show", the skill and version as a link to the Skills page |
| Approve from the editor | "… · write-login-stories v1 · edited by you · Show" |
| Reject | "**Skill draft** [Rejected] 11:24 · Nothing changed · Show". A rejected draft is a bad signal for Improve (D51, M5d) |

From the next run, the bots that use the skill show it in their provenance chips (D15, K3b).

## 3. Edit (E1–E5)

**Edit** opens the draft on the Skills page (`skills-page.md` §17):

- The list has the item with the pill "not saved" (new skill) or the skill selected (new
  version).
- The page top says "New skill. You are the author when you approve it." and, with the bot
  avatar, "BA drafted this skill for BA in {conversation}. Approve saves v1. Cancel goes back to
  the conversation and changes nothing." The conversation is a link.
- Only the **Skill** tab works. **Bots** and **History** are at 40 % with the tooltip "Approve
  the draft first." (B5).
- The fields are the normal editor (`skills-page.md` §2, §4). The changelog box holds the
  bot's What changed line.
- The save bar: "No changes to the draft." or "{n} changes not saved", then **Cancel** and
  **✓ Approve as v{N}** (primary).
- Approve runs the same checks as a save: the limits and the secret guard (E3, D39), with the
  errors of `skills-page.md` §6. Nothing is saved while an error shows.
- After Approve the app goes back to the conversation. The card folds with "edited by you", and
  the float card opens (§4, E4).
- If the skill gets a new version while the owner edits a new-version draft (E5), **Approve as
  v{N}** turns off and the save bar says, in `danger`: "write-user-stories got v4 at 11:40,
  after BA made this draft. An approve now would remove that change. Ask BA to redraft."

## 4. Float card after Approve (K3, K4, E4)

A float card opens in the centre of the screen, over the conversation. It uses the bot list of
`skills-page.md` §7: one row per bot with a check box, the avatar and the name; a ticked row has
a `primary` border. **Skip**, Esc or a click outside closes it; the skill stays saved.

| Draft | Title and text | Rows | Buttons |
| --- | --- | --- | --- |
| New skill (K3) | "Created ✨ Add write-login-stories to bots?" "Tick the bots that must use this skill. They get v1. BA is ticked, because BA drafted it. Untick BA if you do not want it." | The drafting bot ticked, with an **Always load** switch (off) on its row; the other bots not ticked. The owner may tick any bot (D65) | **Skip**, **Assign** (primary, default; 40 % with no box ticked) |
| New version (K4) | "Saved v4 ✨ Also upgrade these bots to v4?" "These bots use an older version. They keep it until you upgrade them. Tick the bots to move to v4. Always load stays as it is for each bot." | Every bot on an older version, ticked, with its version pill | **Skip**, **Upgrade** (primary, default) |

Assign and Upgrade send one call for all ticked bots (`api.md` §2, `POST /skills/{id}/bots`).
A bot in Trash (D50) is not in the list. A new version with no bot on an older version opens no
float card; the folded line is enough.

## 5. Other states

| State | Board | What shows |
| --- | --- | --- |
| Out of date | K6 | The pill **Out of date** (`danger` tint). The line, in `danger`: "Not approved. write-user-stories got v4 at 11:40, after BA made this draft from v3. An approve now would remove that change." One button: **Ask BA to redraft** (primary), which fills the composer with "@BA make the draft of write-user-stories again, from v4." The app marks the draft at once when the skill gets a version or is deprecated (D64) |
| Slug taken | K7 | Under the slug: "write-login-stories is taken, so the app uses write-login-stories-2. To pick another slug, use Edit." The slug line shows `write-login-stories-2`. Approve works |
| Two drafts in one run | K9 | One card per draft, each with its own decision. A decided card folds; the others stay open |
| From Improve (M5d) | K10 | The same card in the owner's 1:1 conversation with the bot, with the signals, the length change and **Test on past tasks** (D51). Tagged M5d (P8) |

## 6. Where else a waiting draft shows

- **Skills page:** the page top of the skill has the `primary` link "Draft v4 from BA waits for you ·
  in Sign-in screens", which opens the card (S1).
- **Bot page, Skills tab:** the row of the skill shows "Draft v4 waiting" in place of "v5
  available", as a `primary` link to the card (E7, `bot-page.md` §7).
- **History tab:** a version that came from a draft says "You · drafted by BA", with BA as a link
  to the card (S3, UI-7.14).
