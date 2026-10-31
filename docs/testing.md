# Testing

This document owns how the app is verified. The goal is that an agent can prove a change works
without a human clicking around, and that a human reviewer can trust the proof.

## 1. Layers

| Layer | Tool | Location | What it proves | Speed |
| --- | --- | --- | --- | --- |
| Rules | Vitest, table-driven (`it.each`) | next to `*.rules.ts` | Routing, budget, history window, mention parsing | ms |
| Service + DB | Vitest, temp SQLite file per test | next to `*.service.ts` | Invariants (`domain-model.md` §12), transactions, events written | fast |
| API | Vitest + Hono's `app.request()` (no network) | `backend/test/api/` | Status codes, error codes, schemas, origin checks | fast |
| Agent | Vitest + the fake model adapter (AI SDK mock model) | `backend/src/core/runs/` | Prompt assembly, tools, provenance, streaming, cancellation | fast |
| Port contracts | Vitest, one suite per port run against every adapter (D35) | `backend/test/contracts/` | Each adapter honours its port: replay and ordering (transport), transactions (unit of work), lease and retry (queue), streaming and usage (model) | fast |
| Security | Vitest | `backend/test/security/`, `frontend/test/security/` | `security.md` §3 | fast |
| Frontend unit | Vitest + Testing Library | next to the code in `frontend/src/` | Components, reducer, mention autocomplete, icon composition | fast |
| End to end | Playwright, fake model | `frontend/test/e2e/` | User journeys across the real backend | slower |
| Repository checks | CI scripts | — | Generated client up to date; event type lists match; import rules; folder indexes complete | fast |

## 2. The fake model

Tests never call real providers (`AGENTS.md` §8).

- The backend accepts `FAKE_MODEL=1`; the catalog then exposes `fake:scripted` (available, no
  key) and `app/main.ts` wires `adapters/model/fake/` instead of the AI SDK adapter. It builds
  on the AI SDK's mock language model, so streaming and usage have the real shapes.
- The fake reads a **script** keyed by bot slug from `backend/test/fixtures/fake-scripts/*.yaml`:

  ```yaml
  ba:
    - when_contains: "login"
      tool_calls:
        - load_skill: {name: write-user-stories}
        - write_file: {path: user-stories/login.md, content: "# Login stories\n..."}
      reply: "I wrote user-stories/login.md. @Designer can you sketch the screens?"
  designer:
    - reply: "Two screens: sign-in and reset. @BA agreed?"
  ```

- Streaming is simulated by splitting the reply into chunks, so delta handling is tested.
- Title requests (D46) read the reserved key `_titles`. Bot slugs come from names as kebab case (D19)
  and never contain `_`, so the key never collides with a bot. Each entry gives a `title`, or a `fail` (`error`, `timeout`
  or `empty`), and an optional `delay_ms`. With no matching entry the fake answers "Test
  title". The helper counts title calls and the calls in flight, so a test can assert
  that no call happened, or that multiple title requests were in flight at the same time.

  ```yaml
  _titles:
    - when_contains: "login"
      title: "Login page user stories"
      delay_ms: 500          # lets a test rename the chat during the call
    - when_contains: "fail"
      fail: timeout
  ```
- **Tool faults.** A tool call in a script can carry `force: error` (with an error code) or
  `force: empty`. The agent test helper then returns that result instead of running the tool.
  Use real inputs first where they exist (a missing file, a path outside the write scope, bad
  arguments); use `force` only for faults that a test cannot cause in another way.

  ```yaml
  ba:
    - when_contains: "read the spec"
      tool_calls:
        - read_file: {path: requirements/spec.md}     # file does not exist: real not_found
        - list_files: {path: requirements/, force: empty}
        - load_skill: {name: write-user-stories, force: {error: internal}}
      reply: "I could not read requirements/spec.md, so I did not start the stories."
  ```

  The fake model is scripted, so it cannot prove that a real model is honest about a failure.
  The tests prove what the app does: the error reaches the model, the step shows the error, and
  the run continues (`conversation-rules.md` §4, "Tool results").
- A helper `fakeModel(scripts)` is available to backend tests; Playwright starts the backend
  with `FAKE_MODEL=1` and a chosen script set.

## 3. What must be tested

### Domain (`decideRuns`)

One table row per case in `conversation-rules.md` §1 and §2, plus:

- budget reset on human message and on edit;
- an edit that drops a mention does not run that bot;
- mention order and duplicates;
- three bots mentioned with one turn left;
- pending, removed, deleted and unavailable bots;
- a bot mentioning itself;
- limit lowered below `used` mid-discussion;
- discussion off with bot mentions present.

`visibleHistory`: `history_from_seq` cut, branch path selection, `(you)` labelling, size
trimming with the omission marker, and a later bot from the same message seeing the earlier
bots' replies (D31); the shared history budget (D32) with a small and a large
`context_window`, the per-bot `history_share_pct` (10, 40, 80), newest-first filling across transcript and runs, and
`run_history` excluding runs from an abandoned branch.

Run status reactions (UI-3.18): a Vitest reducer test that `run.queued` adds one clock reaction
per bot and `run.started` or a cancel removes it, including replayed events; `run.finished`
(done, failed, stopped) adds no reaction.

### Services and API

Each invariant in `domain-model.md` §12 has a named test (`invariant 01: model is immutable`
…). Plus: skill import preview/apply (including "changed since preview" → 409), clone
templates, upgrade dialog only moving checked pins, deprecation rules, edit while running →
409, branch switching picks the newest leaf, event `seq` strictly increasing, replay after
`Last-Event-ID`, `reset` for an old cursor.

### Agent

Prompt contains persona, rules block with correct numbers, always-loaded bodies, on-demand
list; `load_skill` returns the pinned version (not latest); `run_skills` matches; Stop cancels
mid-stream and keeps partial text; retry after a crash reuses the same message.

Faults (`conversation-rules.md` §4, "Tool results"), one named test each:

- a tool error (`not_found`, `outside_write_scope`, forced `internal`): the next model request
  holds `{error, message}` as the tool result, the `run_steps` row has `status = error` with the
  code, and the run ends `done`, not `failed`;
- an empty result (`list_files` on an empty folder): the tool result is `{files: []}` and the
  step is `ok`;
- bad input from the model: arguments that fail the Zod schema give `invalid_arguments`; an
  unknown tool name gives `unknown_tool`; neither runs any tool code;
- an `internal` error sends no stack trace or exception text to the model, the events or the API;
- the prompt contains the line "If a tool returns an error or no data, say so";
- a model that calls a failing tool again and again stops at `request_limit`.

### Run and handoff behaviour

Lessons from an earlier prototype. Each needs a named test in the slice that builds it:

1. A run's history is appended exactly once, only on success (no duplicate turns on retry).
2. A crashed run is retried after its lease expires; after `RUN_MAX_ATTEMPTS` it fails visibly
   (`architecture.md` §6).
3. Images and PDFs are not sent to the model again on every later turn: history holds
   placeholders, and `view_file` brings them back.
4. A handoff approval is pinned to a commit; changed files make it stale.
5. A daily handoff limit stops runaway loops and tells the owner.
6. Replies longer than `max_reply_chars` are truncated with a pointer to the files.
7. Bots never start another bot's work themselves; only an approval or the budgeted discussion
   does.

### End to end (Playwright)

`e2e/journey-first-use.spec.ts` follows J1 from `requirements/product-brief.md`, then continues:

1. create skill → create bot BA with it → create conversation;
2. drag BA from the header into the chat → choose "Full history";
3. `@` shows only BA → send → reply streams → chip `write-user-stories v1` visible → the rail
   tooltip shows the fake auto title (D46);
4. add Designer with the add slot (+) in the conversation header → enable discussion with limit 2 → bots stop after 2 turns with
   the notice;
5. Stop button during a run → message shows "Stopped";
6. edit the first message → ‹ 2/2 › appears → switch back to ‹ 1/2 ›;
7. edit the skill → v2 → BA still shows v1 on the next reply → upgrade → v2 chip;
8. delete BA → its messages are grey;
9. reload the page → identical state.

`e2e/first-open.spec.ts`: a fresh database with no key shows the Get started checklist with
the key step open; with the fake model's key it ticks; "Load the examples" ticks two steps and
is safe to press twice. `e2e/reopen.spec.ts`: open a conversation, type a draft, reload at `/`
→ the same conversation with the draft; a link to another conversation wins; unread messages
open at the "New" divider.

Each slice's brief lists which of these steps must pass by its end.

### Fast loop while building

A full gate run is slow, mostly because Playwright starts two backends and builds the frontend.
While fixing, run only what the change touches, and run the full suite once at the end
(`workflow.md` §2 step 4):

| To run | Command |
| --- | --- |
| One Vitest file | `pnpm exec vitest run <path>` |
| Some end-to-end tests | `pnpm e2e -g "<test title>"` |
| The end-to-end servers, kept running | `pnpm e2e:serve` in a second terminal |

When `pnpm e2e:serve` runs, `pnpm e2e` reuses its servers instead of starting new ones
(`reuseExistingServer`, local only; CI always starts fresh servers). The servers keep one
database until you stop the script, so a test that needs a fresh database fails on the second
run: restart the script. The backend serves the frontend build from disk, so after a frontend
change run `pnpm build` before `pnpm e2e`; after a backend change, restart the script.
Each server runs as its own process group. When you stop the script (Ctrl+C or SIGTERM), it
stops every process in each group and waits until they have stopped, so Playwright never reuses
an old server. A group that is still running after `E2E_SERVE_STOP_MS` (default 10000 ms) is
killed.

### Test helpers

| Helper | File | Use |
| --- | --- | --- |
| `renderApp(path)` | `frontend/test/render-app.tsx` | Component tests on the real app: routes, shell and providers on an in-memory address. Returns the Testing Library view and the router. Queries do not retry, so a failed request shows its error state at once. |
| `watchCsp(page)` | `frontend/test/e2e/csp.ts` | End-to-end tests: collects every CSP violation of a page; assert that the list is empty. |
| `readZip(buffer)` | `frontend/test/e2e/zip.ts` | End-to-end tests: the files of a downloaded zip (the skill export), by name. |

### Themes (D30)

From M0, per `design/themes.md` §5: a token contrast test (WCAG AA), axe checks in every theme
and mode, Playwright visual snapshots of the key screens per theme and mode, and a
theme-switch leak test.

## 4. CI gates

All must be green to merge: ESLint (including the security rules in `security.md` §2.8),
Prettier, `tsc`, dependency-cruiser import rules (D35), Vitest, `db:check` (Drizzle schema
matches the migrations), Playwright, generated-client freshness, event-type list match,
`check:index` (folder indexes complete, `architecture.md` §4.2), `pnpm audit --audit-level
high`, CodeQL (`security.md` §2.11). PRs touching security-sensitive paths also run the automated security review
(`security.md` §2.11).

## 5. Evidence in PRs

A PR description maps each acceptance criterion of its task to the test that proves it, or to a
screenshot for purely visual criteria (Playwright can save screenshots:
`frontend/test/e2e/__screenshots__/`). "Tested manually" alone is not evidence.
