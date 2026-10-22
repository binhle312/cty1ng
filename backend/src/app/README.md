# app

Composition root: reads config, builds the adapters, hands them to the core (architecture.md §3).
The only place adapters are chosen.

| File | What it is for |
| --- | --- |
| `config.ts` | Env vars parsed with Zod (architecture.md §8); refuses a non-loopback `HOST` |
| `logger.ts` | Pino logger with secret redaction (security.md §2.6) |
| `redact.ts` | Turns logged values into plain JSON data with secrets replaced; keeps error details |
| `compose.ts` | Wires adapters into the core and returns the HTTP app; used by `main.ts` and tests |
| `main.ts` | Process entry: config, compose, listen on loopback |
| `cli.ts` | `ids decode`, `db migrate` |

Start here: `compose.ts`. Do not: put logic here beyond wiring.
