# bots

Bot parts and pages: the Bots page, the Create page with Clone (M2b), the bot page (M2c), and
the parts that the header and the Skills page share.

| File | What it is for |
| --- | --- |
| `add-skills-dialog.tsx` | + Add on a bot's Skills tab: tick the active skills the bot does not have (SK2) |
| `bot-avatar.tsx` | The bot avatar in its three sizes: the Flat slime in the bot colour, or the uploaded image; the "!" badge |
| `bot-band.tsx` | The colour band at the top of a bot card |
| `bot-colours.ts` | Bot colour rules: the default unused swatch, Random, hex, RGB and HSV |
| `bot-edit-form.ts` | The bot page's Profile and Model edits (pure): changed fields, problems, the PATCH body, the leave text |
| `bot-edit-state.ts` | The edit state of the Profile and Model tabs (pure): a reducer of the table in `bot-page.md` §4.2 (the form, the Save on its way, conflicts, errors, toasts) and what the page shows |
| `bot-edit-store.ts` | The edit state of one bot page outside React: late answers change the state as it is now, toasts show at once, leaving lets every tab go |
| `bot-grid-card.tsx` | One card of the Bots page grid, with its pin badge and ⋯ menu |
| `bot-leave-guard.tsx` | Leave the bot page with unsaved changes: Discard, Esc, another tab, bot or page asks first |
| `bot-lines.ts` | Words about a bot: effort labels, health and status lines, the model line, search |
| `bot-list.tsx` | The bot list of the cards: rows with check boxes, or plain rows (`skills-page.md` §7) |
| `bot-page.tsx` | `/bots/{slug}`: the edit layout, the tabs and the two save bars; sends the edit events of `bot-edit-state.ts` and the Save |
| `bot-page-top.tsx` | The bot page top: band, 116 px avatar, name, locked model badge, status, ⋯; the cannot-run banner |
| `bot-list-state.ts` | The bot list and the sort (pure): the server value and the requests that wait, in send order; what the page shows, the answers that go in, the Always load value on its way |
| `bot-list-store.ts` | The bot list state of a query client: sends it the loads, writes what the page shows into the cache; the Always load, Remove, pin, pinned order, sort and save answer sends |
| `bot-order.ts` | Pinned and other bots, pin list changes, and the header order (pure) |
| `bot-pins.ts` | `useSetPins`: saves a new pinned list at once, with the 409 retry text |
| `bot-queries.ts` | The bot list query and helpers: the pin of a skill, the bots that use it |
| `bot-save-bar.tsx` | The save bar of the Profile and Model tabs: no changes, changes, errors, conflict |
| `bot-side-list.tsx` | The list of the edit layout: Back, Create, Search, Pinned (reorder) and Others, rows with the pin badge |
| `bot-skills-tab.tsx` | A bot's Skills tab: rows, Always load, upgrade link, Change version, Remove, + Add |
| `bot-tabs.ts` | The bot page's tab list, for the route's `?tab=`, the page and the leave question |
| `bot-sort-buttons.tsx` | The Recent activity and Created time sort buttons of the Others group |
| `bots-page.tsx` | `/bots`: Pinned (drag to reorder) and Others (sort), search, empty state |
| `colour-row.tsx` | The colour row: 10 swatches, Custom and Random |
| `create-bot-form.ts` | The Create form: its state, per-step checks, tool rows and the request body (pure); the server-error rules the bot page shares |
| `create-bot-page.tsx` | `/bots/new` and Clone: the stepper, sending with the Idempotency-Key, Try again |
| `create-bot-preview.tsx` | The live preview card of the Create page |
| `create-bot-steps.tsx` | The four steps, and their field groups that the bot page shares (Name, Appearance, Persona, Tools, Advanced) |
| `crop-card.tsx` | Choosing an avatar image: type and size checks, the round crop card, the upload |
| `custom-colour-card.tsx` | The Custom colour card: box, hue bar, R G B and Hex |
| `delete-bot-dialog.tsx` | Delete a bot to Trash: the dialog and its toast |
| `drag-setup.ts` | The drag sensors (mouse, long-press touch, Space) and the drop-area check shared by the header and the Pinned group |
| `pinned-sort.tsx` | Reordering the pinned bots (pin.md §2): drag and Alt+← / Alt+→, for the Bots grid and the side list |
| `tools-list.tsx` | The Tools list of step 4: internal and provider tools, pairs, gates |

Start here: `bots-page.tsx`, `create-bot-page.tsx` or `bot-page.tsx`. Do not: draw an avatar anywhere else, or
put a palette colour here (it lives in `src/themes/bot-palette.ts`).
