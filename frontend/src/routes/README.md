# routes

The pages of the app, code-based TanStack Router routes (M0c plan, decision G). A heavy page is
a lazy route: `<name>.tsx` holds the route, `<name>.lazy.tsx` the page, in its own chunk
(`docs/frontend-conventions.md` §4).

| File | What it is for |
| --- | --- |
| `route-tree.ts` | Every page of the app |
| `root.tsx` | The shell around every page, and Page not found |
| `home.tsx` | `/` |
| `conversation.tsx` | `/c/conv_…`; any other id is Page not found |
| `bots.tsx` | `/bots`, `/bots/new`, `/bots/{slug}` |
| `skills.tsx` | `/skills`, and the lazy route `/skills/{slug}` |
| `skill.lazy.tsx` | The skill editor page |
| `stats.tsx` | The lazy route `/stats` |
| `stats.lazy.tsx` | The Statistics page |
| `settings.tsx` | `/settings` |

Start here: `route-tree.ts`. Do not: put page content here; it belongs in `features/`.
