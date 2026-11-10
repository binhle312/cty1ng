# DQ-180: a Clone draft stays when its source goes away

Brief: DQ-180 in [delivery-quality.md](../delivery-quality.md), found by the first review of [#91](https://github.com/binhle312/cty1ng/pull/91)
Checkpoint: owner decision (`AGENTS.md` §9: the failed rule is that of DQ-104)
Approval: approved 2026-11-10 (owner: "Do A", then "both in one PR"); the redesign of the page fix: owner, 2026-11-10, option B

Owner decisions of 2026-11-10: the Clone page gets its fix in its own PR on `main`, before #91
(option A). Create also works when the source is in Trash or gone. Both changes are in this
PR. The link rule of the copy changed after the first review: see the last section.

## Defect

1. The owner opens Clone on a skill and types in the form.
2. The source skill goes to Trash, from another tab.
3. The Clone page reads its source again. On `main` this occurs after a `reset` event, and
   when the browser is online again (`refetchOnReconnect` of the query client; found by the
   review of `c38b698`). With #91 it occurs on each return to the tab.
4. The page shows Page not found, and the typed text is gone.

Reproduced on `main` (`76f6b2d`): `new-skill-page.test.tsx` "keeps the editor and the typed text
when the source skill is no longer listed" fails with `the draft: expected null to be ...`.

## Cause

- The general rule: after an editor opened, a later read does not close it
  (`frontend-conventions.md` §5; DQ-104).
- The first wrong decision: `useCloneSource` gives `null` when no listed skill has the version,
  and a skill in Trash is not listed. `null` is a good answer, so TanStack Query replaces the
  data. The page shows Page not found for `null` at each read, not only at the first one. A
  failed read does not have this effect, because it keeps the old data.
- The state can occur: the owner can move a skill to Trash at any time. So the read must
  handle it.

Search for the same property, a good answer that closes an open editor:

| Place | Result |
| --- | --- |
| Clone of a bot (`create-bot-page.tsx`) | Safe from reading: a source that is gone is a 404 error, and the page looks only at the first answer |
| Skill page and bot page, item in Trash | The owner accepted this on 2026-11-05 (audit decision 3, `bot-page.md` §4.2): the page of an item in Trash closes |
| New skill with no source | No read of a source |
| Dialogs | The builder did not check them. The reviewer of `c38b698` read five dialogs and found no such case; this was a read, not a full trace |

## Fix

1. **Page.** When a later read finds no listed skill with the version, `useCloneSource` keeps the
   source that the editor opened with. A first read with no match still gives Page not found.
   No new state: the kept value is the data of the same query.
2. **Server.** `POST /skills` with a `cloned_from_skill_version_id` whose skill is in Trash or
   does not exist makes the skill. Before, it answered 422 "The skill to copy does not exist."
   The request and answer shapes do not change. The link rule changed after the first review:
   see the last section.

No migration, no new dependency, no new screen text.

## Test strategy

Each test is written before its code, and its run on the code before the change is recorded.

| Behaviour | Level | Cases |
| --- | --- | --- |
| A later read with the source gone keeps the editor and the text | Component, `new-skill-page.test.tsx` | A full read (`invalidateQueries()`, what `reset` and #91 do) after the list lost the source. It is an order test, so it also has a break |
| A later read after the browser is online again keeps the editor and the text | Component | The second trigger on `main`; added after the review of `c38b698` |
| A first read with no match shows Page not found | Component | A rule that the fix must keep |
| A second visit after the source went away shows Page not found | Component | The companion rule of the fix: the kept value lives only while the page is open (`gcTime: 0`); added after the review of `c38b698` |
| The server makes the copy | Service, `skills.service.test.ts` | The source in Trash: the link stays. The source purged: no source |
| The HTTP answer is 201 | API, `backend/test/api/skills.test.ts` | The source in Trash |
| The whole flow in a browser | End to end, `skills.spec.ts` | Open a Clone, type, move the source to Trash through the API, click Create: the copy opens with the typed text |

Not covered here: the return to a tab. #91 adds that test when it takes `main`.

## Changes after the first review (owner, 2026-11-10)

- **A source in Trash keeps the link.** The first version of this PR gave no link for a source
  in Trash or gone. The review showed three different link rules: a copy made before its source
  goes to Trash keeps the link, a copy made after got none, and a bot Clone keeps the link to a
  source in Trash. The owner chose one rule: the copy records its source while the source
  version exists. A version that does not exist gives no source.
- **D14 gets a dated amendment** for the two cases with no origin (DQ-188).

## Redesign of the page fix (owner, 2026-11-10: option B)

Checkpoint: owner decision (`AGENTS.md` §9). An owner-pasted review of `279500b` found a P2
with the cause of DQ-185. The owner chose to replace the mechanism in this PR, not in a new
one. This section is committed before the code of the redesign.

### The finding

1. The Clone page is open, and a full read of its source starts.
2. The owner leaves the page and returns before the answer arrives.
3. The answer arrives: no listed skill has the version.
4. The old editor stays. The rule says Page not found.

Reproduced on `279500b`: the test "shows Page not found on a second visit that returns before
a pending read ends" fails there, and passes on the page code of `76f6b2d`.

### Cause

The first fix kept the opened source in the query cache, and relied on `gcTime: 0` to drop it
when the page closes. TanStack Query removes a query only when no read is on its way
(`optionalRemove` in `query.js` of the installed version). So a pending read keeps the old data,
and the fallback gives it to the next visit. DQ-185 had the same cause: the kept value lives as
long as the cache, not as long as the open editor. The cache is the wrong owner.

### Design

One owner: the page instance of one Clone (`ClonePage`, one mount for each `from`) holds the
source that its editor opened with.

| State of the mount | A good answer with the source | A good answer with nothing | A failed read |
| --- | --- | --- | --- |
| No source of this visit yet (also when the cache has old data) | Keep this source. Open the editor from it when the settings wait has ended | Page not found | The load error with Try again |
| A source of this visit, the settings wait | Stays | Stays: the editor opens from the kept source | Stays |
| The editor is open | Stays. Create uses the newest slugs of the answer | Stays, with the source that it opened with | Stays |
| Page not found shows | Keep this source and open the editor from it | Stays | The load error with Try again |

- "A good answer of this visit" is `isFetchedAfterMount` with a good status. `isFetchedAfterMount`
  counts for each mount and cannot go back. The status can go back, when a later read fails. So
  the mount keeps the source at once, when the good answer arrives; after that it does not ask
  the query if an answer came (`frontend-conventions.md` §5; review of `6ab9430`, DQ-194).
- The source read tells the truth again: `null` when no listed skill has the version. The cache
  fallback goes.
- `gcTime: 0` goes. A visit opens only from an answer of that visit, so the data that the cache
  keeps from an earlier visit is never used, for the source and for its slugs.

Options compared:

| Option | Gain | Cost |
| --- | --- | --- |
| **The mount holds the opened source** (chosen) | The value lives exactly as long as the editor. A new visit decides from its own answer | One small component and one state |
| Keep the cache fallback and clear the query when the page closes | Fewer lines | A second rule about the cache lifetime, with the same owner problem: the next pending read brings it back |
| A reducer module for the page (`new-skill-page-state.ts`) | One pure table with a test for each cell | More code than the three rules above need. The owner kept such a move out of #78 (audit file, "Decisions during PR 3") |

### Test strategy

Component tests in `new-skill-page.test.tsx`, each with a break in `scripts/breaks/pr-92.json`,
because they are order tests. The table rows of `testing.md` §3 that the review found missing
are marked.

| Behaviour | Case |
| --- | --- |
| A full read with the source gone keeps the editor and the text | A change in another tab; an intervening load |
| The same when the browser is online again | The second trigger on `main` |
| A failed read after the editor opened keeps the editor and the text | **A failed request** |
| The source goes away, comes back, and goes away again: the text stays | **A value that changes and changes back** |
| A first read with no match shows Page not found | The rule that the fix must keep |
| A second visit after the source went away shows Page not found | No pending read; the cache has the old source |
| A second visit proposes the next free slug when a copy took the first one | The slugs come from the read of this visit (`skills-page.md` §12) |
| The editor does not open while the settings are on their way | The settings wait |
| A read that fails during the settings wait does not stop the editor | **A failed request** during the wait; DQ-194 |
| A second visit that returns before a pending read ends shows Page not found | **A late answer**; the P2 |
| A second visit that returns before a pending read ends opens the editor from the new answer, not from the old data | **A late answer**; the form fills from the read of this visit |
| A second visit whose read fails shows the load error, not the old editor | **A failed request** on a return |
| A first read that fails, then Try again with the source gone, shows Page not found | **A failed request**, then a retry |

The row "the source goes away, comes back, and goes away again" is a guard for the whole order.
Its break is the break of the first row and fails at the first step, so it proves no more than
that row (review of `6ab9430`, DQ-195).

Not in scope: the Clone of a bot has `gcTime: 0` for its template too (`create-bot-page.tsx`),
so a return during a pending read can fill its form from old data. It goes on the P3 list.

