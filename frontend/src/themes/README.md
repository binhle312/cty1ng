# themes

The theme layer (D30, `docs/design/themes.md`). A theme is one token file; components use the
token utilities in `src/styles.css` only.

| File | What it is for |
| --- | --- |
| `command.css` | The Command theme's token values (dark only in M0) |
| `theme.ts` | Appearance settings, read from browser storage; applies them to `<html>` |
| `variants.ts` | The only structural differences between themes (`themes.md` §2 rule 3) |
| `bot-palette.ts` | The 10 bot colours, the fixed colours of the slime art, the colour picker gradients |

Start here: `command.css`. Do not: put a token value anywhere else (`bot-palette.ts` holds the
colours that are the same in every theme).
