# Keep the end-to-end servers running between local runs

Date: 2026-10-30 · Source: M0c build, PR #49 · Status: open (the sandbox hang)

**Observed.** The M0c build took more than an hour. Each end-to-end run lost about 4 minutes
before the first test, and the agent ran the full suite many times while fixing.

**Cause.** In the agent's sandbox, a connection to a closed local port hangs for about 2
minutes. Playwright first checks if each of its two test servers already runs, and every run
started new servers and rebuilt the frontend.

**Change.** Locally, `pnpm e2e` reuses the servers that `pnpm e2e:serve` keeps running; CI
still starts fresh ones. While fixing, run only the affected tests (`vitest run <file>`,
`pnpm e2e -g "…"`) and run the full suite once at the end.

**Still open.** The 2-minute hang itself. It is a setting of the sandbox or firewall on the
owner's machine, not of the repository. If connections to closed local ports are refused at
once, the delay goes away even without `pnpm e2e:serve`.

**Rule now in.** `../testing.md` §3 "Fast loop while building"; `../workflow.md` §2 steps 3–4.
