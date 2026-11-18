// `pnpm check:breaks:static <list.json> [--base <ref>]`: the rules of a break list that need no
// test run, on the checkout (testing.md §5, "Break lists"). The CI job runs it on the list of
// each PR; a PR with no list passes only when it adds or changes no test. It runs no test: only
// `pnpm check:breaks` shows that a break is caught.
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { BreakList, changedLines } from "./lib/breaks.ts";
import { compileProblems, prProblems } from "./lib/breaks-static.ts";

const args = process.argv.slice(2);
const listArg = args[0];
const at = args.indexOf("--base");
const baseRef = at === -1 ? "origin/main" : args[at + 1];
// The list comes first: an option in its place would read as a missing list, and pass.
if (listArg === undefined || listArg.startsWith("--") || baseRef === undefined) {
  console.error("usage: pnpm check:breaks:static <list.json> [--base <ref>]");
  process.exit(2);
}
const root = process.cwd();
// A path from the root of the checkout, also when the list is given by its absolute path.
const listPath = relative(root, resolve(root, listArg));

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

// A PR with no list is a PR with an empty list: each test that it adds or changes needs a
// claim or an exemption all the same (owner, 2026-11-18, q5 Q1 A).
const found = existsSync(listPath);
let list: BreakList;
try {
  list = found ? BreakList.parse(JSON.parse(read(listPath) ?? "null")) : { claims: [], exempt: [] };
} catch (error) {
  console.error(`${listPath}: not a valid break list: ${String(error).slice(0, 500)}`);
  process.exit(1);
}

const problems = [
  ...prProblems({ list, claims: list.claims, complete: true, changed, newFiles, read }),
  ...compileProblems({ claims: list.claims, root, read }),
];
if (!found) {
  if (problems.length === 0) {
    console.log(
      `check:breaks:static: no break list ${listPath}, and the PR adds or changes no test.`,
    );
    process.exit(0);
  }
  console.error(
    `check:breaks:static: no break list ${listPath}. Each test that the PR adds or changes needs a claim or an exemption with its reason in it (docs/testing.md §5):`,
  );
  for (const problem of problems) console.error(problem);
  process.exit(1);
}
for (const problem of problems) console.error(problem);
const breaks = list.claims.reduce((sum, claim) => sum + claim.breaks.length, 0);
console.log(
  `check:breaks:static: ${listPath} against base ${base.slice(0, 12)}: ${String(list.claims.length)} claims, ${String(breaks)} breaks, ${String(list.exempt.length)} exemptions, ${String(problems.length)} problems. No break ran: only pnpm check:breaks shows that a break is caught.`,
);
process.exitCode = problems.length === 0 ? 0 : 1;
