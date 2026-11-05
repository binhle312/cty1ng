# Testing

This document owns how the app is verified. The goal is that an agent can prove a change works
without a human clicking around, and that a human reviewer can trust the proof.

Choose the relevant test layer and cases. The required CI gates and evidence rules still apply.

## 1. Layers

| Layer | Tool | Location | What it proves | Speed |
| --- | --- | --- | --- | --- |
| Rules | Vitest, table-driven (`it.each`) | next to `*.rules.ts` | Routing, budget, history window, mention parsing | ms |
| Service + DB | Vitest, temp SQLite file per test | next to `*.service.ts` | Invariants (`domain-model.md` §12), transactions, events written | fast |
| API | Vitest + Hono's `app.request()` (no network) | `backend/test/api/` | Status codes, error codes, schemas, origin checks | fast |
| Agent | Vitest + the fake model adapter (AI SDK mock model) | `backend/src/core/runs/` | Prompt assembly, tools, provenance, streaming, cancellation | fast |
| Port contracts | Vitest, one suite per port run against every adapter (D35) | `backend/test/contracts/` | Each adapter honours its port: replay and ordering (transport), transactions (unit of work), lease and retry (queue), streaming and usage (model) | fast |
| Security | Vitest | `backend/test/security/`, and next to the code they check (upload tests, `frontend/src/components/ui/markdown.test.tsx`) | `security.md` §3 | fast |
| Frontend unit | Vitest + Testing Library | next to the code in `frontend/src/` | Components, reducer, mention autocomplete, icon composition | fast |
| End to end | Playwright, fake model | `frontend/test/e2e/` | User journeys across the real backend | slower |
| Repository checks | CI scripts | — | Generated client up to date; event type lists match; import rules; folder indexes complete | fast |

## 2. The fake model

Tests never call real providers (`AGENTS.md` §8).

- The backend accepts `FAKE_MODEL=1`; the catalog then exposes `fake:scripted` and
  `fake:effort` (both available with no key, `domain-model.md` §4) next to the entries of
  `config/models.yaml`, and `app/compose.ts` wires `adapters/model/fake/` instead of the AI SDK
  adapter for both. It builds on the AI SDK's mock language model, so streaming and usage have
  the real shapes. `fake:effort` has efforts, so the Create page's effort menu and a clone to
  another model can be tested end to end.
- **Fake mode does not depend on the developer's keys** (M2 spec gap pass, owner 2026-11-01).
  The Playwright servers clear every `*_API_KEY` variable, and Vitest's test config passes an
  environment with none, so the
  real catalog entries are always unavailable and grey in tests, whatever `.env` holds.
  Provider tools are tested in service tests with a test catalog, not end to end.
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
3. `@` shows only BA → send → reply streams → chip `write-user-stories v1` visible → the bar 2
   row shows the fake auto title (D46);
4. add Designer with the add slot (+) in the conversation header → enable discussion with limit 2 → bots stop after 2 turns with
   the notice;
5. Stop button during a run → message shows "Stopped";
6. edit the first message → ‹ 2/2 › appears → switch back to ‹ 1/2 ›;
7. edit the skill → v2 → BA still shows v1 on the next reply → upgrade → v2 chip;
8. delete BA → its messages are grey;
9. reload the page → identical state.

Until conversations exist (M3), the run does step 1 without the conversation, then a Clone of BA
with the other fake model, then the J4 upgrade: edit the skill → v2 → Skip on the upgrade card →
BA's Skills tab shows "v2 available" → Upgrade (M2-bots.md Tests).

`e2e/first-open.spec.ts`: a fresh database with no key shows the Get started checklist with
the key step open; with the fake model's key it ticks; "Load the examples" ticks two steps and
is safe to press twice. `e2e/reopen.spec.ts`: open a conversation, type a draft, reload at `/`
→ the same conversation with the draft; a link to another conversation wins; unread messages
open at the "New" divider.

Each slice's brief lists which of these steps must pass by its end.

### Edge cases each slice tests

The normal path of an acceptance criterion is not enough. For each screen or flow it builds,
a slice tests these cases where they apply. The test strategy names them before the code
([test strategy](workflows/planning.md#test-strategy-before-code)), and the spec walk checks them again
([implementation self-check](workflows/implementation.md#self-check)):

| Case | Example |
| --- | --- |
| The same data changes in another tab | An unsaved edit stays and the conflict shows |
| The same action twice | A second Clone gets the next free slug |
| A request fails | The error state shows, not Page not found or an empty list |
| Keyboard only | Every tooltip, menu and dialog opens and closes from the keyboard |
| Leaving with unsaved work | Every way out asks first, including moves inside one path |
| Moving through the app, not only reloads | A test that reloads can hide a cache bug |
| An answer comes late | A save or toggle answer that comes after a newer change, a Discard or leaving the page does not undo it |
| A value changes and changes back | On, then off in another tab: the page cannot tell from the value alone that it changed |

**State table cells.** A screen with a state table ([state table](workflows/planning.md#state-table-for-stateful-screens)) tests its pure
state module (`frontend-conventions.md` §1): one unit test per cell of the table. It also runs
every order of a small set of events on the module (for example Save sent, its answer, an
event with a newer `row_version`, Discard, typing) and checks the same invariants after each
order: an edit the owner dropped never comes back, an older answer never replaces a newer
value, and Save is off while a conflict shows. These tests are fast, so every order is cheap;
the component tests then cover the wiring and a few chosen orders.

### Request order and list states

For every request on a changed screen with locks, live events or late answers, test these six cases.
Hold and release answers to force the order, including requests away from a reported finding.
Apply the [failure scope](workflows/merge-bar.md#failure-scope) and the
[state and order principle](../.agents/skills/principle-state-and-order/SKILL.md).

| Case | Required check |
| --- | --- |
| The answer arrives late | It writes only the fields its request owns |
| The caller left the tab or page | The request's checks still hold after the component is gone |
| A newer request of the same kind starts | The older answer cannot undo the newer work |
| A list load or live event arrives between request and answer | The answer still applies only to valid state |
| The refresh after a change is slow or fails | Controls show the true pending or error state |
| Another request on the same screen also waits | Each answer ends only its own work; two refusals in either order restore the server value |

Every query read on a changed screen needs tests for loading, error and empty states
(`requirements/README.md`). Hold the load or fail it to reach these states.
A `data ?? []` fallback must not turn a failed load into an empty result.

### Fast loop while building

A full gate run is slow, mostly because Playwright starts two backends and builds the frontend.
While fixing, run only what the change touches, and run the full suite once at the end
([implementation self-check](workflows/implementation.md#self-check)):

| To run | Command |
| --- | --- |
| One Vitest file | `pnpm exec vitest run <path>` |
| Some end-to-end tests | `pnpm e2e -g "<test title>"` |
| The end-to-end servers, kept running | `pnpm e2e:serve` in a second terminal |

A local `pnpm e2e` uses 4 workers (`frontend/playwright.config.ts`); `--workers=<n>` changes it for
one run. CI uses half of its cores. On a 16-thread laptop, 8 workers finished no sooner than 4 and
made J1 take twice as long, so J1 passed its 30 s limit when the machine was busy.

When `pnpm e2e:serve` runs, `pnpm e2e` reuses its servers instead of starting new ones
(`reuseExistingServer`, local only; CI always starts fresh servers). The tests write into the
server they use, so `pnpm e2e` reuses only the servers of a `pnpm e2e:serve` of the same checkout
that still runs: the script writes its process id to `.e2e-serve`, and the Playwright config
checks it. The script writes that file only after each of its own servers has printed its
`listening` line, which comes after the bind, and removes it first when it stops. So wait for
`e2e:serve: ready` before you run `pnpm e2e`. A server that does not get its port or does not
report in time (the config's `timeout`) stops the script. Without that file, `pnpm e2e` starts its
own servers and waits for each one's `listening` line, at `LOG_LEVEL=info`
(`scripts/lib/e2e-server-ready.ts`). It does not wait for an answer on the port, because Playwright
takes any answer as "up" and does not notice when its own server then fails. So any other server on
ports 8100 or 8101 (one left by an old run, another checkout's, or the real app) makes its own
server fail with `EADDRINUSE`, and Playwright stops with "was not able to start": no test runs. For
port 8100 this comes after the frontend build. Stop that server, then run again. So before you test
old code in a `git worktree` ([evidence rules](#5-evidence-in-prs)), ports 8100 and 8101 must be free. The servers keep one
database until you stop the script, so a test that needs a fresh database fails on the second
run: restart the script. The backend serves the frontend build from disk, so after a frontend
change run `pnpm build` before `pnpm e2e`; after a backend change, restart the script.
Each `pnpm e2e` and `pnpm e2e:serve` makes its data folder in the system temp folder (`cty1ng-e2e-*`)
and removes it when it ends, after its servers have stopped, also after a failed run. A hard kill
(SIGKILL) leaves the folder behind.
Each server runs as its own process group. When you stop the script (Ctrl+C or SIGTERM), it
stops every process in each group and waits until they have stopped, so no old server stays on
the ports. A group that is still running after `E2E_SERVE_STOP_MS` (default 10000 ms) is
killed.

### Test helpers

| Helper | File | Use |
| --- | --- | --- |
| `renderApp(path)` | `frontend/test/render-app.tsx` | Component tests on the real app: routes, shell and providers on an in-memory address. Returns the Testing Library view and the router. Queries do not retry, so a failed request shows its error state at once. |
| `fakeApi(routes)`, `heldAnswer()` | `frontend/test/fake-api.ts` | Component tests: the fake network. A route is `"METHOD /path"` and answers a status and a body; `heldAnswer()` keeps a request open until the test answers it, for order cases. A success answer that the generated response schema refuses fails the test at `restore()`, so a wrong shape never turns a success test into a test of the failure path (lesson `fake-answers-match-the-api.md`). |
| `watchCsp(page)` | `frontend/test/e2e/csp.ts` | End-to-end tests: collects every CSP violation of a page; assert that the list is empty. |
| `readZip(buffer)` | `frontend/test/e2e/zip.ts` | End-to-end tests: the files of a downloaded zip (the skill export), by name. |

**Loops on microtasks.** A loop that awaits only resolved promises (a reader that returns
`Promise.resolve`) never lets a timer run, so Vitest's own timeout cannot stop it and the test
worker hangs. A test for "this waits" bounds the work instead: wrap the read with a counter that
throws after a small number of calls, then check that a zero-delay timer runs
(`backend/src/core/events/hub.test.ts`).

**Fake secrets.** Test code never holds text with the full shape of a real credential: GitHub
secret scanning reports it (`security.md` §2.11). A test of the likely-secret guard (D39) builds
the value at run time, for example `["sk", "proj", "abcdefghijklmnop1234"].join("-")`, or uses
a short value that the guard catches and a scanner does not (lesson
`no-real-looking-secrets-in-tests.md`).

### Themes (D30)

From M0, per `design/themes.md` §5: a token contrast test (WCAG AA), axe checks in every theme
and mode, Playwright visual snapshots of the key screens per theme and mode, and a
theme-switch leak test.

## 4. CI gates

All must be green to merge: ESLint (including the security rules in `security.md` §2.8),
Prettier, `tsc`, dependency-cruiser import rules (D35), Vitest, `db:check` (Drizzle schema
matches the migrations), Playwright, generated-client freshness, event-type list match,
`check:index` (folder indexes complete, `architecture.md` §4.2), the bundle budget
(`pnpm build`, then `pnpm check:bundle`), `pnpm audit --audit-level
high`, CodeQL (`security.md` §2.11). PRs touching security-sensitive paths also run the automated security review
(`security.md` §2.11).

## 5. Evidence in PRs

Apply the [prove tests work principle](../.agents/skills/principle-prove-tests-work/SKILL.md).
The PR maps each acceptance criterion to a test and its observable assertion or expected state.
Use a screenshot for purely visual criteria; Playwright stores these in `frontend/test/e2e/<spec>.spec.ts-snapshots/`.
"Tested manually" alone is not evidence.

Record the tested revision, expected failure and result. Test first normally supplies the failure evidence.
If a bug-fix test was written later, copy it into an isolated checkout of the code before the fix.
Use a `git worktree`; do not stash the fix (owner, 2026-10-31).
For other late tests, remove the required behaviour in the isolated checkout.
Stop every other end-to-end server first and check ports 8100 and 8101, as described in
[the fast loop](#fast-loop-while-building). Observe failure for the expected reason.

The incidents behind these rules remain in
[prove-the-test-fails-first.md](lessons-learned/prove-the-test-fails-first.md) and
[check-every-order-before-the-push.md](lessons-learned/check-every-order-before-the-push.md).
