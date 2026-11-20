# PR #140 r3 removal record

| Approved cut | Removed or replaced |
| --- | --- |
| Protected dispatch, launcher, supervisor, launch context and transport-only request channel | None of those proposed r1 components was present at `808e4fe`. The existing shell-free CLI remains the action path. Protected launcher and transport proof variants do not apply. |
| Leader journal inside its worktree | Removed the fallback in the old `night_files.py:leader_path`. Dispatch now uses the fixed external folder. Updated tests that looked for `.overnight/…/leader-events.jsonl`. |
| Blanket workflow and auto-delete holds | Removed the blanket checks from the old `night.py:before_merge`. The owner-approved comparison and same-repo auto-delete guard run at grant and merge. Replaced the auto-delete-on refusal test with a protected-ref refusal and a clear-branch control. |
| Mutable workflow-input proof | Removed the proof obligation from the build. Order 158 uses the workflow and hook inventory plus approved blob IDs. The PR limits the claim to that snapshot. |
| Draft hold | Removed the unconditional refusal for draft grants. Replaced its old test with a grant-to-Ready control and a final-read test that still refuses a draft. |
| Fork allowance | Replaced the implicit head-repo allowance with exact same-repository identity checks. |
| Main CI blanket scan | Removed `check_main_statuses` and the call that held on unrelated or older results. The needed context and source now decide the check. |
| Remote-delete deferral and exclusion across the last dependency read | The earlier deferral and exclusion were proposals. Cleanup retains the fresh dependency read, exact lease and verified ref absence. The last-read-to-delete window stays in the PR's claim limits. |
| Worktree temp-file exception | Removed support for recorded files inside the worktree. Separate recorded temp files use exact identity. Git-ignored worktree output is eligible through the fixed directory list. |
