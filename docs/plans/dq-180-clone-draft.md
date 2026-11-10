# DQ-180: a Clone draft stays when its source goes away

Brief: DQ-180 in [delivery-quality.md](../delivery-quality.md), found by the first review of [#91](https://github.com/binhle312/cty1ng/pull/91)
Checkpoint: owner decision (`AGENTS.md` §9: the failed rule is that of DQ-104)
Approval: approved 2026-11-10 (owner: "Do A", then "both in one PR")

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
