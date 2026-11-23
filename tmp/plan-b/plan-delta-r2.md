# PR #140 plan delta r3

Brief 14 · Branch `pr140-plan-a` · Reviewed head `808e4fe`. Use this delta where it differs from r1. Orders 153–155 and 157–159 govern this design. Plan approval and exact wording review are pending. Order 153 keeps both redesigns and cleanup in #140. The next review is round 2 under the reset cap.

### r3 changes

- G06 and §3 put the synced journal init at dispatch (ruling 1).
- §1 adds the main pin, rehearsal and cleanup gates. G07 cites the queue and auto-merge rule. G01 and G16 use the approved freeze and retry rules (rulings 2–3).
- G11 and §6 use the latest required checks on the exact main SHA. G13 and §3 define the Ready fields, bounded reads and failure outcomes (rulings 4–6).
- G15–G17 and §5 cover ignored output and verified ref absence. §11 states the journal restore and branch recreation limits (rulings 7–9).
- §3 gives the exact §10 sentence. §8 puts the private required-check trial first. §§3–6 add the named breaks (rulings 10–12).
- Brief 15 adds the G15 mount and device checks before cleanup, with an A16 refusal case and a device-check break.

## 1. Closed gate table and walk

| Gate | Field read | Value on cty1ng today | Hold condition | Owner order or ruled finding |
| --- | --- | --- | --- | --- |
| G01 · `new`, then `go` | At `new`, run UUID, exclusive folder and format. At `go`, completed card, exact merge targets and review cap. | Local night not probed. | Invalid run state or incompatible format. Retry a UUID collision. At `go`, refuse a malformed card, duplicate target or invalid cap. Freeze the valid cap at `go`. | B57–61, B78. Orders 137, 143, 153. R25. |
| G02 · `new`, freeze at `go` | Chief's automation baseline per repository and owner order reference | Five active IDs, one disabled ID, two blob IDs and zero repo hooks. See §4. Card not probed. | Missing, malformed or unapproved baseline for a merge target. | Order 158, R06 |
| G03 · before review and grant | Owner go and amendments, task class, current scope and plan check, assignment, reviewer pair and start ID | not probed | No authority for the exact PR, owner-only class, unchecked plan, unmatched pair or start, or checkout outside the review requirements. | Orders 137, 138, 140, 143, 148; R04, R12, R22 |
| G04 · grant and merge | Both original verdicts, full head, active plan and assignment IDs, current findings, PR body dispositions and cap | not probed | Missing or stale evidence, an open P1 or P2, an unresolved P3 under the round rules, or cap hold. | Orders 137, 143–145, 148, 153; R03, R04, R11–R13, R19, R29 |
| G05 · grant, merge and clean | Bound paths, stable lock and marker, journal format and replay, repair state, real clock, night phase and stop | not probed | Wrong path, unavailable lock, stale marker, unsupported format, journal fault, repair pending, fake clock on a real night or inactive night. | Orders 141, 149, 150, 159; R01, R02, R10, R16, R17, R25 |
| G05a · rehearsal | Frozen `go.rehearsal` on applicable review, grant and merge paths. | Local night not probed. | `NO_REHEARSAL` unless the card says `passed` or `owner-override`. | B122, B172. `night_rules.py:204,587`. |
| G06 · dispatch, then every gate that uses the assignment | Synced init with run, leader and exact PR target. Check grant, method, claim history and reservation where applicable. | Local night not probed. | After dispatch, a missing journal or missing or mismatched init refuses the gate. Refuse an invalid, duplicate, stale or used grant. An unresolved reservation holds the next grant. | Orders 137, 141, 159. R02, R03, R26. Brief 14 ruling 1. |
| G07 · grant and merge before Ready | Live PR number, repo IDs, head and base refs, full head, open/draft/merged state, mergeability, allowed method and queue or auto-merge policy | #140 is open, draft, unmerged, same repo and clean. Squash is allowed. Auto-merge is off. No queue rule in the effective branch list. | Wrong target or head, fork, closed PR, conflict, prohibited method, queue or auto-merge. A draft can receive a grant and reach Ready. | B29, B81 for queue and auto-merge. Orders 137, 154, 157. R05, R06. |
| G08 · grant and merge | All PR file pages and count, rename source and destination, exact reviewed diff and assigned scope | #140 has 45 files in the original probe. Rename not probed. | Incomplete or conflicting file evidence or out-of-scope path. | Order 158; R06, R22 |
| G08a · grant and merge | Live PR paths, including both names of each rename, and the [owner-only list](../../.agents/skills/overnight/scripts/night_owner_paths.py) | The list includes AGENTS.md, so #140 needs the owner. | A match gives `REVIEW_OWNER_PATH` and **Needs you** regardless of task class. Refuse before grant or before the merge claim. | Chief ruling, leader brief 17. Plan.md line 226. |
| G09 · grant and merge | All workflow and hook pages, ID/path/state and the two blob IDs on live base | Matches the list in §4 at the probe. | Drift in the approved inventory or either pinned blob, any new hook, or an unreadable or incomplete comparison. | Order 158, R06 |
| G10 · grant and merge | Same-repo settings, exact head ref and SHA, default and protected branch status, effective deletion rules, all open base and head dependencies | Auto-delete on. `skill-overnight` is neither default nor protected and has no head rules. No other exact head/base dependency in the probe. | Unknown setting or, with auto-delete on, wrong or moved ref, protected/default branch, another open dependency or incomplete read. | Orders 149, 154; R05, R07 |
| G11 · grant, merge and confirmation | Effective and classic policy. On the exact PR and main SHAs, read the latest result for each required context and named app. | Ruleset `25605596` requires nine contexts from app `15368`. Both sampled SHAs pass. Zero native statuses and one non-required skip on main. | Unknown policy, a missing, pending or failed latest required check, or an empty required set without card permission. Non-required jobs and superseded runs do not hold. | Orders 137, 148. B80. R14, R15, R22, R27. See §6 and `.github/workflows/ci.yml:1`. |
| G11a · main-tip pin at grant, replay and merge | Review start's merge base and reviewed base, grant's `review_base`, and live base and main tip. | The sampled comparison has merge base and reviewed base equal to live main `aa11c16`. | Any mismatch holds this PR. If main moved, merge main into the PR and complete a full round for the new head and base. | Orders 145 and 148. `night_chief.py:174`, `night.py:308`, `night_rules.py:505`. |
| G12 · merge before writes | Current review, grant and action state under lock, durable one-use attempt and stop time | not probed | Recheck G04–G06. If claim append or sync fails, send zero GitHub writes. If stop arrives before Ready, record unsent. | Order 157; R02, R03, R10, R17 |
| G13 · merge after Ready | Synced Ready result, then exact target and base, head SHA equal to grant, `draft:false`, `state:open`, `mergeable:true`, `mergeable_state:clean`. Also check G07's unmerged and auto-merge fields. | Ready and its final read are pending rehearsal. | A Ready error, lost reply or Ready result append or sync error means zero PUTs. A changed head or base, an ineligible PR, an unreadable response or stop also means zero PUTs. Reread only transient mergeability within §3's bounds. | Orders 137, 155, 157. R02, R23. Brief 14 rulings 5–6. |
| G14 · PUT result and confirmation | HTTP status, explicit result, merge SHA, exact live PR and ancestry on main | not probed. The open PR's non-null test merge SHA alone gives no credit. | Refusal or unclear result. Keep the claim. A refused PUT goes to **Needs you**. Confirm the exact merge and green main before the next grant. | Orders 137, 155, 157; R02, R23, R26 |
| G15 · clean before removal | G05 and G06, assignment and leader, confirmed exact same-repo merge, paths and identities, tracked status, worktree contents and both dependency sides. Check mounts and device IDs at and below output roots. | #140 is open. No post-merge probe. | Bad evidence, fork, absent confirmation, unsafe path or open dependency. Hold tracked changes, any non-ignored untracked file or ignored path outside §5's list. A mount or a directory on another device gives **Needs you** before any deletion. | Orders 149, 150. C17–26. R07–R10, R30. Brief 15. |
| G15a · cleanup working directory | Resolved current directory and CLI path. | Not probed. | `CLEAN_CWD` if either path is inside the worktree. | Order 149. C17. `night_cleanup.py:210–211`. |
| G15b · protected branch names | Assigned local and remote branch names and live default branch. Repeat the remote guard before a remote delete. | Topic `skill-overnight`, default `main`. | `CLEAN_DEFAULT_BRANCH` for `main`, `master` or the default branch. | Order 149. C19, C25–26. `night_cleanup.py:137`. |
| G16 · clean local entries | File identity, tracked paths, exact output allowlist, worktree registration, local ref lease and interrupted intent evidence. | Not probed. | Refuse an unsafe temp entry, dirty worktree, changed identity or local branch still in use. On retry, inspect the intent and actual state. Continue if they agree. Preserve entries and report **Needs you** if the evidence conflicts. | Orders 149, 150. C23–28. R08, R09, R30. |
| G17 · clean remote entry | Fresh branch and dependency checks, exact remote ref and SHA, and verified absence or leased delete result. | `skill-overnight` exists before merge. Auto-delete on. Post-merge ref not probed. | Hold a moved or protected ref, open dependency, ambiguous read or failed lease. Verified absence is a success only after a recorded exact merge with outcome `merged`. This also applies when auto-delete is off. | Orders 149, 154. C26, C28. R07. Brief 14 ruling 8. |
| G17a · remote delete URL | Canonical HTTPS Git URL and Git URL rewrite settings before a delete push. | Local Git config not probed. | `CLEAN_REMOTE_URL` if a matching `insteadOf` or `pushInsteadOf` rule can change the destination. | Order 149. C17, C26, C28. `night_cleanup.py:178–181`. |

Brief 14's read-only checks confirm the PR state, main tip and nine required checks. The two workflow blobs at `aa11c16` match §4. Its `ci.yml` has no `ready_for_review` trigger. See the [round 1 probes](../review-r1/gh-probes.md) and the [ruleset read](#ruleset-probe).

The walk uses a hypothetical draft with only `docs/x.md` changed. Give it a valid card, approved plan and reviewer pair. Use a same-repo topic branch, resolved review threads and green main. The leader has run `pnpm install`. There is no other open PR on the topic ref as head or base. Assume successful GitHub replies for Ready, PUT and confirmation.

| Gate | Walk result |
| --- | --- |
| G01 | Pass. Create a current-format night at `new`. Validate the completed card with one exact target and freeze the cap at `go`. |
| G02 | Pass. The chief records order 158's list at `new`. Freeze it at `go`. |
| G03 | Pass. The docs task, checked plan, approved pair and original reports match. |
| G04 | Pass. The current pair has no open blocker and the cap permits the grant. |
| G05 | Pass. Use the assigned paths, healthy journals, stable lock and real time before stop. |
| G05a | Pass. The frozen card records `rehearsal:passed`. |
| G06 | Pass. Dispatch creates and syncs the init before the leader starts. The fresh assignment reaches its first grant with that record alone. No claim or reservation is pending. |
| G07 | Pass. The draft is open and same-repo at the reviewed SHA. Squash is allowed. Neither a queue nor auto-merge applies. |
| G08 | Pass. The complete file list and reviewed diff both contain only `docs/x.md`. |
| G08a | Pass. The owner-only list has no match for `docs/x.md`. A migration under the same task class gives **Needs you**. |
| G09 | Pass. The five active entries, disabled entry, two blobs and empty hook list match on both reads. |
| G10 | Pass. Auto-delete is on. The exact topic ref is unprotected and has no other open head or base user. |
| G11 | Pass. The latest required checks from app `15368` are green on the exact head and main SHA. A failed non-required `audit` would give the same result. |
| G11a | Pass. The review's merge base, reviewed base and live main all equal `aa11c16`. A green advance of main holds this PR until the leader merges main into it and completes a full round. |
| G12 | Pass. Recheck the grant under lock and sync the claim while time remains. |
| G13 | Pass. Mark Ready and sync its result. The final GET gives `draft:false`, `state:open`, the granted head, `mergeable:true` and `mergeable_state:clean`. |
| G14 | Pass. Send one squash PUT with the granted SHA. Confirm the merge on main and check main CI. |
| G15 | Pass. The exact merge is recorded and confirmed. The worktree has no tracked changes or unexpected paths. The output walk finds no mounts or directories on another device. Both dependency reads are clear at this gate. |
| G15a | Pass. The CLI and current directory are in the persistent checkout. |
| G15b | Pass. The topic ref is neither `main`, `master` nor the default branch. |
| G16 | Pass. The worktree has ignored `node_modules/` from `pnpm install`. Remove eligible recorded temp files, the worktree with that output and the exact local ref. A retry continues if the intent and actual state agree. |
| G17 | Pass. Record **GitHub already removed this ref** after verified absence. If the exact ref is still present, use the approved lease. |
| G17a | Pass. The absence path sends zero pushes. In the present-ref control, the canonical URL has no matching rewrite and the lease can proceed. |

All 22 rows pass in the plan walk. In the main-move case, the new main SHA is green and G09 still passes with the same inventory and blobs. G11a holds at grant, or at merge if the move follows grant. The stale round gives no new grant or PUT. Merge main into the PR and run a full round to qualify again.

The walk uses read evidence from #140 and the two r2 grills in Brief 14. The write evidence remains pending in §8.

## 2. C1 · Bind ordinary inputs and review evidence · R01, R04

Keep the chief's supplied canonical night path and fixed leader journal from the assignment. Compare the resolved paths and stable lock with the recorded run. The chief owns the grant in its own folder. The leader writes the attempt in its assigned folder. The CLI uses the existing declared roles and checks the requested run, PR and head against the card and grant. A deliberate self-consistent substitute folder can bypass local comparisons. Order 159 limits the claim for both leader types.

Keep r1's verdict fields. Check exact PR, run, assignment, review start, round, plan check, full head, reviewer and counts against the original reports. Keep the distinct report digests in the chief journal. Apply the same binding on replay.

**Files** `night.py`, `night_files.py`, `night_chief.py`, `night_review_io.py`, `night_format.py`, `night_rules.py` and night card reference.

| Case | Break and exact assertion |
| --- | --- |
| A01 · authority inputs | Use the assigned folder as the green control. Break each check alone: wrong run, moved or symlinked chief path, grant from the leader file, and a different lock inode. Expect the exact path or run refusal and zero attempts or writes. For the lock, force both acquisition orders and assert that the other writer waits or gets `LOCK_HELD`. |
| A02 · copied reports | Omit one verdict comparison per break for PR, run, assignment, start, round, plan, head, reviewer fields and counts. The otherwise valid wrong report gives `REVIEW_REPORT`, zero new rounds and zero grants. Test live and replay separately. |

## 3. C2 · Keep one attempt and bounded writes · R02, R10, R16, R17, R23

Use the common lock at dispatch. In the fixed leader folder, create the journal with one init record. Store the run, leader and canonical PR target in that record. Sync the file and its parent directory before dispatch completes and before the leader starts. If creation or sync fails, stop dispatch. If dispatch stops early, use a lone init only if it matches that dispatch. Sync it before you complete dispatch.

After dispatch, every gate that uses the assignment checks the init against the first dispatch. At `night_files.py:440`, a missing file becomes a journal gap even before the first grant. An empty file or mismatched init also refuses. Apply this on replay, repair and close. The chief can record the gap and reconcile by GitHub reads. A retry or replacement uses the same journal and preserves the init and history. Check a replacement's authority against its current assignment and grant.

Use one format-4 action check for merge and clean. Under the lock verify the journal, marker, real clock, repair state and stop. Keep the staged tail repair for both journals. Sync the source identity, prefix digest and exact tail before a cut. Resume only with matching evidence. Preserve any complete claim and hold an uncertain result for reconciliation.

| Event | Result |
| --- | --- |
| Grant preflight | Read current chief state and live evidence. Keep the grant scoped to the run, exact PR, head, method, assignment and accepted review. |
| Merge preflight | Verify grant and live head. Read long GitHub preflight pages outside the lock. Retake the lock and recheck current authority, journal and clock. |
| Durable claim | Append and sync one leader-journal attempt before Ready. On append or sync error, read back under lock. Every error path sends zero GitHub writes. Keep any found claim consumed. |
| Ready | If time remains and the exact PR is draft, use `gh pr ready <number> --repo <host>/<owner>/<repo>` with the validated target. Append and sync its result on the attempt. A Ready error or lost reply consumes the attempt, gives **Needs you** and sends zero PUTs. On retry, send zero Ready calls and zero PUTs for that attempt. If the result append or sync fails, send zero PUTs even if a read finds the result. Preserve the claim for reconciliation. |
| After Ready | Read the exact PR again. Require `draft:false`, `state:open`, the granted head SHA, `mergeable:true` and `mergeable_state:clean`. Check the exact target and base, plus the other live PR fields in G07. A changed head or base gives `MERGE_HEAD_CHANGED` and zero PUTs. Apply the same final read if the PR started Ready. |
| PUT | Send once with the grant's full `sha` and `merge_method`. A definite refusal goes to **Needs you** and the PR stays Ready. Save a successful result only for HTTP 200, `merged:true` and a valid merge SHA. On timeout, lost reply or process exit, reconcile by reads. |
| Stop or replacement | Until PUT starts, stop prevents the next write. A PUT sent before stop can finish after stop. After a durable claim, a replacement leader can reconcile the old attempt. It gets no retry of that PUT. |

Hold the common lock across claim, Ready, final PR reads, PUT and result append. Use the existing `GH_TIMEOUT_S` for a **20-second total request budget** in this section. Count call time and reread delays against that budget. Give each call only the time that remains. Local sync time depends on the filesystem. The existing lock wait bounds the other caller's wait.

For `mergeable:null` or `mergeable_state:unknown`, reread only if all other eligibility fields pass. Freeze the read count and delay in the card at `go`. The default is five reads in total. Wait three seconds between reads by default. Check stop and the monotonic deadline before each wait, read and PUT. If the read limit, stop or deadline ends the rereads, record an unsent PUT and **Needs you**. A definite ineligible reply also holds. Use no other retries or pages in this section. Treat a timed-out PUT as unconfirmed. Use a fake clock for budget tests and a real lock for contention.

**R02 disposition.** The synced init and missing-file refusal close the observed `FileNotFoundError` path. Staged repair preserves a complete claim before a torn result. If the journal loss or restore is known, reconcile through the chief and send no retry for the affected grant. §11 records the valid-prefix limit under order 159.

**Order 157 text for AGENTS.md §10 review**

> At night, a leader marks its own PR Ready only through `night.py merge`, which does so after it verifies a valid grant and just before it sends the merge request.

Place it beside the draft rule. The ordinary draft rule still applies outside night mode. Keep releases and deletions with the owner except for the approved effects in orders 149 and 154.

**Files** `night.py`, `night_files.py`, `night_format.py`, `night_rules.py`, `night_chief.py`, `night_cleanup.py`, `night_report.py`, `AGENTS.md` and overnight references. Reuse the current CLI and shell-free argv. Use the existing module size rule and keep journal format changes in `night_format.py`. Historical formats use their matching readers.

| Case | Break and exact assertion |
| --- | --- |
| A03 · fresh dispatch | Dispatch a fresh leader with no temp or attempt records. Assert one synced init with the exact run, leader and target before leader start. Assert that the first grant succeeds with only this record. Break only the init write. The grant control fails on the missing journal. Break only sync and assert that a sync error prevents dispatch completion and leader start. |
| A03 · one attempt | Break `claim-after-send` and stop the process immediately after the fake server receives PUT. Reopen and assert the claim precedes send, and the total PUT count stays one. Force two same-grant callers and two PRs separately. Break `release-lock-before-claim` and `key-attempt-by-night` at their own assertions. Delete the journal after dispatch before any grant, before first send, and after send. Break the missing-file refusal in each case. Assert the gap, zero new grants and zero new writes as applicable. An empty replacement also refuses. |
| A04 · outcomes | For success, refusal, timeout, exit, malformed reply and stop after append, edit one outcome branch per case. Assert exact attempt, result and write count. Use `send-after-claim-append-error` on errors before bytes, after bytes and at sync. Assert zero Ready and PUT calls. Reopen, verify consumed or held state, and assert zero new writes. |
| A05 · repair | Cut before stage sync, after staged write, after truncate and before repair append sync in each journal. Edit one recovery check per break. Assert exact tail bytes, one recovery record, preserved prior claim and a visible leader gap on failed read. |
| A06 · shared action check | Omit the repair-pending check in merge, clean and claim paths separately. Assert `REPAIR_PENDING` and zero writes. Do the same for replay, real clock, stop and stale marker. Force both lock orders. One break skips the shared request budget and fails the timeout/call trace assertion. |
| A06 · rehearsal | Use `passed` and `owner-override` controls. With no rehearsal, expect `NO_REHEARSAL`. Skip the rule in each applicable review, grant and merge path in separate breaks. Assert zero new grants or merge writes for the applicable path. |
| A13 · Ready order | An invalid grant gives zero Ready calls. With a valid grant, assert one Ready after claim, its synced result, then a GET before PUT. Break each step separately. Move the head at Ready. Keep the post-Ready GET but ignore its changed SHA as the break. Expect `MERGE_HEAD_CHANGED` and zero PUTs. Refuse PUT and assert one PUT, one refusal record, **Needs you** and live Ready state. Break any rollback to draft separately. |
| A13 · Ready failure | Use separate cases for a Ready error and a lost Ready reply. In each, assert one Ready call, a consumed attempt, **Needs you**, zero PUTs and zero Ready or PUT calls on rerun. Break continuation after each failure separately. Inject Ready result append and sync errors in separate cases. Assert the same write counts and preserved claim. Break only the guard that stops PUT after each error. |
| A13 · final eligibility | Give an otherwise valid PR that is still draft after Ready. Break only the draft check. Repeat for each definite ineligible field. Expect **Needs you** and zero PUTs. Give a transient `null` or `unknown` then a clean reply. Expect one Ready, the bounded reads and one PUT. Keep mergeability unknown through the final read in a second case. Expect a consumed claim, **Needs you** and zero PUTs. Break the reread, read limit, delay, stop check and total budget separately. |

## 4. C4 · Compare the approved baseline and auto-delete snapshot · R05–R07

### Order 158 baseline

At `night.py new`, the chief supplies a structured card value for each merge repository. Use the repository ID and canonical target, owner order reference, active rows `{id,path}`, disabled row `{id,path,state}`, pinned files `{path,blob_sha}` and hook ID list. Record the complete value in the new journal and freeze it with the card at go. A grant records the comparison result and the exact read evidence. A leader or PR cannot update the baseline through a live read. Reuse the accepted list on the next card if it still matches. An actual baseline change needs new owner words before a chief can supply a replacement. A main move alone keeps the list valid.

| Role | ID | Path | State or blob |
| --- | --- | --- | --- |
| Active | 392402071 | `.github/workflows/ci.yml` | `active`, `db9d4f364544878a6e029d22686a7478b7a3a65b` |
| Active | 392349674 | `.github/workflows/codeql.yml` | `active`, `40145f762dcad0e0ec94f4c3338ea653518a2e56` |
| Active | 392355557 | `dynamic/copilot-swe-agent/copilot` | `active` |
| Active | 401675510 | `dynamic/dependabot/dependabot-updates` | `active` |
| Active | 392347977 | `dynamic/github-code-scanning/codeql` | `active` |
| Must remain disabled | 392402072 | `.github/workflows/security-review.yml` | `disabled_manually` |
| Repo hooks | — | Repository `1428240257` | `[]` |

The blob IDs come from the Git tree at probed base `aa11c16034139e41dab023377c6d428a10b008ea`. That revision identifies the evidence for the two values. The card comparison uses the live base tree at each gate.

At grant and again at merge, compare all workflow and webhook pages to the card. Check workflow IDs, paths and states. A new workflow or hook holds even if inactive. An absent, moved or re-enabled entry holds. Read the two pinned blob IDs at the live base SHA. Hold a change to either. The baseline is the observable list and two file pins that order 158 approved. Check the complete live PR file list against the exact reviewed diff and scope. Reject any workflow path change, including the source and destination of a rename. Keep a distinct file-list disagreement assertion.

Order 154 permits auto-delete for a same-repo PR after the checks. First compare the head and base repo IDs and canonical names. A fork or missing head repo goes to **Needs you**, even if auto-delete is off. Read one setting per gate for a same-repo PR. If on, use the exact topic ref, protected status and effective deletion rule. Check every page for open PRs with this repo and ref as head or base. Exclude only the current PR. Hold with the deciding dependency or field if the read fails. Repeat before merge. Keep the same rule if the setting changes between grant and merge. Persist the facts, including automatic deletion as the allowed effect. Keep the observed repo settings.

**Files** `night.py`, `night_chief.py`, `night_review_io.py`, `night_format.py`, `night_rules.py`, `night_cleanup.py`, `night_review_testlib.py`, `test_option_b_merge.py`, `test_cleanup.py` and night card reference.

| Case | Break and exact assertion |
| --- | --- |
| A12 · card | Omit the baseline or provide an unapproved value at `new`. Break each validation separately and assert the exact refusal. With a valid baseline, change the card file after `go` and assert that the original frozen value decides the grant. Break the frozen read separately. |
| A12 · scope | Break the workflow path rule for add, edit, delete, and each rename side alone. Break the file-list/diff comparison with two complete normal-path lists that disagree. Assert exact reason and zero grants. |
| A12 · baseline | Start with the full five-workflow, empty-hook green control. Break rejection of a new ordinary ID, an unknown dynamic ID, a path drift, a removed ID, re-enabled 392402072, each changed blob and a new inactive hook. Independently break acceptance of the three listed dynamic entries and of a verified empty hook page. Each edit must fail its own assertion. |
| A12 · final comparison | After grant, change one inventory item, one pinned file, a hook, or the scope evidence in separate cases. Break the corresponding merge-time recheck. An edit that skips the original comparison gives no credit for the recheck. |
| A12 · green main moved | Advance main to a green SHA with the same workflow and hook list and both blobs. Check G09 separately and assert it passes. Run the old review through grant and, in a separate case, move main after grant. The first gives zero grants. The second gives zero PUTs. Skip only the main pin in each break. Break equality of merge base and reviewed base separately. Merge main into the PR and complete a full round for the green control. |
| A12 · limit control | Change the simulated contents behind an unchanged tag and keep all approved fields fixed. This input is outside the check. An edit that adds a blanket mutable-tag hold fails the expected grant and one pinned PUT. |
| A13 · same repo and snapshots | Break fork refusal for a valid fork, including auto-delete off, and for an absent head repo. Cover wrong ref, protected/default branch, later-page exact head and base dependency, unknown setting and a denied read separately. At merge add a dependency or turn auto-delete on with an unsafe ref. A skipped merge recheck must fail with zero claims and PUTs expected. The on-and-clear same-repo case gets one grant, one Ready call and one pinned PUT. Assert zero settings PATCH calls and no extra release or ref-delete write on the merge path. An injected PATCH fails the write-trace assertion. |

### Ruleset probe

One GitHub.com GET on 2026-11-20 returned the effective `pull_request` rule from ruleset `25605596`.

```sh
gh api --hostname github.com --method GET repos/binhle312/cty1ng/rules/branches/main \
  --jq '.[] | select(.type == "pull_request") | {ruleset_id,parameters}'
```

| Parameter | Value |
| --- | --- |
| `allowed_merge_methods` | `["merge","squash","rebase"]` |
| `dismiss_stale_reviews_on_push` | `true` |
| `require_code_owner_review` | `false` |
| `require_extra_approval_for_unattributed_changes` | `true` |
| `require_last_push_approval` | `false` |
| `required_approving_review_count` | `0` |
| `required_review_thread_resolution` | `true` |
| `required_reviewers` | `[]` |

Use those parameters in the live-shaped fixture. Enforce allowed methods in preflight and let GitHub enforce its review rules on the PUT. Treat a server refusal as a recorded outcome. Zero required approvals alone gives no evidence about the conditional unattributed-change rule.

## 5. C5 · Preserve cleanup identity and resume state · R07–R09, R30

Keep order 149's four cleanup steps and order 150's assigned paths. Resolve paths and reject overlap with another leader's folder, a surviving checkout, chief data or Git metadata. Require the recorded worktree, repo, ref and exact confirmed merge. Run the CLI from outside the worktree. Protect `main`, `master` and the default branch from local and remote removal. Use the chief release evidence for prior leaders and helpers. Use the common lock for CLI writers. Check both dependency sides before the first removal and again before the remote step.

For a temp file, record the intent and exact identity. Check tracked paths in all affected checkouts, including the persistent checkout. Stage only an owned regular file with one link. Use a private slot on the same filesystem and an atomic move. Verify device, inode, type, link count, size and digest in the slot before unlink. Keep a mismatch. When safe, restore the mismatched regular entry to an empty original name without overwriting a new entry. Use a no-clobber link from the verified slot if the filesystem supports it. Sync the destination before removing the slot link. Record the restore with both paths. If a new entry occupies the path or the restore is unsafe, retain the slot and record **Needs you**. Preserve both entries.

On retry, inspect the intent and actual state of the interrupted item. Continue when they agree. Record a proven completed step once or finish a step that has yet to run. For a temp file, inspect its original name and slot. If a restore stopped after the link, match both entries to the same inode before you finish it. If evidence conflicts, preserve the entries and report **Needs you**. Check source type and link count again before a temp file deletion.

Order 149 covers “temporary files that leaders made.” Use a fixed list for worktree removal. The root `.gitignore` lists `node_modules/`, `dist/`, `coverage/`, `playwright-report/` and `test-results/` under Node. Match these directory names at any depth. Require Git to classify the path as ignored. Any non-ignored untracked file or ignored entry outside this list in the worktree goes to **Needs you** before removal. This also applies to a recorded temp file in the worktree. Eligible temp files in the separate leader temp folder keep the exact-record checks above.

Require a real directory at each matched output root. Before the first deletion, walk each output root without following symlinks. Check the root and every directory below it. If a directory is a mount point or its `st_dev` differs from the worktree root's `st_dev`, stop with **Needs you**. Detect same-device bind mounts as well. On Linux, use the [process mount table](https://docs.kernel.org/filesystems/proc.html#proc-pid-mountinfo-information-about-mounts) for this check.
Removal never follows symlinks. Unlinking a hard link removes only that entry, so pnpm store files outside the worktree survive.
Never remove tracked content. Use registered Git worktree removal without force and the approved local SHA check. Leave the other entries in `.gitignore` for the owner.

Require a recorded merge result with outcome `merged` and an exact live confirmation before you give credit for ref absence. Check the exact remote ref with the same repository identity and authenticated access. If access is valid and the ref is absent, store the evidence and send zero remote delete commands. When recorded auto-delete is on, report **GitHub already removed this ref**. That label records absence under that policy. When auto-delete is off, record **already absent**. A 404 alone gives no credit.

If the ref exists at the expected SHA, repeat branch and dependency checks. Refuse a matching Git URL rewrite with `CLEAN_REMOTE_URL`. Use the approved lease against the canonical URL. If the lease fails or the ref returns at a different SHA, preserve it and record **Needs you**.

No dependency lock is part of either auto-delete or the lease. The check covers the read snapshot. See §11 for the change window.

**Files** `night_cleanup.py`, `night_files.py`, `night_format.py`, `night_report.py`, `test_cleanup.py`, cleanup design and overnight references.

| Case | Break and exact assertion |
| --- | --- |
| A14 · remote scope | Omit each dependency side, page and repo comparison separately. An exact later-page open dependent PR preserves paths and refs. A same-named unrelated fork ref gives a clear read. A fork head of the merged PR refuses before removal. Add a blocker between the two reads. Skip only the second dependency read as the break. The assertion requires zero remote pushes. |
| A14 · cleanup guards | From inside the target worktree, expect `CLEAN_CWD` and zero removals. Break only that check. Use a default branch with another name to test `main` and `master` separately. Expect branch protection and zero removals with each name. Break each name check in turn. Add a matching Git URL rewrite and assert `CLEAN_REMOTE_URL` and zero pushes. Break only the URL guard. |
| A14 · remote results | Treat verified absence as an error, accept a denied read as absence, or omit the ref lease in separate edits. The auto-delete control records the exact success outcome, zero pushes and a report row. The present-ref control sends one exact leased delete. The moved-ref control keeps the ref. |
| A14 · G17, auto-delete off | With an exact recorded and confirmed merge and an absent ref, assert **already absent**, a success report row and zero pushes. Break only acceptance with auto-delete off. With the same live merge and absent ref, remove the recorded `merged` outcome. Require refusal, no success row and zero removals. Break only the recorded-merge check. |
| A13 / A14 · late dependency limit | Insert an exact dependent PR after the last successful read. The test asserts the earlier clear snapshot, then the dependency's later creation. It asserts the documented limit rather than a blocked delete. Break the test trace by moving that creation before the final read. The ordering assertion fails, and the earlier-dependency case tests actual refusal. |
| A15 · temp ownership | Break checks for tracked/overlap, identity after staging, symlink and link count separately. Assert original bytes, outside target and aliases survive each refusal. Replace the path before staging. Assert restoration at a free name and preservation of both entries at an occupied name. Break restore, no-clobber, and recorded restore separately. |
| A15 · interrupted cleanup | Stop after intent, after move, after the restore link and after result. Skip resume or replay the removal in separate breaks. Assert one result, no second delete or restore, and exact original/slot state on each rerun. Test changed file identity independently. |
| A16 · worktree outputs | Use ignored root and package `node_modules/` and each listed build directory in the green control. Assert removal in the approved order. Break acceptance of each listed name in turn. Add one non-ignored untracked file, then one ignored path outside the list. Assert `CLEAN_WORKTREE_DIRTY`, **Needs you** and resource preservation for each. Break each refusal alone. Use a link at an output root as a separate refusal case. Verify that normal package links under a real output root leave their targets outside the checkout intact. |
| A16 · output mounts and devices | Start with an otherwise eligible cleanup. Simulate a same-device bind mount at `node_modules/` through the mount-point check. In a separate run, give a nested directory a fake `st_dev` that differs from the worktree root's. Use a file in a temporary cache outside the worktree as the backing file for each simulated directory. The delete double targets that file if cleanup reaches the simulated directory. For each run, assert **Needs you**, unchanged bytes in the outside file, and zero local or remote delete calls. Break only the device check. The fake `st_dev` run must fail its refusal and zero-delete assertions. |
| A16 · local retry | Stop after worktree removal but before the result append. Verify its absence from Git and disk. Retry and assert one result and no second removal. Break resume with an unconditional hold. In a separate case, leave conflicting registration or path evidence. Assert **Needs you** and preservation. Break that refusal alone. |

## 6. C3, C6 and C7 · Keep current review, CI and handoff rules

These proofs add to the applicable r1 rows. The chief journal owns the current plan, assignment, review, rulings and grant. Leader records supply attempt and cleanup facts. One projection gives the report and owner page the same findings and evidence. Keep earlier findings when a later pair is clean.

**C3 · R03, R11–R13, R29.** Retain the current-state fold, cap, same-head and amended scope rules from r1. A new blocker, assignment, plan or chief reopen makes an unused grant inactive until the proper review. A claimed grant keeps its reservation. Preserve the verified live-main tip credit and the actual cap handoff text.

Files are `night_chief.py`, `night_review.py`, `night_review_io.py`, `night_rules.py`, `night_format.py`, `night_report.py` and the affected review tests and references.

| Case | Break and exact assertion |
| --- | --- |
| A07 · current grant | Break durable revocation and the final eligibility check separately. To isolate the final check, make the old grant flag appear active at the final test seam while current review has a blocker. Expect zero new claims and writes. Test newer blocker, assignment change, plan change and chief reopen separately. Assert the old grant cannot authorize a write. |
| A07 · claim already exists | Let A claim before the chief changes the review. Break reservation retention. Assert the same claim persists, PR B is pending, and no second PUT is sent. Run the opposite order and assert the unused grant is revoked. |
| A08 · cap freeze | Start `new` before the card is complete. Complete it and supply a valid cap at `go`. Change the draft card after `go`. The frozen cap still decides the hold. Move validation to `new` as one break. Read the live cap after `go` as another. |
| A08–A11, A24–A28, A37–A39 | Keep the r1 cap, same-head count, amended task, handoff, reviewer, scope and main-credit cases and separate edits. In A28 force two concurrent chief grant requests. Expect one entry and one `MERGE_PERMISSION_DUPLICATE`. Move the duplicate check outside the lock as the break. |

**C6 · R14, R15, R27.** Keep the policy reader and typed classic-protection 404. On cty1ng main, count only the nine required contexts in ruleset `25605596`, all from GitHub Actions app `15368`. They are `lint`, `typecheck`, `test`, `check:index`, `check:events`, `db:check`, `gen:api fresh`, `build + check:bundle` and `e2e`.

Filter all pages by required context, exact SHA and named app. Use only the newest run per required context and source. For a required native status, use the first newest status and the request SHA. Persist the deciding IDs at grant and confirmation. A failed, pending or missing latest required check holds. Ignore a failed non-required job such as `audit` (`.github/workflows/ci.yml:1`) and any run that a newer matching run supersedes. Remove the blanket main scan in `night_review.py:184–194`. An empty required set still needs card permission. Use the [live shapes](../review-r1/gh-probes.md) in the fixture.

Files are `night.py`, `night_review.py`, `night_chief.py`, `night_format.py`, `night_review_testlib.py`, `test_option_b_merge.py` and `test_brief8.py`.

| Case | Break and exact assertion |
| --- | --- |
| A17 · deciding source | Put one required context only on page two. Truncate the page read and assert the missing positive decision. Independently accept a wrong-SHA check, wrong-app check and creator-as-app status. Each fixture has no second valid candidate and must hold. Run PR and main cases separately. |
| A17 · red main | At the exact main SHA, give all nine required contexts latest successes from app `15368`. Add a failed `audit` and an older failed run of a required context in separate cases. Grant and main confirmation still pass. Add a blanket non-required hold and count older failures in separate breaks. Reverse that required context's outcomes in another case. The latest failure holds even with an older success. Break selection of the latest run alone. |
| A18 · policy and record | Remove permission for a known empty set in the fixture. Break the empty-set authority check and expect zero grants. Move through typed 404, generic 404, denial and a ruleset-only positive. Break deciding CI fields one at a time and assert the exact stored evidence. |

**C7 · R18, R19, R28, R31.** Retain r1's coverage intervals, late reconciliation and persistent finding projection. Match a recorded attempt to an exact GitHub PR, head and merge SHA. Keep unattributed, unknown and known-unsent results distinct. The audit flags an observed merge outside the recorded tool sequence in its covered scope. Show any coverage gap and preserve closed report bytes.

Files are `night.py`, `night_report.py`, `night_chief.py`, `night_rules.py`, `night_format.py`, the report/merge tests and morning report reference.

| Case | Break and exact assertion |
| --- | --- |
| A19 · audit phases | Before the final read, assert the exact gap from 22:30 to 23:00. Break the gap row separately. After the final read, assert the exact 22:45 unmatched merge row and the filled interval. Break the merge row and coverage update separately. Check the excluded cutoff and unchanged closed bytes. |
| A20–A21, A31 | Keep the r1 exact-tuple, clock, late, finding history, owner handoff and coverage proofs. Change one match field at a time. Assert an observed out-of-tool merge is flagged on its own row without claiming its actor's intent. Run “journal missing after grant” as a distinct gap case. |

## 7. C8, C9 and C10 · Keep exact proof and delivery records

**C8 · R20–R24.** Keep r1's checked case list for the 212 historical names and 57 round-one names. Map each retained proof to its test, subtest and exact assertion. Require a green control and one edit per assertion. Keep explicit retirements for deleted rules. Use current fixtures, including ordinary active CI. All A01–A39 cases remain applicable except the r1 variants replaced here or retired below. Update the strategy's index with the applicable proof entries.

Files are `scripts/overnight/cases.py` (proposed), the existing case and verdict runner, skill tests, strategy and indexed folder tables.

| Case | Break and exact assertion |
| --- | --- |
| A22 · inventory | Keep r1's missing name, strategy and retirement failures. Treat a retained entry with no runnable edit as an inventory failure. |
| A23 · verdict | Use separate edits for wrong assertion, wrong subtest, wrong test, loader failure, missing test, skip, multiple failures and non-green control. Assert `BAD` in each case. Check `KILLED` for the exact single failure and `SURVIVED` for a green broken run. |
| A30 · request and stop | The draft trace has one Ready and one exact PUT. The Ready control starts Ready and has only the exact PUT. Compare target argv, JSON method and full SHA. Break each field separately. Stop before Ready or after the final GET and expect zero later writes. Use separate stop-check breaks. A PUT started before stop can finish after stop. |
| A35–A36, A38 · traces | Retain the role, assignment, review, helper, grant and P3 checks. Trace chief checks, chief grant, leader claim, Ready, final GET and pinned PUT, in that order. Edit each actor or step alone. A chief or helper does not gain leader authority from a valid grant. |
| G08a · §7 live diff | Classify a migration PR as `night` with valid owned scope and review evidence. Expect a path refusal, no grant and a **Needs you** report row. Repeat the merge preflight with a protected rename source and expect no claim or GitHub write. Use a docs-only PR as the grant and merge control. Break both calls and the report row separately. |

**R23 stays open** until both daytime profile traces and §8 pass. Record real paths, lock identity, both lock orders and bounded contention. Record roles, assignment order and replacement after both reviewer failures. Show lost-result recovery, repair, late audit and the closed report addendum. Use disposable fixtures. Scope sandbox observations to the profile tested. For R24, record the final skill package digest, evaluator and scanner versions, exit status and full Tier 1 and Tier 2 output. Retain the prior incomplete result. Incomplete required checks or a wrong digest keep DQ-977 open.

**C9 · R25, R26.** Keep one format-4 constant across readers, writers and recovery text. Retain historical bytes. Keep `MERGE_PENDING` a retry refusal for the waiting operation and `MERGE_PERMISSION_USED` for the consumed grant. Use the files and cases in r1.

| Case | Break and exact assertion |
| --- | --- |
| A32 · format | Register separate reader, historical layout and fault parameters. In particular, break the third parameter, the journal fault check, with a current-format invalid journal. Assert its exact refusal and identical journal and side files. Break historical-format acceptance and incorrect version text separately. |
| A33 · retry | Omit the upstream PR, put the refusal in the final class, or allow a used grant to send again. Change one decision per edit. After exact confirmation and green main, B can request a grant. A sends no second PUT. |

**C10 · R32.** Use the ledger for the register totals. Run the existing `pnpm records:counts --write` and `pnpm records:counts` at build delivery. A34 changes one #140 count in a disposable copy and expects its stale result. Update delivery quality, status and the draft PR body only in a later authorized pass. Keep Guide disposition in that delivery record.

## 8. Live head-pin test · order 155, R23

After an approved build and before round 2, use this setup for both cases.

1. Verify the actor with `gh api --hostname github.com --method GET user --jq .login`. Require `binhle312` before any write. Create private `binhle312/night-rehearsal` after you verify absence. Use an initial `main` for setup. If the repo exists, verify its privacy, canonical name and ID before reuse. Stop on an ambiguous lookup. Try to add the fixture's required check through a ruleset or branch protection. If GitHub refuses because of the account plan, stop. Record the response and send it to the chief. The owner then chooses a public scratch repo or a rehearsal without a required check.
2. Verify the scratch clone origin before any case write. Reject a production target. Use a fresh scratch clone, throwaway chief folder, assigned leader folders and unique branches and PRs on each run.
3. Read back auto-delete on, one active push workflow and its required check. Verify that there are no other active workflows or repo hooks. Use pushes to run the check on main and the PR head. Record the scratch workflow ID, path and blob and empty hook list at `new` under order 155.
4. Run the daytime profile traces in §7 and record their pass for G05a. Use the approved plan check, pair, original reports, card scope, green checks and real time. Get a valid chief grant for each draft. After case 1, check green main. Base the second PR and full review on that tip. Run the normal gates without an override.

| Case | Operation and proof | Break |
| --- | --- | --- |
| Setup | The verified owner, private repo, required-check trial, scratch origin and fixture settings precede any case write. A repeat uses the verified repo and new PRs. A plan-level refusal stops setup and sends the response to the chief. | Break login comparison and force a mismatch. The trace must fail on the first write. Force recreation of an existing repo and fail the reuse assertion. In a plan-refusal fixture, continue after the response as the break. Assert zero case writes and the recorded handoff. |
| 1 · reviewed draft | Push a harmless docs change and open a draft. Get the current pair, checks and grant for that head. Run normal `night.py merge`. Record Ready and its synced result. Record `draft:false`, `state:open`, head SHA equal to the grant, `mergeable:true` and `mergeable_state:clean` from the final GET. Record one pinned PUT, HTTP 200 and `merged:true` with exact merge SHA. Confirm main and ref absence. Run `clean` and record **GitHub already removed this ref** with zero delete pushes. | Remove Ready, alter each recorded eligibility field, change the sent SHA, or remove verified ref absence in separate copies of the trace. Each edit must fail its own assertion. |
| 2 · head moves at server boundary | Open another draft and grant its old SHA. Place a rehearsal-only `gh` wrapper in `PATH`. Pass unrelated calls through to the real binary. Intercept only the scratch PR merge PUT after the final GET. Save its argv and stdin, push a new commit, verify the new head, then forward the old request once without changing the payload. Require HTTP 409 with a SHA mismatch. Read the live PR and ref. The PR stays Ready and open at the new head, with the same new SHA on its ref. Verify `MERGE_HEAD_CHANGED` and **Needs you**. | A moved head before the final read fails the required server-boundary trace. Change the forwarded SHA, replace the 409 with an unrelated error, or remove the final live ref proof in separate copied traces. Assert the exact failure for each. |

Use a second scratch shell for the wrapper's push or a wrapper-controlled barrier. Keep the push inside the locked request budget. If the budget ends or GitHub returns a different result, the rehearsal stays open. Keep the head-move hook outside shipped code. The wrapper may use the real binary by absolute path to avoid recursion. It must fail locally for any unexpected write target. This follows the PATH fixture approach from #139.

Save the tested revision, repo ID and settings, actor, PR URLs, refs and exact SHAs. Save the grant and attempt IDs, UTC order, command arguments, JSON payloads, HTTP responses and process exits. Omit credentials. Limit the live conclusion to the scratch repo, identity, policy and squash method.

## 9. Plan-line table

B points to the numbered lines in [plan.md](plan.md). S points to [test-strategy.md](test-strategy.md). C points to the approved [cleanup design](../../docs/plans/pr-140-overnight-cleanup.md). During build delivery record actual code and proof locations against this table.

| Approved source lines | r3 disposition and proof |
| --- | --- |
| B27–31, B81, B87, B116 | Orders 154 and 158 replace the effect proof with G08–G10. B29 and B81 keep the queue and auto-merge hold in G07. A12–A13. |
| B34–43, B49–53 | Keep independent chief checks and bound reports. Replace owner-ready as a grant prerequisite with order 157's Ready step. A02, A07–A11, A13, A21, A27, A35–A39. |
| B57–61, B78–81 | Record the baseline at `new`. Validate the completed card and freeze the cap and reread settings at `go` (G01–G02). Keep format 4, exact argv and typed refusal. A01, A08, A12–A13, A30, A32. |
| B65–76, especially B72, C15 | “For Codex and Claude, the chief supplies the canonical night path, and the tool checks recorded run, grant, target and local file state to prevent honest mistakes.” Keep the stable lock and local claim. Dispatch syncs the init before leader start. G06 refuses a gap after dispatch. A01, A03–A06 and both profile traces. |
| B80, B85–91, orders 145 and 148 | Count the latest required checks on the exact main SHA (G11). Pin the reviewed base and merge base to the live tip (G11a). A main move needs a merge from main and a full round. A12, A17–A18. |
| B85–99 | Keep the last locked checks and one durable claim before the first write. Sync the Ready result before the bounded eligibility reads and pinned PUT. Ready errors consume the attempt. G12–G14. A03–A07, A12–A13, A24–A25, A28, A30, A33. |
| B100, B153, B156–172, S56, order 155 | §8 starts with the private required-check trial. Keep the independent round, packaged evaluator and records checks. R23, R24, A22–A23, A32–A34. |
| B104–122, B172 | Keep `NO_REHEARSAL` in G05a. Carry refusal codes to help, report and retry paths. Add Ready refusal and head-change outcomes to existing result handling. A04–A06, A13, A18, A32–A33. |
| B126–140 | Keep audit, post-stop and owner handoff. Add the missing-journal gap and both verified ref-absence outcomes. A05–A06, A14–A16, A19–A21, A29, A31. |
| C13–31, C38–46, order 149, Brief 15 | Keep the separate leader folder and cleanup order. Apply C17's directory guard, C19's branch-name rule and C26's canonical remote scope. Limit ignored outputs as in §5. Refuse mounts and other devices before deletion (G15, A16). Inspect and resume when evidence agrees under C28. Require a recorded merge for ref absence. G15–G17a. A14–A16, A29. |
| B218–240, S19–117, S119–138 | Keep the review rules, cap reset, case index and command tests as amended here. Each claimed result needs a separate break. |
| AGENTS.md §10 | Add the proposed one-sentence night rule in §3 after the owner approves its text. Order 157 and A13. |

## 10. Cuts and build order

Remove the protected dispatch design, launcher, supervisor, launch context, request channel and transport-only module responsibilities, gates, proof cases and rehearsal steps. Keep the existing CLI split and common lock. Remove the blanket active-workflow hold, mutable-input proof and blanket auto-delete hold. Remove fork allowance and remote-delete deferral. Remove the proof requirement for an exclusion gate across the last dependency read and deletion. Follow the approved cleanup lease and record the limit below. Retire only cases unique to these removed rules. Keep exact replacements in the case register for revised rules.

After owner approval, run the red cases on a disposable checkout. Build the journal and state fixes first. Add the bounded effect and Ready sequence, then cleanup and handoff. Run the focused cases, green controls and each separate break. Run repository and standalone skill checks on the final head. Run the two live scratch cases and the packaged evaluation. Send that exact head to the assigned round 2 reviewers. Preserve the earlier review and the cap reset. P1 or P2 blocks the build delivery. Keep #140 draft until it has a valid grant for its own merge.

## 11. Needs human review · Not claimed

- **AGENTS.md §7.** The path check covers the listed names. Content-only changes outside those paths remain a human check. Examples include a removed call to a security guard, handling of secrets, changes to the public API or UI design, and scope or plan approval.
- **Orders 141 and 159.** The CLI prevents honest mistakes such as wrong PR, stale permission and wrong head. It does not stop a dishonest Claude or Codex leader, or enforce exclusive GitHub write access. The morning audit flags observed out-of-tool merges after the fact when its read covers them. It reports gaps.
- **R02, accidental restore.** A restore to a valid prefix before the claim can permit a second PUT. The second PUT uses the same grant and pinned head SHA. GitHub refuses it if the PR is merged. If the PR is open, the pin permits only the reviewed head. The request adds no merge authority beyond the grant. Order 159 covers a dishonest restore. Known journal loss still requires reconciliation.
- **Order 158.** The three GitHub-managed entries match by ID, path and state. Their contents and effects are unverified. Tag-pinned actions, for example `@v7`, can change without a blob change. The list covers repo hooks visible to the read. It gives no evidence about other integrations, unpinned file content or transitive behavior. Only the head SHA is pinned at PUT. Policy and inventory checks describe their read snapshots.
- **Orders 149 and 154, chief ruling 4.** A stacked PR can open after the final dependency read and before GitHub auto-deletes the branch. It can also open before a separate lease-bound delete. The SHA lease checks branch movement. **Open PRs untouched** has this read-to-delete limit.
- **Same-SHA branch recreation.** A branch recreated at the same name and SHA before `clean` can be deleted. Its content is identical to the merged head. The lease compares the name and SHA.
- **Order 155.** Live squash and stale-SHA refusal evidence remain pending until §8 passes. The scratch setup does not copy cty1ng's `pull_request`, `code_scanning` or `code_quality` rules. It checks the pinned request on its own repo, policy and identity.

The owner also reviews the exact AGENTS.md sentence before any edit.
