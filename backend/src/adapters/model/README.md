# model

The model port's adapters. M0 has only the fake model plumbing (`docs/testing.md` §2); the AI
SDK adapter and the fake that plays scripts come with the agent (M3).

| File | What it is for |
| --- | --- |
| `fake/` | The fake model |
| `fake/scripts.ts` | The script format (Zod) and `loadFakeScripts(folder)` |

Start here: `fake/scripts.ts`. Do not: call a real provider in a test (`AGENTS.md` §8).
