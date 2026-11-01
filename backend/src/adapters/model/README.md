# model

The model port's adapters. M0 has only the fake model plumbing (`docs/testing.md` §2); the AI
SDK adapter and the fake that plays scripts come with the agent (M3).

| File | What it is for |
| --- | --- |
| `ai-sdk/` | The Vercel AI SDK adapter. M2 has only the effort mapping; the agent comes in M3 |
| `ai-sdk/effort.ts` | Catalog effort → each provider's request option (Anthropic, Google); the providers the adapter knows |
| `ai-sdk/effort.test.ts` | Every effort of each provider, a refused level, the known providers |
| `fake/` | The fake model |
| `fake/scripts.ts` | The script format (Zod) and `loadFakeScripts(folder)` |

Start here: `fake/scripts.ts`. Do not: call a real provider in a test (`AGENTS.md` §8).
