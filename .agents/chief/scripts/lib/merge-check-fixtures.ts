// Test data of `pnpm merge:check` (synthetic): a GraphQL answer in the shape that the probe of
// 2026-11-20 read from GitHub (tmp/probe-a in the leader's scratch folder), with fake logins and
// ids. Only tests import this file.
import { CI_APP_ID, CI_WORKFLOW, REQUIRED_CHECKS } from "./merge-list.ts";

export const FIXTURE_HEAD = "1a2b3c4d5e6f708192a3b4c5d6e7f80912345678";
export const FIXTURE_BASE = "b".repeat(40);
export const OTHER_APP_ID = 57789;

export type RunNode = {
  __typename: "CheckRun";
  databaseId: number;
  name: string;
  status: string;
  conclusion: string | null;
  checkSuite: {
    app: { databaseId: number } | null;
    workflowRun: { file: { path: string } | null } | null;
  };
};
export type StatusNode = { __typename: "StatusContext"; context: string; state: string };

export function runNode(name: string, extra: Partial<RunNode> = {}): RunNode {
  return {
    __typename: "CheckRun",
    databaseId: 1000 + name.length,
    name,
    status: "COMPLETED",
    conclusion: "SUCCESS",
    checkSuite: { app: { databaseId: CI_APP_ID }, workflowRun: { file: { path: CI_WORKFLOW } } },
    ...extra,
  };
}

// The 14 required jobs, green, and one CodeQL run of another app with no workflow run.
export function greenNodes(): (RunNode | StatusNode)[] {
  return [
    ...REQUIRED_CHECKS.map((name, i) => runNode(name, { databaseId: 2000 + i })),
    runNode("CodeQL", {
      databaseId: 3000,
      checkSuite: { app: { databaseId: OTHER_APP_ID }, workflowRun: null },
    }),
  ];
}

export type AnswerFields = {
  repoOwner: string;
  state: string;
  head: string;
  commit: string;
  baseName: string;
  baseTip: string;
  fork: boolean;
  author: string;
  hasNextPage: boolean;
  nodes: (RunNode | StatusNode)[];
};

export function answer(fields: Partial<AnswerFields> = {}): string {
  const f: AnswerFields = {
    repoOwner: "owner-login",
    state: "OPEN",
    head: FIXTURE_HEAD,
    commit: fields.head ?? FIXTURE_HEAD,
    baseName: "main",
    baseTip: FIXTURE_BASE,
    fork: false,
    author: "owner-login",
    hasNextPage: false,
    nodes: greenNodes(),
    ...fields,
  };
  return JSON.stringify({
    data: {
      repository: {
        owner: { login: f.repoOwner },
        pullRequest: {
          state: f.state,
          headRefOid: f.head,
          baseRefName: f.baseName,
          baseRef: { target: { oid: f.baseTip } },
          isCrossRepository: f.fork,
          author: { login: f.author },
          commits: {
            nodes: [
              {
                commit: {
                  oid: f.commit,
                  statusCheckRollup: {
                    contexts: { pageInfo: { hasNextPage: f.hasNextPage }, nodes: f.nodes },
                  },
                },
              },
            ],
          },
        },
      },
    },
  });
}
