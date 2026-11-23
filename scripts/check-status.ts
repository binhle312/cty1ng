// `pnpm check:status [--history <rev>]`: each PR merged into `main` on or after the start date
// has a Done row in docs/status.md. `--history` names the commit whose merged PRs need a row:
// `origin/main` by default (what a PR needs, after a `git fetch`); CI passes `HEAD^1`, the base of
// the PR's test merge, or `main` before the merge on a push (testing.md §4). Locally, merge
// `origin/main` into the branch first: the Done rows come from the branch's own docs/status.md.
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { SINCE, checkStatus, mergedPrs } from "./lib/check-status.ts";
import { readHistory } from "./lib/check-status-git.ts";
import { report } from "./lib/report.ts";

const { values } = parseArgs({ options: { history: { type: "string", default: "origin/main" } } });
const history = readHistory(".", values.history);
const statusMd = readFileSync("docs/status.md", "utf8");
report("check:status", [
  ...history.problems,
  ...checkStatus({
    merged: mergedPrs(history.log),
    statusMd,
    since: SINCE,
  }),
]);
