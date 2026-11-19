---
id: R-025
title: Keep docs/status.md current in the PR at hand.
status: active
scope: all-agents
said: 2026-11-11
orders: []
ends: never
supersedes: []
amends: []
check-first: false
---
Rule: Before you hand off a PR, compare `docs/status.md` with the real state. Fix a stale line in the PR you work on; do not only report it.
Owner said: "Always ensure docs/status.md is up-to-date" (2026-11-11)
How to apply: Compare each "draft" or "open" line with `gh pr list --state all`. A gap that you find and do not fix gets a Follow-ups row in the same PR.
