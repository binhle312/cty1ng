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

The owner picks the style and colour when creating a bot, or uploads an image instead. The bot
page changes them later (§6). Every style is drawn from the bot colour, which can be any colour
(§5), so Flat, Jelly and Pixel all follow it.

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
- Uploaded images never animate and have no faces; they get the same badges. Every bot keeps its
  colour (§5), used for its band, its spinner, the Flow view and group icons.
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

## 5. Colour

> Agreed in round 9, step 5b (2026-10-24): PR1, PR2, PR3, RI. Preview:
> `../previews/command-dark/bot-page.*`, `bot-avatar-change.*`.

The bot colour is **any colour**, stored as `#RRGGBB` (`../../domain-model.md` §2). The colour row
offers three ways to set it:

```
(●)(●)(●)(●)(●)(●)(●)(●)(●)(●) | (◉ custom) [🎨 Custom] [⤮ Random]
```

| Part | Rule |
| --- | --- |
| 10 swatches | The theme's bot palette, `bot-1` … `bot-10` (`../themes.md` §3), in token order. A click picks it. The picked swatch has the ✓ ring |
| Custom swatch | Shows only when the colour is not one of the swatches, after the divider, with the ✓ ring. **No hex text** beside it; the hex is in the Custom card |
| **Custom** | Secondary button with a palette icon. Opens the Custom colour card |
| **Random** | Secondary button with the Shuffle icon and the label "Random". Picks a random colour and shows it as the custom swatch. Each click picks another |

- **Used colours are not shown.** There are no marks for colours that other bots use, and no
  warning. Two bots can share a colour; the name tells them apart.
- **The palette is frontend only** (owner, 2026-10-24): the theme decides the swatches. The
  backend does not know the palette; it stores and checks only `#RRGGBB`.
- **Default at create:** the Create page picks a random swatch that no other bot uses (it has the
  bot list); any swatch when all are used. The owner does not see this rule. Clone uses the same
  rule: `clone-template` has no colour, and the page picks one.
- **Random** picks a random hue, with saturation and lightness inside a range, so it never picks
  near black, near white or grey, and the bot stays easy to see in the dark and light themes.
  Defaults (a frontend config value, not code; agreed by the owner 2026-10-24): saturation
  45–90 %, lightness 45–70 % (HSL).
- **Custom colour card (PR2):** a popover under the Custom button: a colour range box
  (saturation and value), a hue bar, **R**, **G**, **B** fields (0–255) and a **Hex** field, a
  preview of the avatar at header size (36 px), then **Cancel** and **Use** (`primary`, default).
  The fields and the range box stay in step. Esc or a click outside is Cancel. Custom accepts any
  colour.
- **Every colour change recolours all three style cards** (Flat, Jelly, Pixel) at once, so the
  owner sees each style in the new colour before choosing. Jelly and Pixel take the colour by the
  same recipe as at create.
- **Text on a bot colour** (for example the letter in a group icon) is black or white, whichever
  has the higher contrast with that colour, because a custom colour can be light or dark.
- **An uploaded image never changes** with the colour. The colour then sets only the band, the
  spinner and the Flow view.

## 6. Change the avatar on the bot page

> Agreed in round 9, step 5b (2026-10-24): AV1, AV2, AV4, HB.

There is no avatar dialog. Style and colour are fields in **Appearance** on the Profile tab
(`bot-page.md` §4).

- **Shortcut (AV1):** a hover on the 116 px avatar at the page top shows **Change**; a click opens
  the Profile tab and moves focus to Appearance.
- **Live preview (AV2):** the big avatar and the band (`bot-page.md` §5) show the change at once,
  with the "Not saved" pill beside the name. The header, the lists and the conversations change
  only after **Save**. Each changed field counts as one change in the save bar.
- **Upload (AV4):** the **Upload image** card opens the file picker. The image then opens in a
  small crop card: drag to move, a zoom slider, a round mask, **Cancel** and **Use**. **Use** puts
  it in the big avatar and in the style card ("Your image" with **Replace**), still not saved.
  The app re-encodes it (`../../security.md` §2.4). A wrong type or a file over 2 MB shows the
  error under the style cards. The colour stays for the band, the spinner and the Flow view.
- **Back to a style:** a click on Flat, Jelly or Pixel uses that style again; the uploaded image
  is dropped on Save.

## Later ideas (not specified)

Accessories (hats, glasses), a custom avatar background, poses per tool (book while reading),
hover animations on header bots, a hover thought bubble. Keep the layered SVG so these fit later.
