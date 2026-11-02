# bots

Bot parts and pages: the Bots page, the Create page with Clone (M2b), and the parts that the
header, the Skills page and the bot page (M2c) share.

| File | What it is for |
| --- | --- |
| `bot-avatar.tsx` | The bot avatar in its three sizes: the Flat slime in the bot colour, or the uploaded image; the "!" badge |
| `bot-band.tsx` | The colour band at the top of a bot card |
| `bot-colours.ts` | Bot colour rules: the default unused swatch, Random, hex, RGB and HSV |
| `bot-grid-card.tsx` | One card of the Bots page grid, with its pin badge and ⋯ menu |
| `bot-lines.ts` | Words about a bot: effort labels, health and status lines, the model line, search |
| `bot-list.tsx` | The bot list of the cards: rows with check boxes, or plain rows (`skills-page.md` §7) |
| `bot-pins.ts` | Pinned and other bots, pin list changes, and `useSetPins` (optimistic, with the 409 retry text) |
| `bot-queries.ts` | The bot list query and helpers: the pin of a skill, the bots that use it |
| `bots-page.tsx` | `/bots`: Pinned (drag to reorder) and Others (sort), search, empty state |
| `colour-row.tsx` | The colour row: 10 swatches, Custom and Random |
| `create-bot-form.ts` | The Create form: its state, per-step checks, tool rows and the request body (pure) |
| `create-bot-page.tsx` | `/bots/new` and Clone: the stepper, sending with the Idempotency-Key, Try again |
| `create-bot-preview.tsx` | The live preview card of the Create page |
| `create-bot-steps.tsx` | The four steps: Basics, Persona, Skills, Model |
| `crop-card.tsx` | Choosing an avatar image: type and size checks, the round crop card, the upload |
| `custom-colour-card.tsx` | The Custom colour card: box, hue bar, R G B and Hex |
| `delete-bot-dialog.tsx` | Delete a bot to Trash: the dialog and its toast |
| `tools-list.tsx` | The Tools list of step 4: internal and provider tools, pairs, gates |

Start here: `bots-page.tsx` or `create-bot-page.tsx`. Do not: draw an avatar anywhere else, or
put a palette colour here (it lives in `src/themes/bot-palette.ts`).
