// The one GitHub read of merge:check (option A, DQ-1020 and DQ-1022). All data is synthetic, in the
// shape of the probe of 2026-11-20.
import { describe, expect, it } from "vitest";
import {
  FIXTURE_BASE,
  FIXTURE_HEAD,
  OTHER_APP_ID,
  answer,
  greenNodes,
  runNode,
} from "./merge-check-fixtures.ts";
import { CI_APP_ID, CI_WORKFLOW } from "./merge-list.ts";
import {
  type Run,
  SNAPSHOT_QUERY,
  type Snapshot,
  readSnapshot,
  sameSnapshot,
} from "./merge-check-snapshot.ts";

const REPO = { owner: "owner-login", name: "cty-test" };
const fixed =
  (stdout: string, status = 0): Run =>
  () => ({ status, stdout: Buffer.from(stdout) });
const read = (stdout: string, status = 0) =>
  readSnapshot({ repo: REPO, number: 152 }, fixed(stdout, status));

function snapshotOf(stdout: string): Snapshot {
  const result = read(stdout);
  if (!result.ok) throw new Error(result.reason);
  return result.snapshot;
}

describe("readSnapshot", () => {
  it("reads each fact of the PR and each check with its app and workflow file", () => {
    const nodes = [
      runNode("lint"),
      runNode("e2e", { status: "IN_PROGRESS", conclusion: null }),
      runNode("audit", { conclusion: "SKIPPED" }),
      runNode("test", { conclusion: "FAILURE" }),
      runNode("CodeQL", {
        databaseId: 9,
        checkSuite: { app: { databaseId: OTHER_APP_ID }, workflowRun: null },
      }),
      { __typename: "StatusContext" as const, context: "deploy", state: "PENDING" },
    ];
    const snapshot = snapshotOf(answer({ nodes }));
    expect(snapshot, "facts").toEqual({
      repo: "owner-login/cty-test",
      number: 152,
      state: "OPEN",
      repoOwner: "owner-login",
      author: "owner-login",
      fork: false,
      baseName: "main",
      baseTip: FIXTURE_BASE,
      head: FIXTURE_HEAD,
      checks: [
        {
          kind: "run",
          id: 9,
          name: "CodeQL",
          state: "pass",
          appId: OTHER_APP_ID,
          workflowPath: null,
        },
        {
          kind: "run",
          id: 1005,
          name: "audit",
          state: "skipped",
          appId: CI_APP_ID,
          workflowPath: CI_WORKFLOW,
        },
        {
          kind: "run",
          id: 1003,
          name: "e2e",
          state: "pending",
          appId: CI_APP_ID,
          workflowPath: CI_WORKFLOW,
        },
        {
          kind: "run",
          id: 1004,
          name: "lint",
          state: "pass",
          appId: CI_APP_ID,
          workflowPath: CI_WORKFLOW,
        },
        {
          kind: "run",
          id: 1004,
          name: "test",
          state: "fail",
          appId: CI_APP_ID,
          workflowPath: CI_WORKFLOW,
        },
        { kind: "status", context: "deploy", state: "pending" },
      ],
    });
  });

  it("sends the query as a constant and the values as variables", () => {
    const calls: string[][] = [];
    readSnapshot({ repo: REPO, number: 152 }, (args) => {
      calls.push([...args]);
      return { status: 0, stdout: Buffer.from(answer()) };
    });
    // The host is a fixed argument: gh never reads another host from its config (plan delta r1 §3).
    expect(calls, "one call").toEqual([
      [
        "api",
        "--hostname",
        "github.com",
        "graphql",
        "-f",
        "owner=owner-login",
        "-f",
        "repo=cty-test",
        "-F",
        "number=152",
        "-f",
        `query=${SNAPSHOT_QUERY}`,
      ],
    ]);
  });

  it("cannot check a gh error, bad JSON, a missing field, a second page or a stale commit", () => {
    const noBase = answer().replace(
      `"baseRef":{"target":{"oid":"${FIXTURE_BASE}"}}`,
      '"baseRef":null',
    );
    const cases: [string, string, number][] = [
      ["gh error", answer(), 1],
      ["bad JSON", "{", 0],
      ["no base ref", noBase, 0],
      ["second page", answer({ hasNextPage: true }), 0],
      ["last commit is not the head", answer({ commit: "c".repeat(40) }), 0],
    ];
    expect(noBase, "no base fixture").toContain('"baseRef":null');
    for (const [name, stdout, status] of cases) {
      expect(read(stdout, status).ok, name).toBe(false);
    }
  });

  // DQ-1033: a state outside the schema list cannot be checked.
  it("cannot check a PR state that is not OPEN, CLOSED or MERGED", () => {
    expect(read(answer({ state: "DRAFT" })).ok, "unknown state").toBe(false);
    expect(read(answer({ state: "CLOSED" })).ok, "closed state").toBe(true);
  });
});

// Each fact from the one snapshot: a second read that differs in any field is a change (DQ-1022).
describe("sameSnapshot", () => {
  // Read in each test, so a broken reader fails the test, not the file.
  const base = (): Snapshot => snapshotOf(answer());

  it("is true for two reads of the same answer", () => {
    expect(sameSnapshot(base(), snapshotOf(answer())), "same").toBe(true);
  });

  it("is false when any one field of the snapshot differs", () => {
    const nodes = greenNodes();
    const changedNode = (index: number, extra: object) =>
      nodes.map((node, i) => (i === index ? { ...node, ...extra } : node));
    const cases: [string, string][] = [
      ["state", answer({ state: "MERGED" })],
      ["head", answer({ head: "c".repeat(40) })],
      ["base name", answer({ baseName: "dev" })],
      ["base tip", answer({ baseTip: "d".repeat(40) })],
      ["author", answer({ author: "someone-else" })],
      ["repository owner", answer({ repoOwner: "someone-else" })],
      ["fork", answer({ fork: true })],
      ["run id", answer({ nodes: changedNode(0, { databaseId: 99 }) })],
      ["run state", answer({ nodes: changedNode(0, { status: "IN_PROGRESS", conclusion: null }) })],
      ["run name", answer({ nodes: changedNode(0, { name: "lint2" }) })],
      [
        "run app",
        answer({
          nodes: changedNode(0, {
            checkSuite: { app: { databaseId: 1 }, workflowRun: { file: { path: CI_WORKFLOW } } },
          }),
        }),
      ],
      [
        "run workflow",
        answer({
          nodes: changedNode(0, {
            checkSuite: {
              app: { databaseId: CI_APP_ID },
              workflowRun: { file: { path: ".github/workflows/x.yml" } },
            },
          }),
        }),
      ],
      [
        "a new status context",
        answer({
          nodes: [...nodes, { __typename: "StatusContext", context: "x", state: "SUCCESS" }],
        }),
      ],
    ];
    for (const [name, stdout] of cases) {
      expect(sameSnapshot(base(), snapshotOf(stdout)), name).toBe(false);
    }
  });
});
