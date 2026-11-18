// `pnpm check:breaks:static <list.json> [--base <ref>]`: the rules of a break list that need no
// test run, on the checkout (testing.md §5, "Break lists"). The CI job runs it on the list of
// each PR. It runs no test: only `pnpm check:breaks` shows that a break is caught.
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BreakList, changedLines } from "./lib/breaks.ts";
import { compileProblems, prProblems } from "./lib/breaks-static.ts";

const args = process.argv.slice(2);
const listPath = args[0];
const at = args.indexOf("--base");
const baseRef = at === -1 ? "origin/main" : args[at + 1];
if (listPath === undefined || baseRef === undefined) {
  console.error("usage: pnpm check:breaks:static <list.json> [--base <ref>]");
  process.exit(2);
}

if (!existsSync(listPath)) {
  console.log(
    `check:breaks:static: no break list ${listPath}. A PR needs one only for late tests, security tests, and order and race tests (docs/testing.md §5).`,
  );
  process.exit(0);
}

const root = process.cwd();
const git = (...gitArgs: string[]) =>
  execFileSync("git", gitArgs, { encoding: "utf8", maxBuffer: 2 ** 30 });
// As in the runner: the tests that the PR adds or changes since its base, with the local
// changes and the new files that git does not ignore.
const base = git("merge-base", "HEAD", baseRef).trim();
const changed = changedLines(git("diff", "--unified=0", base));
const newFiles = git("ls-files", "--others", "--exclude-standard")
  .split("\n")
  .filter((file) => file !== "" && lstatSync(file).isFile());
const read = (path: string) => {
  try {
    return readFileSync(join(root, path), "utf8");
  } catch {
    return null;
  }
};

let list: BreakList;
try {
  list = BreakList.parse(JSON.parse(read(listPath) ?? "null"));
} catch (error) {
  console.error(`${listPath}: not a valid break list: ${String(error).slice(0, 500)}`);
  process.exit(1);
}

const problems = [
  ...prProblems({ list, claims: list.claims, complete: true, changed, newFiles, read }),
  ...compileProblems({ claims: list.claims, root, read }),
];
for (const problem of problems) console.error(problem);
const breaks = list.claims.reduce((sum, claim) => sum + claim.breaks.length, 0);
console.log(
  `check:breaks:static: ${listPath} against base ${base.slice(0, 12)}: ${String(list.claims.length)} claims, ${String(breaks)} breaks, ${String(list.exempt.length)} exemptions, ${String(problems.length)} problems. No break ran: only pnpm check:breaks shows that a break is caught.`,
);
process.exitCode = problems.length === 0 ? 0 : 1;
