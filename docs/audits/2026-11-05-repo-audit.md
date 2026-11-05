# Repository audit, 2026-11-05

Status: **all seven owner questions have answers. Fixes follow the approved order.** No code finding is fixed by this file.

This file holds the results for the next agent. It is a record of one audit, not a specification. If it disagrees with the code at a later commit, check the code first.

## Start here (for a new chat)

1. Read "Owner decisions", "Approved fix order" and "Fix progress" below. If a question has no answer, continue with it.
2. Ask the owner one question at a time. Give a detailed explanation, an example and a recommended answer.
3. After each answer, update "Owner decisions" in this file.
4. When all questions have answers, follow the approved fix order below. Check which PRs exist first (`gh pr list`).
5. Do not start M3, and do not merge #69. Both wait for the end of this plan.

The plan comes from the owner, 2026-11-04: audit, owner review of each finding, fixes in small draft PRs by module, second audit, merge #69, and then M3. The coding standard is parked, so this audit checks the code against `docs/` and `AGENTS.md`.

## Owner decisions

| # | Question | Recommendation | Answer |
| --- | --- | --- | --- |
| 1 | What is the rating of the Save finding (row 1a)? | P2 | **P2** (owner, 2026-11-05). Fix it in one PR with the P3 "types an edit back during a conflict" |
| 2 | Is six open app tabs normal use (row 14)? | Rate P2, and fix before M3 | **P2, fix before M3** (owner, 2026-11-05). Show the owner a one-page design first |
| 3 | If another tab moves a skill to Trash, can the skill page lose unsaved text (row 15)? | Accept it, and write it in `skills-page.md` | **Accepted** (owner, 2026-11-05). Docs change only: `skills-page.md` takes the rule of `bot-page.md` §4.2. The P3 "unknown skill URL loses the whole shell" stays |
| 4 | Do we widen the sensitive data guard (row 4)? | Yes, keep P2 | **Widen now, keep P2** (owner, 2026-11-05). Catch prefixed names, the JSON form and long hex, with a test for each form. D39 does not change. Placeholders get no exception, so `DB_PASSWORD=changeme` is refused. Owner approval is given for this change; the PR still lists it under `Needs human review` |
| 5 | Do we keep the touch swipe requirement (row 13)? | Drop it | **Dropped** (owner, 2026-11-05). The owner uses a laptop or a desktop, with a touchpad and a mouse. Remove the sentence from `docs/tasks/M2-bots.md:160`, `docs/requirements/app-shell.md:87` and `docs/design/components/top-header.md:29`. In its place, add a test that the wheel and a two-finger motion scroll the roster. The tap and long press code and tests stay |
| 6 | Do you approve the fix order below? | Yes | **Approved** (owner, 2026-11-05) |
| 7 | What are the owner's PR #59 issues? | Add them to this list before the fixes start | **Closed** (owner, 2026-11-05). #59 is merged, so its remaining issues are in the audited code, and these findings count as them. If the owner names one that is not on this list, add a row |

**Approved fix order** (small draft PRs; bug fixes and style-only changes stay separate):

1. Docs only: the rules from questions 3 and 5, and this file.
2. Security: widen the guard (row 4) and limit the `SKILL.md` parse cost (row 5). One PR, because it starts the paid security scan. List both under `Needs human review` (`AGENTS.md` §7).
3. Skills page: rows 1a, 3, 6 and 7, with the P3 "types an edit back during a conflict".
4. Bots page: rows 1 and 2.
5. Tests only: rows 8, 9, 10, 11, 12 and 13.
6. Six tabs (row 14): a one-page design for owner approval first, then code. It includes the P3 "the stream does not come back in `make dev`".
7. Other P3 marked "Fix before M3": the migration rebuild, the TypeID 500 and the error boundary. GitHub required checks are a repo setting: give the owner the steps, or set them only if the owner asks.

After these: the owner fixes or drops each of the other 34 P3 findings. Then one style-only PR for the 104 `max-params` places, a second audit, the merge of #69, and M3. The coding standard stays parked until the owner restarts it.

**Decisions made during PR 2** (owner, 2026-11-05):

- The frontmatter limit for row 5 is 8,192 characters. The largest valid export has about 6.2 KB, so a much lower limit is not possible.
- The import preview pauses between rows. A review showed that a 35 KB zip with 200 folders under the limit still blocked the server for about 15 s.
- A password value still needs 4 or more characters. In `"password": "x"`, `x` means any value.

## Fix progress

Each fix PR updates its row in the same PR. Check `gh pr list --state all`, because this table can be behind.

| PR | Scope | State |
| --- | --- | --- |
| 1 | Docs only | merged: #71 |
| 2 | Security | draft: `fix-audit-security` |
| 3 | Skills page | not started |
| 4 | Bots page | not started |
| 5 | Tests only | not started |
| 6 | Six tabs | not started |
| 7 | Other P3 for M3 | not started |

## Result

Commit `1c413b3` on `main`. The audit changed no repo files. At that commit, all gates passed: lint, typecheck, 1,360 unit tests, 71 e2e tests, `check:index`, `check:events`, `db:check`, build and `check:bundle`.

This list combines two audits. It has 55 findings. After the owner's decisions, 15 are P2, 39 are P3, 1 is an accepted case, and none is P1. The second audit gave 4 findings: 3 are new, and 1 was already on this list. It rated one finding P1, and the owner rated it P2 (row 1a).

"Checked" means that the lead ran the case or read the code again. "Reviewer" means that only the reviewer's evidence supports the finding.

## P2: wrong behaviour

| # | Finding | First wrong code | Evidence |
| --- | --- | --- | --- |
| 1a | A live refresh can replace text typed during a Save. This occurs only if the owner types all fields back to the last saved text and the refresh comes before the Save answer. The bar then says "All changes are saved." Other new text stays. Second audit: P1. Lead: P2, because the replaced text is the previous version, which stays in History. It has the same cause as the P3 "types an edit back during a conflict". | `frontend/src/features/skills/skill-page.tsx:133` | Checked in a real browser: 4 cases, and only this case fails |
| 1 | Esc with unsaved changes does nothing on the bot page. The dialog opens and closes at once, so the owner sees nothing. The test passes only because `act()` hides the failure. | `frontend/src/features/bots/bot-page.tsx:277`, test at `bot-page.test.tsx:1363` | Checked in a real browser: 0 dialogs after Esc, 1 after a Discard click |
| 2 | A second Clone of a bot starts from cached old data. Create then sends the old persona, tools and pins. | `frontend/src/features/bots/create-bot-page.tsx:94`, `:219` | Checked in a real browser: the form has the old persona after the source changed |
| 3 | If the owner deletes the last active skill, the app shows Page not found and the toast goes. The reviewer also saw the shell go. | `frontend/src/features/skills/skill-page.tsx:353` | Checked in a real browser: 4 of 4 runs with a held list answer. It depends on timing: one run with no hold reached the empty state, but the toast was not seen |
| 4 | The sensitive data guard misses `DB_PASSWORD=`, `"password": "x"`, `GITHUB_TOKEN=`, `access_token:`, `client_secret=` and hex secrets. | `backend/src/core/guard/sensitive-data.rules.ts:45`, `:59`, `:137` | Checked by a script. D39 accepts that patterns are incomplete, so the owner can lower this finding |
| 5 | A hostile `SKILL.md` blocks the whole server. | `backend/src/core/skills/skill-md.ts:25` | Checked: 12.4 s for 389 KB of frontmatter, and the time grows quadratically. The limit is 1 MB for each file |
| 6 | If the owner leaves the page, a failed Import Apply, Save, rename or Create shows nothing. The bot page and the dialogs show a toast. | `frontend/src/features/skills/import-page.tsx:126`, `skill-page.tsx:183`, `new-skill-page.tsx:201` | Code read by the lead; run by the reviewer |
| 7 | Skill Clone and "Clone to edit" fail silently if their read fails. | `frontend/src/features/skills/skill-page.tsx:258` | Code read by the lead; run by the reviewer |

## P2: missing proof

For the first five rows, the reviewer changed the code in a scratch copy of the build, and the tests still passed.

| # | Requirement with no real test | Where |
| --- | --- | --- |
| 8 | Invariant 21: a restore never assigns a skill to a bot | `backend/src/core/bots/bots.service.test.ts:728` |
| 9 | API keys never appear in a response. The test calls 5 of 37 operations, and its stream check reads no event. The security reviewer rated this P3 | `backend/test/security/secrets.test.ts:13` |
| 10 | The guard on a bot's name and description at create, and on its name at PATCH | `backend/src/core/bots/bots.service.ts:356`, `:415` |
| 11 | CL2: a Clone whose model left the catalog starts with an empty model | `frontend/src/features/bots/create-bot-page.tsx:171` |
| 12 | The header roster stops moving while the pointer is in the header | `frontend/src/features/shell/header-roster.tsx:263` |
| 13 | The wheel and a two-finger touchpad motion scroll the roster (`top-header.md` state 3). The code exists, but the only wheel test scrolls `main` (`frontend/test/e2e/shell.spec.ts:52`). This row replaces the touch swipe, which the owner dropped. Mouse drag has tests (`frontend/test/e2e/bots.spec.ts:130`, `:312`, `:409`) | `frontend/src/features/shell/header-roster.tsx:290` |

## Rated by the owner

| # | Finding | Owner's decision |
| --- | --- | --- |
| 14 | With six app tabs open, every request in every tab hangs with no error. Each tab holds one stream, and the browser allows six connections for each host. Reviewer evidence: `frontend/src/lib/realtime/sse.ts:30` | **P2**, fix before M3 (question 2) |
| 15 | Trash in another tab removes the unsaved text on a skill page with no question. The bot page accepts this result in `bot-page.md` §4.2, but `skills-page.md` has no such rule. Code read by the lead: `frontend/src/features/skills/skill-page.tsx:101` | **Accepted**: `skills-page.md` takes the rule, and no code changes (question 3) |

## P3

The lead did not check these again, except where a row says so. The others are from reviewer evidence.

### Backend and data

- A migration that rebuilds a parent table with rows fails at startup. `PRAGMA foreign_keys=OFF` does nothing in a transaction: `backend/src/adapters/db/migrate.ts:20`. No shipped migration does this today. **Fix before M3.**
- A description that ends in two newlines changes after export and import: `backend/src/core/skills/skill-md.ts:21`.
- A new assign can pin an older version, and the docs do not agree on the rule: `backend/src/core/bots/bots.service.ts:579`.
- One purge item that fails blocks all later items: `backend/src/core/skills/skills.service.ts:526`, `backend/src/core/bots/bots.service.ts:711`.
- `trashed_bot_ids` is not parsed on read and holds TypeIDs: `backend/src/adapters/db/repositories.ts:267`.
- The import preview id does not use the ids port: `backend/src/core/skills/skill-import.service.ts:253`.

### Security

- `lineDiff` has no budget: 24.5 s for a body of 20,000 characters: `backend/src/core/skills/skill-diff.ts:8`.
- The dev page has no CSP or `frame-ancestors`: `frontend/vite.config.ts:18`.
- The paid security review does not watch the model adapters, `skill.rules.ts`, `bot.rules.ts`, `main.ts`, `compose.ts` and other paths: `.github/workflows/security-review.yml:20`.
- Refused requests carry no security headers, and the plan and `security.md` disagree: `backend/src/adapters/http/app.ts:61`.
- The changelog has no length limit, and its regex is quadratic: `backend/src/adapters/http/routes/skills.ts:34`, `backend/src/core/skills/skills.service.ts:584`.
- No test covers an absolute zip path or a forged entry size, or checks secrets through the CLI: `backend/src/adapters/http/uploads/skill-zip.test.ts`.

### API and realtime

- A TypeID with the right shape gives 500 on most routes, not 422 or 404: `shared/src/ids.ts:7`, `backend/src/adapters/db/columns.ts:11`. **Fix before M3.**
- In `make dev`, the stream does not come back after a backend outage longer than the 2 s retry: `frontend/src/lib/realtime/start.ts:14`. **Fix before M3.**
- CLI changes do not wake the server's event stream, so open pages stay old until the next server write, a reconnect or a window focus. Second audit; code read by the lead: `backend/src/core/events/hub.ts:103`.
- An event that commits between the first GET and the first `ready` does not reach the page. The spec has this gap too: `frontend/src/lib/realtime/reducer.ts:34`.
- `field` in a 422 has two formats: `pins.0.skill_id` and `pins[0]`: `backend/src/adapters/http/router.ts:19`.
- Repeated items are not refused in import apply and export. An empty `ids=` gives an empty zip: `backend/src/core/skills/skill-import.service.ts:282`, `backend/src/adapters/http/routes/skills.ts:393`.
- Three inputs skip strict parsing: `backend/src/adapters/http/routes/skills.ts:32`, `backend/src/adapters/http/app.ts:85`, `shared/src/bots.ts:198`.

### Bots pages

- A late Delete answer moves the owner off the page they went to: `frontend/src/features/bots/delete-bot-dialog.tsx:38`.
- "Focus the first error" does nothing for fields with no `aria-invalid`: `frontend/src/features/bots/create-bot-steps.tsx:739`.
- Try again never shows the sending state: `frontend/src/features/bots/create-bot-page.tsx:366`.
- A server error on `cloned_from_bot_id` shows on no step and blocks Create: `frontend/src/features/bots/create-bot-form.ts:110`.
- A ticked skill that another tab deprecates shows as "A skill in Trash": `frontend/src/features/bots/create-bot-page.tsx:592`.

### Skills pages and shell

- Late answers from Restore, Import and Trash move the owner off the page they went to. Both audits found the Import case: `frontend/src/features/skills/skill-history.tsx:223`, `import-page.tsx:119`, `skill-page.tsx:352`.
- Skill Clone can split an emoji, and the saved name then holds "�". The Clone form shows the name first, so the owner can correct it. Second audit; checked through the API by the lead: `shared/src/skills.ts:142`.
- An unknown skill URL loses the whole shell: `frontend/src/features/skills/skill-page.tsx:101`.
- If the owner types an edit back during a conflict, the bar says "saved" over old text: `frontend/src/features/skills/skill-page.tsx:131`.
- A failed background refresh replaces the History tab: `frontend/src/features/skills/skill-history.tsx:79`, `:262`.
- "Close this card and try again" does not try again: `frontend/src/features/skills/skill-dialogs.tsx:50`.
- The app has no error boundary, so a failed lazy chunk replaces the whole app: `frontend/src/router.ts:8`, `frontend/src/features/shell/top-header.tsx:11`. **Fix before M3.**
- The Export card counts a skill that left the list: `frontend/src/features/skills/export-card.tsx:74`.

### Tests and tooling

- Invariant 7: no test proves `bot.updated` on `POST /skills/{id}/bots`, or `trash.changed` on a bot purge: `backend/src/core/bots/bots.service.ts:680`, `:695`.
- GitHub requires no status checks, so a PR with a red gate can merge: `docs/testing.md:296`. **Fix before M3.**
- `db:check` does not read the migration SQL, so a hand edit passes: `scripts/db-check.ts:31`.
- Lint guards are narrower than the text that relies on them, and `pnpm lint` allows warnings: `eslint.config.js:19`, `:50`.
- The Guide skill omits "Make active again" and "Show deprecated": `seed/skills/using-the-app/SKILL.md:30`.
- Some e2e tests wait a fixed time and then check that nothing happened (plausible only): `frontend/test/e2e/bots.spec.ts:290`.
- A test holds a full-shape AWS example key: `backend/src/core/guard/sensitive-data.rules.test.ts:9`.

## Limits

- Not reached: real-browser avatar upload and touch drag, the order that each race test forces in the service tests, GitHub secret scanning settings, and decoder fuzzing.
- The owner's list of PR #59 issues is not in this audit, because the owner has not given it yet.

## How to repeat the key checks

The probes were temporary files and are gone. To repeat them, use a real browser with a real backend, and hold the request with `page.route`.

- **Row 1a:** create a skill and change Description. Click Save, and hold the POST. Type Description back to the old text. Send the POST, but hold its answer until the refresh arrives. The field then shows the sent text, and the bar says "All changes are saved."
- **Row 1:** on a bot page, type in Name and press Esc. No dialog stays open.
- **Row 2:** clone a bot from the Bots page and leave. Change the source bot's persona through the API, and clone again without a reload. The form has the old persona.
- **Row 3:** deprecate and delete the only skill, with `page.route` on `GET /api/skills`. The page ends on "Page not found".
- **Row 5:** call `parseSkillMd` with 40,000 unique frontmatter keys (389 KB). It takes about 12 s.
