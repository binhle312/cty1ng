// The one GitHub read of `pnpm merge:check` (option A, DQ-1022): one GraphQL query gives the PR
// state, head, base branch, live base tip, author, fork flag, repository owner, and each check of
// the head commit with its run id, app and workflow file. The CLI reads it two times and compares
// the two snapshots whole. The caller passes the command runner, so tests use a fake gh. Zod parses
// the answer; an answer that does not parse means "cannot check".
import { z } from "zod";
import type { CheckState, CiCheck } from "./merge-check.ts";

// The gh runner gives stdout as bytes; the reader decodes it.
export type Run = (args: readonly string[]) => { status: number; stdout: Buffer };
// Fatal: a byte that is not UTF-8 must not become a replacement character (plan delta r2 §5).
const GH_TEXT = new TextDecoder("utf-8", { fatal: true });
export type Repo = { owner: string; name: string };
export type Snapshot = {
  repo: string;
  number: number;
  state: string;
  repoOwner: string;
  author: string;
  fork: boolean;
  baseName: string;
  baseTip: string;
  head: string;
  checks: CiCheck[];
};
export type SnapshotRead = { ok: true; snapshot: Snapshot } | { ok: false; reason: string };

// A constant: the values go in as GraphQL variables, never into the text.
export const SNAPSHOT_QUERY = `query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    owner { login }
    pullRequest(number: $number) {
      state
      headRefOid
      baseRefName
      baseRef { target { oid } }
      isCrossRepository
      author { login }
      commits(last: 1) {
        nodes {
          commit {
            oid
            statusCheckRollup {
              contexts(first: 100) {
                pageInfo { hasNextPage }
                nodes {
                  __typename
                  ... on CheckRun {
                    databaseId
                    name
                    status
                    conclusion
                    checkSuite { app { databaseId } workflowRun { file { path } } }
                  }
                  ... on StatusContext { context state }
                }
              }
            }
          }
        }
      }
    }
  }
}`;

const SHA = z.string().regex(/^[0-9a-f]{40}$/);
const CHECK = z.discriminatedUnion("__typename", [
  z.object({
    __typename: z.literal("CheckRun"),
    databaseId: z.number().int(),
    name: z.string(),
    status: z.string(),
    conclusion: z.string().nullable(),
    checkSuite: z.object({
      app: z.object({ databaseId: z.number().int() }).nullable(),
      workflowRun: z.object({ file: z.object({ path: z.string() }).nullable() }).nullable(),
    }),
  }),
  z.object({ __typename: z.literal("StatusContext"), context: z.string(), state: z.string() }),
]);
const ANSWER = z.object({
  data: z.object({
    repository: z.object({
      owner: z.object({ login: z.string().min(1) }),
      pullRequest: z.object({
        // DQ-1033: any other state cannot be checked.
        state: z.enum(["OPEN", "CLOSED", "MERGED"]),
        headRefOid: SHA,
        baseRefName: z.string().min(1),
        baseRef: z.object({ target: z.object({ oid: SHA }) }),
        isCrossRepository: z.boolean(),
        author: z.object({ login: z.string().min(1) }),
        commits: z.object({
          nodes: z
            .array(
              z.object({
                commit: z.object({
                  oid: SHA,
                  statusCheckRollup: z
                    .object({
                      contexts: z.object({
                        pageInfo: z.object({ hasNextPage: z.boolean() }),
                        nodes: z.array(CHECK),
                      }),
                    })
                    .nullable(),
                }),
              }),
            )
            .length(1),
        }),
      }),
    }),
  }),
});

// A run passes only when it ended as success. Skipped and neutral are their own state.
function runState(status: string, conclusion: string | null): CheckState {
  if (status !== "COMPLETED" || conclusion === null) return "pending";
  if (conclusion === "SUCCESS") return "pass";
  return conclusion === "SKIPPED" || conclusion === "NEUTRAL" ? "skipped" : "fail";
}
function statusState(state: string): CheckState {
  if (state === "SUCCESS") return "pass";
  return state === "PENDING" || state === "EXPECTED" ? "pending" : "fail";
}

function checkOf(node: z.infer<typeof CHECK>): CiCheck {
  if (node.__typename === "StatusContext") {
    return { kind: "status", context: node.context, state: statusState(node.state) };
  }
  return {
    kind: "run",
    id: node.databaseId,
    name: node.name,
    state: runState(node.status, node.conclusion),
    appId: node.checkSuite.app?.databaseId ?? -1,
    workflowPath: node.checkSuite.workflowRun?.file?.path ?? null,
  };
}

// A stable order, so two equal snapshots have the same JSON.
const checkKey = (check: CiCheck): string =>
  check.kind === "run"
    ? `run ${check.name} ${String(check.appId)} ${String(check.id)}`
    : `status ${check.context}`;

export function readSnapshot(input: { repo: Repo; number: number }, run: Run): SnapshotRead {
  const { repo, number } = input;
  // The host is fixed: gh does not read another host from its config (plan delta r1 §3).
  const result = run([
    "api",
    "--hostname",
    "github.com",
    "graphql",
    "-f",
    `owner=${repo.owner}`,
    "-f",
    `repo=${repo.name}`,
    "-F",
    `number=${String(number)}`,
    "-f",
    `query=${SNAPSHOT_QUERY}`,
  ]);
  if (result.status !== 0) return { ok: false, reason: "gh failed to read the PR" };
  let text: string;
  try {
    text = GH_TEXT.decode(result.stdout);
  } catch {
    return { ok: false, reason: "gh gave an answer that is not UTF-8" };
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, reason: "gh gave bad JSON for the PR" };
  }
  const parsed = ANSWER.safeParse(value);
  if (!parsed.success) return { ok: false, reason: "gh gave an unexpected answer for the PR" };
  const { owner, pullRequest: pr } = parsed.data.data.repository;
  const commit = pr.commits.nodes[0]?.commit;
  if (commit === undefined) return { ok: false, reason: "gh gave no head commit" };
  if (commit.oid !== pr.headRefOid) {
    return { ok: false, reason: "the last commit of the PR is not its head" };
  }
  const contexts = commit.statusCheckRollup?.contexts;
  if (contexts?.pageInfo.hasNextPage === true) {
    return { ok: false, reason: "the PR has more than 100 checks" };
  }
  const checks = (contexts?.nodes ?? []).map(checkOf);
  checks.sort((a, b) => (checkKey(a) < checkKey(b) ? -1 : checkKey(a) > checkKey(b) ? 1 : 0));
  return {
    ok: true,
    snapshot: {
      repo: `${repo.owner}/${repo.name}`,
      number,
      state: pr.state,
      repoOwner: owner.login,
      author: pr.author.login,
      fork: pr.isCrossRepository,
      baseName: pr.baseRefName,
      baseTip: pr.baseRef.target.oid,
      head: pr.headRefOid,
      checks,
    },
  };
}

// The second read must give the same snapshot in each field (DQ-1022).
export function sameSnapshot(a: Snapshot, b: Snapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
