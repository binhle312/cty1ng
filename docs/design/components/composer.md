# Composer

> **Status: agreed in the M3 UI design review, round 10 (2026-10-24)**, step 4 (M1–M5, M4b) and
> step 3 (P1, the Stop button). Previews: `../previews/command-dark/composer.*` and
> `conversation-stop.*` (card P1). Labels use Simplified Technical English.

The composer is the message box at the bottom of the conversation page. It sits in the same
760 px column as the messages (`conversation-page.md` §1). Requirements: UI-3.11 to UI-3.14,
UI-3.20 to UI-3.23.

## 1. The box

| Part | Rule |
| --- | --- |
| Box | At least 44 px high, grows with the text. Radius 10 px, 1 px `outline-strong` border, `surface-raised` fill. 16 px from the column sides, 12 px from the bottom |
| Left | The paperclip button (attach), `on-surface-muted` |
| Text | Markdown. Placeholder "Message the team. Type @ to mention a bot." in `on-surface-muted` |
| Send | A 32 px square button, radius 8 px, `primary` fill, an **up arrow** icon in `on-primary`. Off (40 %) while the box is empty |
| Line under the box | 11 px, `on-surface-muted`. By default: "Enter sends · Shift+Enter adds a line". Other lines (§3) take its place |

Keys: Enter sends. Shift+Enter or Alt+Enter adds a line. The same keys work in every message
and note box (plan-card.md §3).

Send stays on while a bot works: a new message waits in the queue (D11).

## 2. States

| State | Look |
| --- | --- |
| **No bots** (M1) | The placeholder is "Add a bot to start". Send is off (40 %). The composer has no Add bot button: the add slot in the header (or a drag) adds a bot (`conversation-page.md` §2) |
| **No mention** (M2) | In a conversation with 2 or more bots, when the text has no @mention, the line under the box shows an info icon and "No bot is mentioned, so nobody will reply. Type @ to mention a bot." It is `on-surface-muted`, not `primary` (`primary` is for "Waiting for you"). Send stays on: a note to the owner's self is allowed |
| **@ autocomplete** (M3) | Typing @ opens a list above the box, 330 px wide, `surface-raised` fill, `outline-strong` border. It lists only members of this conversation. Each row (40 px): avatar, name, and model · effort in `on-surface-muted`. A pending member is at 45 % with "waiting for your choice" and cannot be picked. Up and Down move, Enter or Tab picks, Esc closes. A pick inserts the mention token |
| **Attachments** (M4) | Files show as chips (28 px) above the text: file icon, name, size in `on-surface-muted`, and ×. A rejected file stays as a chip with a `danger` border and text that says why: "Type not allowed", "Over 10 MB", "11th file". When an image or PDF is attached, the line under the box says "Images and PDFs are not checked for secrets." |
| **Files over the box** (M4b) | While files are dragged over the composer, the box becomes a dashed slot in the active state (`dashed-slot.md`): dashed `primary` border, `primary-tint` fill, `primary` text, an upload icon and "Drop files to attach · up to 10 files, 10 MB each" |
| **Possible secrets** (M5) | After Send, if the check finds likely secrets (D39), a panel shows above the box: `danger` border, a `danger` tint, a shield icon and "Your message may contain secrets" in `danger`, then "Bots and the model provider would see them. Remove them, or send anyway." Each match is a row with the masked text in mono ("API key ending …9f2a") and **Remove** (secondary), which takes it out of the text. **Send anyway** (danger) is at the bottom right. The panel has no primary button, so the safe path is the easy one. The message is not sent until every match is removed or the owner clicks Send anyway |

The file limits in the texts (10 files, 10 MB) come from the settings in `../../security.md`; the
text shows the values that are set.

## 3. Lines under the box

Only one line shows. When there are more, the first one in this list wins (approved in the thread review
of PR #26, 2026-10-25 02:14; preview `../previews/command-dark/composer-lines.*`):

1. No connection: "No connection to the app server. Your messages are kept here until they are
   sent." (`conversation-page.md` §6, E3)
2. "Queued: Designer, QA" while runs wait (L3, UI-3.4).
3. The no-mention hint (M2).
4. "Images and PDFs are not checked for secrets." (M4)
5. The key hint.

## 4. Stop (P1)

- While a run in this conversation is queued or running, **Stop** shows inside the box at the
  left: 30 px high, `danger` border and text, a square icon and the label "Stop". A 1 px
  `outline-strong` divider separates it from the paperclip.
- It is far from Send, so the owner does not press it by mistake. The header has no Stop.
- Stop ends every queued and running run of the conversation (UI-3.15). The reply shows
  "Stopped by you" (`conversation-page.md` §6, E2).

## 5. Markdown keys and the format bar

> Agreed in the thread review of PR #26 (owner, 2026-10-25 01:47 and 01:51, option B). No board
> yet; the sketch is in this section.

Every Markdown box has the same keys and the same format bar: the composer, Edit, Request
changes, and the Bad answer note. The box stays plain Markdown text, not a rich editor.

### 5.1 Keys (Cmd in place of Ctrl on Mac)

| Key | Action | Result |
| --- | --- | --- |
| Ctrl+B | Bold | `**text**` |
| Ctrl+I | Italic | `_text_` |
| Ctrl+Shift+X | Strike | `~~text~~` |
| Ctrl+E | Inline code | `` `text` `` |
| Ctrl+K | Link | `[text](url)`, then the cursor selects `url` |
| Ctrl+Shift+C | Code block | a line with three back ticks before and after the selected lines |
| Ctrl+Shift+8 | Bullet list | `- ` at the start of each selected line |
| Ctrl+Shift+7 | Numbered list | `1. `, `2. ` … at the start of each selected line |
| Ctrl+Shift+. | Quote | `> ` at the start of each selected line |

- With a selection, the key wraps it. When the selection already has the same marks, the key
  removes them. With no selection, the key adds the marks and puts the cursor between them.
- One Ctrl+Z undoes one key action.
- The box takes these keys only while it has the focus, and stops the browser action for them
  then (Ctrl+B and Ctrl+K have other jobs in some browsers).

### 5.2 Format bar (B)

```
                 ┌ B  I  S  <>  🔗 ┐   ← shows only while text is selected
┌────────────────┴────────────────┴────────────────────────────┐
│ 📎  @BA write the ████████████ for the sign-in page.    [↑]  │
└──────────────────────────────────────────────────────────────┘
          hover B:  Bold · Ctrl+B
```

- A small bar shows above the selection while text in the box is selected, and goes away when
  the selection is empty or the box loses the focus.
- Five 28 px icon buttons: Bold, Italic, Strike, Inline code, Link. `surface-raised` fill, 1 px
  `outline-strong` border, radius 8 px, icons in `on-surface-muted`, an active mark in
  `on-surface`.
- Each button has an `aria-label` and a tooltip with its name and key ("Bold · Ctrl+B"). A
  click does the same as the key and keeps the selection.
- The bar also shows when the selection is made with the keyboard (Shift+arrows). Tab moves
  into the bar, and Esc closes it and returns the focus to the text.
- The line actions (code block, lists, quote) are keys only.
