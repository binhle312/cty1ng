# Frontend conventions (TypeScript)

How TypeScript code is typed. Since D34 these rules apply to `backend/` and `shared/` too;
rows about React, the generated client or UI state apply to the frontend only. Most rules are enforced by `tsc` and ESLint (§3), so a reviewer
does not have to remember them. Adapted from the MIT-licensed
[typescript-best-practices](https://github.com/cursor/plugins/tree/main/pstack/skills/typescript-best-practices)
skill (Lauren Tan), changed where it conflicts with this project.

## 1. Rules

| Rule | In this project |
| --- | --- |
| **Discriminated unions** | Variants carry a literal discriminant, never a bag of optional fields. Our discriminants: `type` on SSE events (the SSE `event:` name, `realtime-events.md` §4), `status` on runs and messages, `kind` on messages and UI view state. |
| **Exhaustive switches** | Every switch over a discriminant ends with `const _exhaustive: never = x;` in `default`. A new event type that the reducer does not handle fails to compile. |
| **`unknown` at boundaries** | Anything that did not come through the generated client is `unknown` until a schema parses it: SSE payloads, `localStorage` (theme, view settings), `postMessage`, URL search params. On the backend: request bodies, env vars, `config/models.yaml`, JSON columns read from the database, model tool-call arguments. Parse once where it enters, then trust the type. |
| **Schemas, not hand-written guards** | Validation uses Zod (D33). The TypeScript type is inferred from the schema (`z.infer`), never declared twice. |
| **Types from the API, not copies** | REST types come from `frontend/src/lib/api/generated/`. Use `Pick`, `Omit`, `ReturnType`, `Awaited` on them; never redeclare a shape the backend owns. |
| **No `as`** | No type assertions, except `as const`. Use `satisfies` to check a literal without widening it. A cast is allowed only right after a schema parse, with a comment. |
| **Branded ids** | `BotId`, `MessageId`, `ConversationId`, `RunId`, `SkillId` are branded TypeID strings from `shared/src/ids.ts` (D36: `bot_…`, `msg_…`; the schema checks the prefix), so one cannot be passed where another is expected. Brands come from a schema parse, never from `as`. |
| **Simplest total type** | Keep `T[]` while every use is total. Strengthen (for example to a non-empty tuple) only where the loose type forces `!`, a cast or a "should never happen" throw. |
| **Object arguments** | Functions with more than two parameters, or two of the same type, take one object. Not on hot paths (render loops, the Flow renderer's per-frame code). |
| **Real tests** | Test with the real store, router and reducer; mock only the network and the clock. Matches `testing.md`. |
| **No `console`** | Use the small logger in `frontend/src/lib/log.ts`; it is silent in production builds and never logs message or file contents (`security.md` §2.10). The backend logs through Pino (`architecture.md` §9). |

**Not adopted:** the source suggests modelling a time range as start plus duration. Our time
ranges are relative expressions (`now-7d` to `now`) shared with the backend
(`requirements/time-range-picker.md`), so they stay `{ from, to }`.

## 2. Examples

SSE event handling, parsed at the boundary and switched exhaustively:

```ts
const RunStartedEvent = z.object({ type: z.literal("run.started"), run: RunSchema });
const MessageDeltaEvent = z.object({
  type: z.literal("message.delta"),
  message_id: MessageId,
  offset: z.number().int().nonnegative(),
  text: z.string(),
});
const StreamEvent = z.discriminatedUnion("type", [RunStartedEvent, MessageDeltaEvent /* … */]);
type StreamEvent = z.infer<typeof StreamEvent>;

function apply(event: StreamEvent): void {
  switch (event.type) {
    case "run.started":
      /* … */
      break;
    case "message.delta":
      /* … */
      break;
    default: {
      const _exhaustive: never = event;
      void _exhaustive;
    }
  }
}

// at the boundary only: the SSE event name becomes the discriminant
const parsed = StreamEvent.safeParse({ type: raw.type, ...JSON.parse(raw.data) });
if (!parsed.success) return log.warn("stream.unknown_event", { seq: raw.lastEventId });
apply(parsed.data);
```

UI state as a union instead of flags:

```ts
// Don't: { loading: boolean; error?: string; data?: Stats }
type StatsView =
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "error"; error: ApiError }
  | { kind: "ready"; data: Stats };
```

This also gives every list and detail view its four required states
(`requirements/README.md`); `loading` renders the shared `Skeleton`, never an inline spinner.

## 3. Enforcement (set up in M0)

`tsconfig.json`: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
`noImplicitOverride`, `noFallthroughCasesInSwitch`.

ESLint (typescript-eslint, type-aware):

| Rule | Setting |
| --- | --- |
| `@typescript-eslint/no-explicit-any` | error |
| `@typescript-eslint/consistent-type-assertions` | `{ assertionStyle: "never" }`, with a reviewed inline disable after a schema parse |
| `@typescript-eslint/switch-exhaustiveness-check` | error |
| `@typescript-eslint/no-non-null-assertion` | error |
| `@typescript-eslint/no-unsafe-*` (assignment, member-access, call, return, argument) | error |
| `no-console` | error |

A new rule exception needs a comment saying why, and shows up in review.
