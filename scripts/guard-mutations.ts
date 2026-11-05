// `tsx scripts/guard-mutations.ts [name part]`: proves that the tests hold the guard and import
// rules. It copies HEAD to a temporary folder, applies each mutation in
// scripts/fixtures/guard-mutations.json there, and runs the tests that own the rules. A mutation
// that no test fails is listed at the end. The checkout does not change. A search text that is no
// longer in the code stops the run, so a stale mutation cannot count as a pass.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { z } from "zod";

const Mutations = z.array(
  z.object({
    name: z.string(),
    file: z.string(),
    edits: z.array(z.object({ find: z.string(), replace: z.string() })).min(1),
  }),
);
const Results = z.object({
  numFailedTests: z.number(),
  testResults: z.array(
    z.object({
      assertionResults: z.array(z.object({ status: z.string(), fullName: z.string() })),
    }),
  ),
});

const TESTS = [
  "backend/src/core/guard",
  "backend/src/core/skills",
  "backend/test/api/skills.test.ts",
];
const SPEED_TEST = /scans (?:a|each) 1 MB/;

const root = process.cwd();
const filter = process.argv[2] ?? "";
const head = execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
const mutations = Mutations.parse(
  JSON.parse(readFileSync("scripts/fixtures/guard-mutations.json", "utf8")),
).filter((mutation) => mutation.name.includes(filter));

const copy = mkdtempSync(join(tmpdir(), "guard-mutations-"));
const archive = execFileSync("git", ["archive", "HEAD"], { maxBuffer: 2 ** 30 });
execFileSync("tar", ["-x", "-C", copy], { input: archive });
for (const part of [".", "backend", "frontend", "shared"]) {
  symlinkSync(resolve(root, part, "node_modules"), join(copy, part, "node_modules"), "dir");
}

function failedTests(): string[] {
  const output = join(copy, "results.json");
  rmSync(output, { force: true });
  const vitest = join(root, "node_modules/vitest/vitest.mjs");
  const args = [vitest, "run", "--project", "node", "--reporter=json", `--outputFile=${output}`];
  const run = spawnSync(process.execPath, [...args, ...TESTS], { cwd: copy, encoding: "utf8" });
  // A mutation that stops the tests from loading has no results file. It counts as caught.
  let text: string;
  try {
    text = readFileSync(output, "utf8");
  } catch {
    return [`no results, exit code ${String(run.status)}`];
  }
  return Results.parse(JSON.parse(text))
    .testResults.flatMap((file) => file.assertionResults)
    .filter((test) => test.status === "failed")
    .map((test) => test.fullName);
}

const baseline = failedTests();
if (baseline.length > 0) {
  console.error(`The tests fail with no mutation:\n${baseline.join("\n")}`);
  process.exit(1);
}
console.log(`# Mutations on ${head}: tests ${TESTS.join(", ")}`);

const survivors: string[] = [];
const onlySpeed: string[] = [];
for (const { name, file, edits } of mutations) {
  const path = join(copy, file);
  const original = readFileSync(path, "utf8");
  let text = original;
  for (const { find, replace } of edits) {
    if (!text.includes(find)) {
      console.error(`Stale mutation "${name}": not found in ${file}: ${find}`);
      process.exit(1);
    }
    text = text.replace(find, () => replace);
  }
  writeFileSync(path, text);
  const failed = failedTests();
  writeFileSync(path, original);
  if (failed.length === 0) survivors.push(name);
  else if (failed.every((test) => SPEED_TEST.test(test))) onlySpeed.push(name);
  const state = failed.length === 0 ? "SURVIVED" : "caught  ";
  console.log(`${state} ${String(failed.length).padStart(4)}  ${name}`);
}

rmSync(copy, { recursive: true });
const caught = mutations.length - survivors.length;
console.log(`\n${String(caught)} of ${String(mutations.length)} caught`);
console.log(`Not caught: ${survivors.length === 0 ? "none" : survivors.join("; ")}`);
console.log(
  `Caught by a speed limit only: ${onlySpeed.length === 0 ? "none" : onlySpeed.join("; ")}`,
);
