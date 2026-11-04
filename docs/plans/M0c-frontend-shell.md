# M0c plan: Frontend shell

> **Record, not spec.** Copied from [the description of #49](https://github.com/binhle312/cty1ng/pull/49) on 2026-11-04. The owning documents win where they differ ([index](README.md)).
>
> **Approval:** #49 calls these decisions agreed and the plan approved. #49 merged on 2026-10-30.
>
> **Summary only:** no PR holds the full plan. This file has the plan decisions as #49 records them.

The agreed plan decisions A–H, as built:

| | Decision | Where |
| --- | --- | --- |
| A | Vite forwards `/api`; relative URLs for REST and SSE. A test runs the real dev server against the real backend: Host passes, the dev origin passes, `https://evil.com` gets 403 | `scripts/dev-proxy.test.ts` |
| B | `NODE_ENV=production` serves `frontend/dist` with the CSP; page reloads get `index.html`; `/api/*` never does; e2e uses `APP_ENV=prod NODE_ENV=production FAKE_MODEL=1`; the startup guard stays | `static.ts`, `frontend-files.test.ts`, e2e |
| C | Conversations "+" and "Hey, let's talk 👋" turned off with a reason; no project hint | `turned-off.tsx` |
| D | No bots: only the add slot. HD1 and UI-2.1 updated | `top-header.tsx`, docs |
| E | Bar 2 visible by default; preference in `localStorage` read with Zod, with a fallback; a page that hides bar 2 does not change it | `bar-two-state.ts` |
| F | Ctrl+B ignored in inputs, textareas, contenteditable, `role=textbox`; their default action stays | `bar-two-state.ts` |
| G | `/c/$id` takes a `conv_` TypeID; any other id is Page not found | `routes/conversation.tsx` |
| H | Hey API: its TanStack plugin makes query/mutation **options** for TanStack's own hooks, not hooks; its Zod plugin makes response schemas. Recorded in the M0 brief and `gen-api.ts` | `scripts/gen-api.ts` |
