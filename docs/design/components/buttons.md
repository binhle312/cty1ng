# Buttons and check boxes

> **Status: agreed in the UI design review (2026-10-23)**, canvas round 8, board W2 card C0.
> Preview: `../previews/command-dark/skills-editor.*` (card C0). Every page and dialog uses
> these kinds. A component spec names the kind, not its colours.

## 1. Button kinds

| Kind | Tokens | Use it for |
| --- | --- | --- |
| **Primary** | fill `primary`, text `on-primary`, weight 600 | The one main action of a page, card or dialog: Save, Create, Apply, Approve, Assign. At most one in each area |
| **Secondary** | border `outline-strong`, text `on-surface`, no fill | Every other action: Cancel, Skip, Discard, Import, Back |
| **Danger** | border and text `danger`, no fill | An action that removes or hides something: Deprecate, Remove from bots, Let them go, Delete project (the button on the page) |
| **Danger fill** | fill `danger`, text `on-primary`, weight 600 | Only the last step of a delete, in its confirm dialog: Delete project, Delete skill |

**Disabled** is not a kind: it is the same button at 40% opacity with `cursor: not-allowed`.
A disabled button has a tooltip that says why, for example "No changes to save."

## 2. Sizes and shape

- Two heights: 36 px (pages, dialogs, save bars) and 30 px (headers, cards, lists, banners).
- Radius `radius-card` (8 px in Command). Padding 14 px (36 px) or 12 px (30 px). The label does
  not wrap.

## 3. Default button and order

- The button that Enter presses is the **default** and has a focus ring: 2 px gap in the
  surface colour, then 2 px `primary`.
- In a dialog that removes something, **Cancel** is the default, so Enter never deletes.
- Buttons go at the right of their bar. The primary (or danger fill) button is last, at the far
  right. Secondary and danger buttons go to its left.
- A card with a bot or item list closes with no change on Skip or Cancel, Esc, or a click
  outside the card.

## 4. Labels

- A label is a verb, in sentence case: "Save as v5", "Remove from 3 bots".
- A label never ends in "…" (owner, 2026-10-23), also when it opens a dialog.
- A label with a count says the count: "Apply 4 changes", "Export 6 skills". It changes when the
  ticks change.

## 5. Check boxes

| State | Look |
| --- | --- |
| Ticked | 14 px box, fill `primary`, a ✓ in `on-primary` |
| Not ticked | 14 px box, 1 px `outline-strong` border, no fill |
| Disabled | 14 px box, `outline` border, `surface-raised` fill, 50% opacity |

A ticked box always shows the ✓, so the state does not depend on colour only. Rows with a check
box are in bot lists, import lists and export lists. A ticked row gets a `primary` border. A
click on the row ticks or clears the box.

## 6. Undo

Only a permanent delete shows a toast with **Undo** (for example "Delete now" on the Trash
page). A move to Trash and Deprecate show no Undo, because the owner can reverse them (D49).
