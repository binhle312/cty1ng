# UI rules

> **Status: proposed (round 12, owner approved the idea 2026-10-25 12:54).** One list of every UI
> rule that the owner agreed in the design rounds. Read it before you draw a design board or
> write or change a UI spec. Each rule has one line and a link to the file that owns it. If this
> list and the owning file disagree, the owning file wins: report the difference.

## How to use this list

1. Read this file before a design board, a UI spec or UI code.
2. Draw boards only with the agreed parts in `chat-app-milestone/reviews/board-kit/ui_parts.py`
   (project files). Do not draw a new button, row, toast or slot. A part that does not exist yet
   is new: mark it "New, not agreed".
3. Run `check_board.py` on every board before you post it. It must show 0 errors.
4. Then check the rules marked **manual** by eye. A script cannot check them.
5. A new rule from the owner goes into this file in the same PR as the spec it changes.

## Rules

Auto = `check_board.py` finds a break. Manual = check by eye.

### Words

| # | Rule | Check | Source |
| --- | --- | --- | --- |
| W1 | The UI says "conversation", never "chat" | auto | AGENTS.md §10, owner 2026-10-23 |
| W2 | A label does not repeat the page subject: "← Back", "Delete", "+ Create" | manual | Round 9, `create-bot-page.md` |
| W3 | A button label is a verb in sentence case, and never ends in "…" | auto ("…"), manual (verb) | `components/buttons.md` §4 |
| W4 | A label with a count says the count: "Apply 4 changes" | manual | `components/buttons.md` §4 |
| W5 | Fold links say only "Show" and "Hide". The folded line keeps its facts | auto | `components/conversation-cards.md` §3 |
| W6 | A folded line does not repeat a word after a status pill | manual | Round 10 (owner 2026-10-24 17:01) |
| W7 | Popover and crop buttons say just "Use" | manual | Round 9 |
| W8 | Text uses Simplified Technical English | manual | `docs/workflow.md` |
| W9 | Every setting says what the owner notices when it changes, not only its range | manual | Owner 2026-10-26, `components/settings-page.md` §3.1 |

### Buttons and boxes

| # | Rule | Check | Source |
| --- | --- | --- | --- |
| B1 | Four kinds only: primary, secondary, danger, danger fill. Danger fill only in the last step of a delete | manual | `components/buttons.md` §1 |
| B2 | Two heights: 36 px (pages, dialogs, save bars), 30 px (headers, cards, lists, banners) | auto | `components/buttons.md` §2 |
| B3 | The primary button is last, at the far right. At most one primary in an area | manual | `components/buttons.md` §3 |
| B4 | A dialog that removes something has Cancel as the default | manual | `components/buttons.md` §3 |
| B5 | Disabled = 40 % opacity, with a tooltip that says why | manual | `components/buttons.md` §1 |
| B6 | A ticked box is amber with a ✓ | manual | `components/buttons.md` §5 |
| B7 | A toast has Undo only after a permanent delete. A move to Trash has no Undo | manual | `components/buttons.md` §6 |

### Colour and status

| # | Rule | Check | Source |
| --- | --- | --- | --- |
| C1 | Amber (`primary`) means "you must act". Only "Waiting for you" uses it (place marker exception: the amber "New" divider) | manual | `components/bot-status.md` |
| C2 | Red (`danger`) means a problem: failed, paused at the cap, cannot run | manual | `components/bot-status.md` |
| C3 | Running = normal text and a spinner in the bot colour. Idle and queued are grey | manual | `components/bot-status.md` |
| C4 | No amber fill for a drag state, except the active dashed slot | manual | Round 9 |
| C5 | A spec names semantic tokens, never a hex colour | manual | `components/README.md` |

### Parts and layout

| # | Rule | Check | Source |
| --- | --- | --- | --- |
| P1 | A dashed border is only for an empty place that the owner fills by a click or a drop | auto | `components/dashed-slot.md` |
| P2 | Reuse an agreed part. Do not draw a second version of a row, card, menu or toast | manual | Owner 2026-10-25 12:46 |
| P3 | Boards use the real avatar art and all agreed shell parts. No placeholders | auto (words), manual | Owner 2026-10-24 10:32 |
| P4 | No section heading when the fields have labels | manual | Round 9 |
| P5 | No legend when the badges already explain | manual | Round 9 |
| P6 | One pin glyph and its four states. A pin badge is never on a bot avatar | manual | `components/pin.md` |
| P7 | Standard parts live in `components/`, one file each | manual | Owner 2026-10-23 |
| P8 | A board shows the whole screen as the spec defines it, also parts from later slices. Draw each later part for real, with a small tag that names its slice ("M5"). Never leave a part out or hide it in a note | manual | Owner 2026-10-25 13:32 |
| P9 | One control for one job: every number is the number box with its unit, every on/off is the switch, a named choice is the segmented control. A dropdown only for a long list | manual | Owner 2026-10-26, `components/settings-page.md` §3.2 |

### Time

| # | Rule | Check | Source |
| --- | --- | --- | --- |
| T1 | Under 1 minute "Just now". Under 1 day "x ago" ("5 min ago", "3 h ago"). Otherwise local ISO time ("2026-10-20 16:40") | auto | `components/time-format.md` §1 |
| T2 | The conversation and its cards use local clock time, full date in a tooltip | manual | `components/time-format.md` §1 |
| T3 | 24-hour clock, two digits: "09:05", "09:05:07". Never "9:05" or "5:40 PM" | auto (AM/PM) | `components/time-format.md` §1 |
| T4 | Every time range uses the D25 picker. The bucket follows the range | manual | `../requirements/time-range-picker.md` |
| T5 | One sort icon. A click sorts, a second click flips | manual | `components/time-format.md` §2 |

### Values

| # | Rule | Check | Source |
| --- | --- | --- | --- |
| V1 | A limit, threshold or default that the owner may change is a setting with a default, never fixed | manual | AGENTS.md §10 |

### Legibility

Canvas notes on a board (card titles, captions, slice tags) are not app text; these rules do not
cover them.

| # | Rule | Check | Source |
| --- | --- | --- | --- |
| L1 | App text is 11 px or more, except text inside a badge or the battery (L2). Body text stays `text-base` | manual | Owner 2026-10-30, shell review |
| L2 | Text inside a badge (16 px) or the budget battery is 10 px or more, at weight 600 or more. The battery percent is 10.5 px | manual | Owner 2026-10-30, `components/user-panel.md` §3 |
| L3 | Text contrast is 4.5:1 or more against what is behind it, both tones of the battery included. Check it in the built app at 100% and 200% browser zoom. A disabled item (B5) is exempt, as in WCAG 1.4.3; its tooltip says why it is off | manual | Owner 2026-10-30, shell review |

## Open conflicts

| Conflict | Where | Status |
| --- | --- | --- |
| Agreed round 10 parts use 28 px buttons (Flow in the conversation header, Retry under a failed reply). B2 allows 30 or 36. The check gives a warning, not an error | `conversation-page.md`, `buttons.md` §2 | For the standardisation thread |
| The Bots page sort buttons are 24 px icon buttons (`bots-page.md` §5). B2 allows 30 or 36. Built at 24 px in M2b; the owner keeps them for now and reviews the UI at M3 (owner, 2026-11-02) | `bots-page.md` §5, `buttons.md` §2 | Owner review at M3 |
| "Delete project" on the Project settings page breaks W2 | `project-settings-page.md`, `buttons.md` §1 | For the standardisation thread |
| Previews made before L1 and L2 still draw some app text under 11 px (badges at 9 px, meta lines at 10.5 px). The shell previews (`user-panel`, `left-bar-rail`, `left-bar`, `top-header`) are fixed; the others keep it until they are next regenerated. The rules win | `previews/command-dark/` | Fix each preview when its slice regenerates it |
