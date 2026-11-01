# bots

Bot parts that more than one page uses. M2a holds the smallest set that the Skills page needs;
the Bots page, the bot page and the Create page (M2b) add to it.

| File | What it is for |
| --- | --- |
| `bot-avatar.tsx` | The 36 px bot avatar: the colour with the first letter, or the uploaded image |
| `bot-list.tsx` | The bot list of the cards: rows with check boxes, or plain rows (`skills-page.md` §7) |
| `bot-queries.ts` | The bot list query and helpers: the pin of a skill, the bots that use it, the model line |

Start here: `bot-queries.ts`. Do not: draw an avatar anywhere else; M2b extends `bot-avatar.tsx`
with the sizes and styles of `docs/design/components/bot-avatar.md`.
