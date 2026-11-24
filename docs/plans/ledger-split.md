# Split the PR register and the prevention actions out of the ledger

Brief: the owner's answers of 2026-11-24 to the questions of PR #151: "Q1 A" (merge #151 first; the
limit rule change gets its own PR) and "Q2 C" (own files for the register and the prevention
actions; the 80,000-byte limit stays). Follow-ups row in `docs/status.md` (from #151).
Checkpoint: plan (it changes `AGENTS.md` §9 and the PR template: `AGENTS.md` §7)
Approval: owner, 2026-11-24, revision 1: "Approve both the plan and the split plan" (the plan, the two
file names, and the new words of `AGENTS.md` §9 under "Owner questions")
Revision 2, owner, 2026-11-24, after round 3 of the review of #153:
- S3-F1 (a second reader link that the searches missed; same cause as S1-F1): "Inventory by script".
  A script lists each link and section reference into the four delivery-quality files from the
  active docs, with its sentence and the heading it opens; each row is checked by its words.
- S2-F7 (ledger §7 step 2 and `AGENTS.md` §9 disagree on round rows): "No rows, fix §7". A PR with
  no milestone keeps its review rounds in its description; §7 step 2 says so.
- The new words of `AGENTS.md` §9, line 144 (owner, 2026-11-24): "the delivery records are updated
  as `docs/delivery-quality.md` §7 says".

## Goal

`docs/delivery-quality.md` stays below 80,000 bytes after the next move of closed rows. On `main`
after #151 (`764abde`) it has 90,225 bytes. §2 to §4 (19,409 bytes) and the prevention actions of
§7 (13,661 bytes) never move with closed rows, so moves alone cannot bring it below the limit.
(The plan was approved with the sizes at `fa19669`: 90,097 and 13,533 bytes. #151 changed one
prevention action after that.)

Done means: the ledger has about 57,600 bytes, each moved section is byte for byte the same in its
new file, `pnpm records:counts` gives the same counts, and each reader that the old text sent to
those sections now finds the new file.

## Design

1. **Two new files, with the same section numbers.**
   - `docs/delivery-quality-register.md`: `## 2. Milestone view`, `## 3. PR register` and
     `## 4. Historical evidence snapshots`, moved unchanged.
   - `docs/delivery-quality-prevention.md`: the `### Prevention actions` text and table, moved
     unchanged, under a heading `## Prevention actions`.
   - A short head in each file: what it holds, and that the rules of the ledger apply.
   - Why the same numbers: many records say "delivery-quality.md §3" or "§7 step 6". The numbers of
     the ledger (§1, §5, §6, §7) do not change, and §2 to §4 keep their numbers in the new file.
2. **Stub headings in the ledger.** `## 2.`, `## 3.` and `## 4.` stay as headings with one line
   each that links to the new file. `### Prevention actions` stays with one line that links to
   its file. Old links and old "§3" references in records then still lead to the right text. The
   stubs cost about 400 bytes.
3. **The counts script.** `LEDGER_FILES` in `scripts/records-counts.ts` gets the register file.
   The script already finds the milestone view and the register by their table header in any file
   of that list. Its message "no register row in <path> §3" stays true, because the register file
   keeps §3. If the file is not in the list, the script fails with "No file has the table of the PR
   register" (CI).
4. **Texts that send a reader to a moved section.** Each gets the new file name:
   - `AGENTS.md` §9: "search the prevention actions of `docs/delivery-quality.md` §7" becomes
     "search `docs/delivery-quality-prevention.md`". Needs the owner's approval of the words.
   - `.github/pull_request_template.md`: the same-cause line (prevention actions) and the register
     line.
   - `docs/workflows/pull-request.md`: the "Name the search of the prevention actions" sentence and
     the `grep` command, which gets the new file next to the ledger and the archive.
   - `docs/delivery-quality.md`: the head paragraph ("This file holds the rules, the register…"),
     §7 step 1 (the register), step 5 ("the rows of §2"), step 7 (the prevention action).
   - `docs/workflows/egm.md` (3 links to §3), `docs/testing.md` (`records:counts` and §2),
     `scripts/README.md` and the comment on line 1 of `scripts/records-counts.ts`,
     `docs/README.md` (the map row), `docs/status.md` line 4.
   - Records of history (old plans, archive rows, lessons) do not change. The stubs serve them.
5. **No new size rule.** The limit of §7 step 6 stays for the ledger file only. The new files get
   no limit in this PR (scope: the owner's answer named the ledger limit only).

Not a code design checkpoint: no shared state, no module boundary, no screen flow. One list in a
script gets one more entry.

## Other options (rejected)

- New section numbers in each file (`## 1. PR register`): cleaner files, but each old "§3"
  reference then points to the wrong section. Rejected.
- No stubs: about 400 bytes less, but old links break, and agents that remember "§3 of the ledger"
  find nothing. Rejected.

## Proof (as in #151, rule of §7 step 6, owner 2026-11-24)

A script in the PR description, not in the commits, shows:

1. Each line of base §2 to §4 is in `docs/delivery-quality-register.md`, in order, with no change.
2. Each line of the base prevention actions is in `docs/delivery-quality-prevention.md`, in order,
   with no change.
3. The ledger lost only those lines, and got only the stub lines and the changed sentences of
   design step 4.
4. `pnpm records:counts --write` on the head changes no file (the counts are the same).

## Test strategy

| Behaviour | Test | Cases beyond the normal path |
|---|---|---|
| The script finds the register in a second file of `LEDGER_FILES` and writes its counts there | `scripts/records-counts.test.ts`, a fixture with the register in its own file | The register in two files (the existing "Two tables" test); the register file missing from the list ("No file has the table") |
| The real files give the same counts | `pnpm records:counts` in CI, and step 4 of the proof | A count cell that `--write` would change |
| Every moved line is unchanged | Proof steps 1 to 3 | A one-byte change in a moved row makes the proof fail (one break, run by the builder) |
| No reader text points to the old place | `grep -rn 'delivery-quality.md.*§[234]\|prevention actions of' --include='*.md' --include='*.ts'` outside history records | A link with an anchor `#3-pr-register` |

If the existing tests already prove the first row, the builder names that test and adds none.
A break list for the script change follows `docs/testing.md`.

## Build and review

- Branch `ledger-split` from `main` after #151 merges. Worktree `../cty1ng-ledger-split`.
- Builder: a Codex worker, `gpt-6.2-sol`, effort high (a script line, a proof, many text edits).
- Reviewer: a new Codex session, `gpt-6.2-astra`, effort high, with its own worktree to run the
  proof.
- Records: no milestone, so no register row. Guide: not changed (no new page, command, action or
  choice for the owner).
- After the merge: I update my own notes that name "delivery-quality.md §7" for the same-cause
  search.

## Owner questions

1. Approve this plan, with the two file names `docs/delivery-quality-register.md` and
   `docs/delivery-quality-prevention.md`.
2. Approve the new words of `AGENTS.md` §9: "search `docs/delivery-quality-prevention.md` and the
   lessons" in place of "search the prevention actions of `docs/delivery-quality.md` §7 and the
   lessons".
