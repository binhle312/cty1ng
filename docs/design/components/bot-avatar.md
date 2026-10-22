# Bot avatar

> **Status: agreed in the M0 UI design review (2026-10-22).** Art: `../assets/avatars/`.
> Preview: `../previews/command-dark/avatars.png` (and `.html`, animated).

Every bot is drawn as a slime, the app's mascot. The product still says **bot** everywhere
(UI, docs, API, database); "slime" is only the look.

## 1. Styles

| Style | Look | Ships |
| --- | --- | --- |
| **Flat** (default) | One flat body colour, small plain black eyes, no shine. Body drawn at 95% width | M0 to M2: the only style built |
| **Jelly** | Same silhouette at full width, vertical gradient from a lighter tone to the bot colour, a soft outline in a darker tone, a clear gloss stroke on the upper left | Before the final product |
| **Pixel** | Polished pixel mascot: dark outline, top-left gloss, shading that leans toward indigo, big eyes with sparkle pixels, blush, droplets. Generated from the bot colour by one recipe (no hand-drawn sprite per bot) | Before the final product |

The owner picks the style and colour when creating a bot, or uploads an image instead. The Create
bot page layout is decided at the M2 checkpoint; only these choices are fixed.

Art is SVG on a 48 × 48 view box, drawn in layers (body, face, and room for accessories later).
Pixel uses a 48 grid for large sizes and a 32 grid for the header, always scaled by whole numbers
(`shape-rendering: crispEdges`), so pixels stay even.

## 2. Standard sizes

Every style sits in the same circle. These are the only sizes.

| Place | Circle | Flat / Jelly art box | Pixel art box |
| --- | --- | --- | --- |
| Bot page (large) | 116 px | 90 px | 78 px (48 grid) |
| Lists, colour picker | 72 px | 56 px | 48 px (48 grid) |
| Top header | 36 px | 30 px | 26 px (32 grid) |

The body is the same width in every style; Pixel's art box is smaller because its body fills more
of its grid. Circle background: `surface-raised`.

## 3. States and faces

The four states match the Flow view actor status (`../../flow-view.md` §3.1). Each has its own face,
shown even when animations are off.

| State | Face | Motion (Normal) | Badge (top-right) | Art |
| --- | --- | --- | --- | --- |
| Idle | Content: bright eyes, small smile | Breathes, blinks | none | `flat-idle.svg`, `jelly-idle.svg`, `pixel-idle.svg` |
| Queued | Patient: sleepy half-closed eyes, flat mouth | Glances side to side | Clock on `surface-raised` | `*-queued.svg` |
| Running | Excited: ^ ^ eyes, open smile | Hops | Spinner in the **bot's colour** | `*-running.svg` |
| Waiting for you | Hopeful: big eyes, brows up, small "o" mouth | Wiggles | Amber "?" (`primary`), pulses | `*-waiting.svg` |

Rules:
- One badge slot (top-right, 16 px at header size, 2 px ring in the page background). No ring
  around the avatar, no fading for queued (fading reads as disabled).
- Removed or deleted bots are not shown.
- Uploaded images never animate and have no faces; they get the same badges. Every bot keeps a
  palette colour, used for its spinner and in group icons.
- Screen readers get the state in the label: "Designer, running".

## 4. Animation setting

One owner setting, **Bot animations**, for all bots: **Off** (default) / Reduced / Normal.

| Value | Slime | Badge |
| --- | --- | --- |
| Off | Still (face still shows the state) | Still |
| Reduced | Still | Spinner turns, "?" pulses |
| Normal | Moves as in §3 | Moves |

The OS "reduce motion" setting caps it at Off. Only the header and the bot page preview animate;
messages and the left bar stay still. Separate from the Flow view's motion setting.

## Later ideas (not specified)

Accessories (hats, glasses), a custom avatar background, poses per tool (book while reading),
hover animations on header bots, a hover thought bubble. Keep the layered SVG so these fit later.
