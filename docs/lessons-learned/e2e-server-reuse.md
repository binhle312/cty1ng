# M0c end-to-end startup delays

Date: 2026-10-30 · Source: M0c build, PR #49 · Status: open (the sandbox hang)

**Observed.** The M0c build took more than an hour. Each end-to-end run lost about 4 minutes
before the first test, and the agent ran the full suite many times while fixing.

**Cause.** In the agent's sandbox, a connection to a closed local port hangs for about 2
minutes. Playwright first checks if each of its two test servers already runs, and every run
started new servers and rebuilt the frontend.

**Project response.** Local `pnpm e2e` reuses servers from `pnpm e2e:serve`; CI starts fresh servers.
The local workflow uses focused tests during fixes and the full suite at the delivery gate.

**Still open.** The 2-minute hang itself. It is a setting of the sandbox or firewall on the
owner's machine, not of the repository. If connections to closed local ports are refused at
once, the delay goes away even without `pnpm e2e:serve`.

**Reusable principles.** [Verify the delivered revision and report evidence](../../.agents/skills/principle-verify-delivery-and-report-evidence/SKILL.md).

**Project guidance.** [testing](../testing.md), [workflow §2](../workflow.md#2-lifecycle-of-a-slice).
