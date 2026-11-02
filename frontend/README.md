# frontend

The React app (D28): Vite, TanStack Router and Query, Tailwind with the theme tokens (D30), Base
UI parts. `docs/architecture.md` §4; TypeScript rules in `docs/frontend-conventions.md`.

| File | What it is for |
| --- | --- |
| `package.json` | The `@cty1ng/frontend` package: `dev`, `build`, `typecheck` |
| `tsconfig.json` | Type-check settings for this package |
| `vite.config.ts` | Dev server on 127.0.0.1:5173 that forwards `/api` to the backend; the production build |
| `index.html` | The page: loads the no-flash theme script, then the app |
| `playwright.config.ts` | End-to-end tests against the production build that the backend serves |
| `public/` | Files served as they are |
| `public/theme-init.js` | Sets the theme on `<html>` before the first paint (`docs/design/themes.md` §2 rule 5) |
| `public/zod-init.js` | Turns off Zod's `new Function` fast path before any module runs (the CSP blocks it) |
| `src/` | The source |
| `src/main.tsx` | Start: Zod settings, fonts, styles, theme, the event stream, the router |
| `src/router.ts` | The router: lazy pages, preload on hover or focus |
| `src/styles.css` | Tailwind with the semantic tokens as utilities, the shell sizes |
| `src/routes/` | One file per page |
| `src/features/` | One folder per feature: its components, hooks and view state |
| `src/components/ui/` | Base UI parts in our style: button, menu, tooltip, skeleton |
| `src/lib/` | Shared helpers: storage, logger, class names, the API client, the event stream |
| `src/themes/` | Token files per theme, the theme controller, theme variants |
| `test/` | Test helpers and the end-to-end tests |
| `test/setup.ts` | Vitest setup for component tests |
| `test/render-app.tsx` | Renders the real app on an in-memory address |
| `test/e2e/` | Playwright tests (`docs/testing.md` §3) |

Start here: `src/routes/route-tree.ts`. Do not: write a fetch call for an API endpoint (use
`src/lib/api/`), or a raw colour or arbitrary Tailwind value in `components/` or `features/`.
