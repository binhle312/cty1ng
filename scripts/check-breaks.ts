// `pnpm check:breaks`: runs the break list of a PR. testing.md §5, "Break lists", owns what it
// checks, its steps and its verdicts; the usage line is in the code below.
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createConnection } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  applyEdits,
  BreakList,
  type Claim,
  changedLines,
  claimsFor,
  coverageProblems,
  diffArgs,
  diffEnv,
  lineOf,
  newErrorLines,
  projectsOf,
  linkProblems,
  listsFile,
  reportRow,
  type TestCall,
  testCalls,
  playwrightOutcomes,
  type TestOutcome,
  tscProblem,
  verdict,
  type Verdict,
  verdictText,
  vitestOutcomes,
} from "./lib/breaks.ts";

const args = process.argv.slice(2);
const listPath = args[0];
const option = (name: string) => {
  const at = args.indexOf(name);
  return at === -1 ? undefined : args[at + 1];
};
if (listPath === undefined) {
  console.error(
    "usage: pnpm check:breaks <list.json> [--only <id part>] [--base <ref>] [--report <file.md>]",
  );
  process.exit(2);
}
const only = option("--only") ?? "";
const reportPath = option("--report");

const git = (...gitArgs: string[]) =>
  execFileSync("git", gitArgs, { encoding: "utf8", maxBuffer: 2 ** 30 });

// The tested revision: HEAD plus the local changes, named by a hash.
const head = git("rev-parse", "HEAD").trim();
// The PR's base: each test that the PR adds or changes since then needs a claim or an exemption.
const base = git("merge-base", "HEAD", option("--base") ?? "origin/main").trim();
const changed = changedLines(
  execFileSync("git", diffArgs(base), {
    encoding: "utf8",
    maxBuffer: 2 ** 30,
    env: diffEnv(process.env),
  }),
);
const patch = execFileSync("git", ["diff", "HEAD", "--binary"], { maxBuffer: 2 ** 30 });
// New files that git does not ignore. Only plain files: a link, such as a linked node_modules,
// is not part of the change.
const untracked = git("ls-files", "--others", "--exclude-standard")
  .split("\n")
  .filter((file) => file !== "" && lstatSync(file).isFile());
const hash = createHash("sha256").update(patch);
for (const file of untracked) hash.update(file).update(readFileSync(file));
const local =
  patch.length === 0 && untracked.length === 0
    ? "none"
    : `sha256 ${hash.digest("hex").slice(0, 16)} (${String(untracked.length)} new files)`;

// The real path: `tsc` prints it in its file list, also when the temporary folder is a link.
const copy = realpathSync(mkdtempSync(join(tmpdir(), "check-breaks-")));
// The copy goes when the run ends, after an error, and on SIGINT or SIGTERM. A SIGKILL or a
// SIGHUP leaves it in the temporary folder.
process.on("exit", () => {
  rmSync(copy, { recursive: true, force: true });
});
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => process.exit(1));
}
execFileSync("tar", ["-x", "-C", copy], {
  input: execFileSync("git", ["archive", "HEAD"], { maxBuffer: 2 ** 30 }),
});
if (patch.length > 0)
  execFileSync("git", ["apply", "--whitespace=nowarn"], { cwd: copy, input: patch });
for (const file of untracked) {
  mkdirSync(join(copy, dirname(file)), { recursive: true });
  writeFileSync(join(copy, file), readFileSync(file));
}
// The local store first; the registry only for a package that the store does not have.
execFileSync("pnpm", ["install", "--frozen-lockfile", "--prefer-offline", "--silent"], {
  cwd: copy,
  stdio: "inherit",
});

const read = (path: string) => {
  try {
    return readFileSync(join(copy, path), "utf8");
  } catch {
    return null;
  }
};
const list = BreakList.parse(JSON.parse(read(listPath) ?? "null"));
const picked = claimsFor(list, only);
const claims = picked.claims;
// The tests of the PR (all of a new file), with the lines that the PR touched.
const testsOfPr = new Map<string, TestCall[]>();
const testFile = /\.(test|spec)\.[cm]?[jt]sx?$/;
for (const file of [...changed.keys(), ...untracked].filter((path) => testFile.test(path))) {
  const text = read(file);
  if (text === null) continue;
  const lines = changed.get(file);
  const calls = testCalls(text, file).filter(
    (call) => lines === undefined || [...lines].some((at) => call.start <= at && at <= call.end),
  );
  testsOfPr.set(file, calls);
}
// With --only, the list runs in part, so it cannot be complete.
const problems = [
  ...picked.problems,
  ...linkProblems({ claims }, read),
  ...(only === "" ? coverageProblems(list, testsOfPr) : []),
];
if (problems.length > 0) {
  for (const problem of problems) console.error(problem);
  process.exit(1);
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function portFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => {
      resolve(true);
    });
  });
}

// Another e2e run on this machine holds the ports for a few minutes: wait, never stop it.
async function waitForPorts() {
  const deadline = Date.now() + 15 * 60_000;
  while (!((await portFree(8100)) && (await portFree(8101)))) {
    if (Date.now() > deadline) throw new Error("Ports 8100 and 8101 stayed busy for 15 minutes.");
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}

interface Run {
  command: string;
  outcomes: TestOutcome[];
  // What the command printed: the console output of the tests, and the servers' errors.
  log: string;
}

const printed = (result: { stdout: string; stderr: string }) => `${result.stdout}${result.stderr}`;

async function run(test: Claim["test"]): Promise<Run> {
  const out = join(copy, OUT);
  rmSync(out, { force: true });
  const name = escape(test.name);
  if (test.kind === "vitest") {
    // The default reporter prints the console output of the test; the JSON one gives the result.
    const command = ["vitest", "run", test.file, "-t", name, "--reporter=default"];
    command.push("--reporter=json", `--outputFile.json=${OUT}`);
    const result = spawnSync(join(copy, "node_modules/.bin/vitest"), command.slice(1), {
      cwd: copy,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    const outcomes = vitestOutcomes(parse(out), test.name);
    return { command: shown(command), outcomes, log: printed(result) };
  }
  await waitForPorts();
  const command = ["playwright", "test", "-c", "frontend/playwright.config.ts", test.file];
  command.push("--grep", name, "--no-deps", "--reporter=json");
  // The copy's own servers: no marker from the shell points them at a server that runs now.
  const env: NodeJS.ProcessEnv = { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: out };
  Reflect.deleteProperty(env, "E2E_SERVE_MARKER");
  const result = spawnSync(join(copy, "node_modules/.bin/playwright"), command.slice(1), {
    cwd: copy,
    env,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const outcomes = playwrightOutcomes(parse(out), test.name);
  return { command: shown(command), outcomes, log: printed(result) };
}

const TYPESCRIPT = /\.[cm]?tsx?$/;

// `true`, or the first error of `tsc` on the projects of the package that holds `file`, in the
// copy. A break often leaves a variable unused, which does not stop the code from running.
function compiles(file: string): true | string {
  const unused = ["--noUnusedLocals", "false", "--noUnusedParameters", "false"];
  let listed = false;
  for (const project of projectsOf(file, read)) {
    const result = spawnSync(
      join(copy, "node_modules/.bin/tsc"),
      ["-p", project, "--noEmit", "--listFiles", ...unused],
      { cwd: copy, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
    );
    const printed = `${result.stdout}${result.stderr}`;
    if (result.status !== 0) return tscProblem(printed);
    listed ||= listsFile(printed, { root: copy, file });
  }
  // A passed compile that did not read the broken file is no compile check (testing.md §5).
  if (!listed && TYPESCRIPT.test(file)) return `no TypeScript project compiles ${file}`;
  return true;
}

// The results file, in the copy, where the commands run.
const OUT = "break-results.json";
const shown = (command: string[]) =>
  command.map((part) => (/[\s|]/.test(part) ? JSON.stringify(part) : part)).join(" ");

function parse(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

const lines = [
  `# Break run of \`${listPath}\``,
  "",
  `- Commit: \`${head}\``,
  `- Local changes: ${local}`,
  `- Base: \`${base}\`; ${only === "" ? "every test that the PR adds or changes has a claim or an exemption" : `only the claims that match "${only}", so the list is not checked for every test`}`,
  `- Node ${process.version}; all commands run in one copy with its own install, and each break is undone after its run`,
  "",
  "| Claim | Run | Command | Result |",
  "| --- | --- | --- | --- |",
];
let failures = 0;
for (const claim of claims) {
  const base = await run(claim.test);
  const ok = base.outcomes.length === 1 && base.outcomes[0]?.status === "passed";
  lines.push(
    reportRow({
      claim: claim.id,
      run: "no break",
      command: base.command,
      result: ok ? "passed" : "NOT PASSED",
    }),
  );
  if (!ok) {
    failures += 1;
    continue;
  }
  const line = lineOf(read(claim.test.file) ?? "", claim.assertion);
  if (typeof line === "string") throw new Error(`${claim.id}: the assertion is ${line}`);
  for (const step of claim.breaks) {
    const original = read(step.file) ?? "";
    const edited = applyEdits(original, step.edits);
    if ("problem" in edited) throw new Error(`${step.id}: ${edited.problem}`);
    writeFileSync(join(copy, step.file), edited.text);
    // A break that does not compile proves nothing, even when the test then fails at the
    // assertion: a page that loads later fails only at the first wait (testing.md §5).
    const compiled = compiles(step.file);
    const result: Run =
      compiled === true ? await run(claim.test) : { command: "not run", outcomes: [], log: "" };
    writeFileSync(join(copy, step.file), original);
    const errors = newErrorLines({ before: base.log, after: result.log, file: step.file });
    const found = verdict(result.outcomes, { file: claim.test.file, line });
    const v: Verdict =
      compiled !== true
        ? { kind: "invalid", reason: `the break does not compile: ${compiled}` }
        : found.kind === "caught" && errors.length > 0
          ? {
              kind: "invalid",
              reason: `the broken code printed an error: ${errors[0]?.trim() ?? ""}`,
            }
          : found;
    if (v.kind !== "caught") failures += 1;
    lines.push(
      reportRow({ claim: claim.id, run: step.id, command: result.command, result: verdictText(v) }),
    );
    console.log(`${step.id}: ${verdictText(v)}`);
  }
}
lines.push("", `${String(failures)} problem(s)`);
const text = lines.join("\n");
console.log(`\n${text}`);
if (reportPath !== undefined) writeFileSync(reportPath, `${text}\n`);
process.exitCode = failures === 0 ? 0 : 1;
