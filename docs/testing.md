# Testing

This document owns how the app is verified. The goal is that an agent can prove a change works
without a human clicking around, and that a human reviewer can trust the proof.

## 1. Layers

| Layer | Tool | Location | What it proves | Speed |
| --- | --- | --- | --- | --- |
| Domain | pytest, table-driven | `backend/tests/domain/` | Routing, budget, history window, mention parsing | ms |
| Service + DB | pytest, temp SQLite per test | `backend/tests/services/` | Invariants (`domain-model.md` §12), transactions, events written | fast |
| API | pytest + httpx `AsyncClient` | `backend/tests/api/` | Status codes, error codes, schemas, origin checks | fast |
| Agent | pytest + Pydantic AI `FunctionModel` / `TestModel` | `backend/tests/agent/` | Prompt assembly, tools, provenance, streaming, cancellation | fast |
| Security | pytest + Vitest | `backend/tests/security/`, `frontend/tests/security/` | `security.md` §3 | fast |
| Frontend unit | Vitest + Testing Library | `frontend/tests/` | Components, reducer, mention autocomplete, icon composition | fast |
| End to end | Playwright, fake model | `frontend/tests/e2e/` | User journeys across the real backend | slower |
| Contract | CI script | — | Generated client up to date; event type lists match | fast |

## 2. The fake model

Tests never call real providers (`AGENTS.md` §8).

- The backend accepts `FAKE_MODEL=1`; the catalog then exposes `fake:scripted` (available, no
  key) and `catalog/` returns a Pydantic AI `FunctionModel`.
- The function reads a **script** keyed by bot slug from `tests/fixtures/fake_scripts/*.yaml`:

  ```yaml
  ba:
    - when_contains: "login"
      tool_calls:
        - load_skill: {name: write-user-stories}
        - write_file: {path: out/ba/stories.md, content: "# Login stories\n..."}
      reply: "I wrote out/ba/stories.md. @Designer can you sketch the screens?"
  designer:
    - reply: "Two screens: sign-in and reset. @BA agreed?"
  ```

- Streaming is simulated by splitting the reply into chunks, so delta handling is tested.
- A fixture `fake_model(scripts)` is available to backend tests; Playwright starts the backend
  with `FAKE_MODEL=1` and a chosen script set.

## 3. What must be tested

### Domain (`decide_runs`)

One table row per case in `conversation-rules.md` §1 and §2, plus:

- budget reset on human message and on edit;
- mention order and duplicates;
- three bots mentioned with one turn left;
- pending, removed, deleted and unavailable bots;
- a bot mentioning itself;
- limit lowered below `used` mid-discussion;
- discussion off with bot mentions present.

`visible_history`: `history_from_seq` cut, branch path selection, `(you)` labelling, size
trimming with the omission marker, and a later bot from the same message seeing the earlier
bots' replies (D31); the shared history budget (D32) with a small and a large
`context_window`, the per-bot `history_share_pct` (10, 40, 80), newest-first filling across transcript and runs, and
`run_history` excluding runs from an abandoned branch.

Run status reactions (UI-3.18): a Vitest reducer test that `run.queued` → `run.started` →
`run.finished` replaces one reaction per bot, including failed, stopped and replayed events.

### Services and API

Each invariant in `domain-model.md` §12 has a named test (`test_invariant_01_model_immutable`
…). Plus: skill import preview/apply (including "changed since preview" → 409), clone
templates, upgrade dialog only moving checked pins, deprecation rules, edit while running →
409, branch switching picks the newest leaf, event `seq` strictly increasing, replay after
`Last-Event-ID`, `reset` for an old cursor.

### Agent

Prompt contains persona, rules block with correct numbers, always-loaded bodies, on-demand
list; `load_skill` returns the pinned version (not latest); `run_skills` matches; Stop cancels
mid-stream and keeps partial text; retry after a crash reuses the same message.

### End to end (Playwright)

`e2e/journey-first-use.spec.ts` follows J1 from `requirements/product-brief.md`, then continues:

1. create skill → create bot BA with it → create conversation;
2. drag BA from the header into the chat → choose "Full history";
3. `@` shows only BA → send → reply streams → chip `write-user-stories v1` visible;
4. add Designer via "Add bot" → enable discussion with limit 2 → bots stop after 2 turns with
   the notice;
5. Stop button during a run → message shows "Stopped";
6. edit the first message → ‹ 2/2 › appears → switch back to ‹ 1/2 ›;
7. edit the skill → v2 → BA still shows v1 on the next reply → upgrade → v2 chip;
8. delete BA → its messages are grey;
9. reload the page → identical state.

Each slice's brief lists which of these steps must pass by its end.

### Themes (D30, proposed)

From M0, per `design/themes.md` §5: a token contrast test (WCAG AA), axe checks in every theme
and mode, Playwright visual snapshots of the key screens per theme and mode, and a
theme-switch leak test.

## 4. CI gates

All must be green to merge: ruff (lint + format), pyright, pytest, `alembic check` (models
match migrations), tsc, eslint, Vitest, Playwright, generated-client freshness, event-type
list match.

## 5. Evidence in PRs

A PR description maps each acceptance criterion of its task to the test that proves it, or to a
screenshot for purely visual criteria (Playwright can save screenshots:
`frontend/tests/e2e/__screenshots__/`). "Tested manually" alone is not evidence.
