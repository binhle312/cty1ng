// `pnpm check:breaks <list.json> [--only <id part>] [--report <file.md>]`: runs the break list of
// a PR (testing.md §5, "Break lists"). It copies HEAD and the local changes to a temporary folder
// with its own install, so the checkout does not change and the e2e tests use the copy's own build
// and servers. Each test must pass with no break. Then each break runs alone, and it counts only
// when the named test fails at the line of its assertion text. The report names the commit, the
// hash of the local changes, each command and each result.
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createConnection } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  applyEdits,
  BreakList,
  type Claim,
  lineOf,
  linkProblems,
  playwrightOutcomes,
  type TestOutcome,
  verdict,
  type Verdict,
  vitestOutcomes,
} from "./lib/breaks.ts";

const args = process.argv.slice(2);
const listPath = args[0];
const option = (name: string) => {
  const at = args.indexOf(name);
  return at === -1 ? undefined : args[at + 1];
};
if (listPath === undefined) {
  console.error("usage: pnpm check:breaks <list.json> [--only <id part>] [--report <file.md>]");
  process.exit(2);
}
const only = option("--only") ?? "";
const reportPath = option("--report");

const git = (...gitArgs: string[]) =>
  execFileSync("git", gitArgs, { encoding: "utf8", maxBuffer: 2 ** 30 });

// The tested revision: HEAD plus the local changes, named by a hash.
const head = git("rev-parse", "HEAD").trim();
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

const copy = mkdtempSync(join(tmpdir(), "check-breaks-"));
// The copy goes at every end: success, a thrown error, a stop with Ctrl+C, or a kill.
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
const claims = list.claims.filter(
  (claim) => claim.id.includes(only) || claim.breaks.some((step) => step.id.includes(only)),
);
const problems = linkProblems({ claims }, read);
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

async function run(test: Claim["test"]): Promise<{ command: string; outcomes: TestOutcome[] }> {
  const out = join(copy, OUT);
  rmSync(out, { force: true });
  const name = escape(test.name);
  if (test.kind === "vitest") {
    const command = ["vitest", "run", test.file, "-t", name, "--reporter=json"];
    command.push(`--outputFile=${OUT}`);
    spawnSync(join(copy, "node_modules/.bin/vitest"), command.slice(1), { cwd: copy });
    return { command: shown(command), outcomes: vitestOutcomes(parse(out), test.name) };
  }
  await waitForPorts();
  const command = ["playwright", "test", "-c", "frontend/playwright.config.ts", test.file];
  command.push("--grep", name, "--no-deps", "--reporter=json");
  // The copy's own servers: no marker from the shell points them at a server that runs now.
  const env: NodeJS.ProcessEnv = { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: out };
  Reflect.deleteProperty(env, "E2E_SERVE_MARKER");
  spawnSync(join(copy, "node_modules/.bin/playwright"), command.slice(1), { cwd: copy, env });
  return { command: shown(command), outcomes: playwrightOutcomes(parse(out), test.name) };
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

const show = (v: Verdict) =>
  v.kind === "caught"
    ? `caught at \`${v.at}\``
    : v.kind === "survived"
      ? "SURVIVED"
      : `INVALID: ${v.reason}`;

const lines = [
  `# Break run of \`${listPath}\``,
  "",
  `- Commit: \`${head}\``,
  `- Local changes: ${local}`,
  `- Node ${process.version}; each command runs in a fresh copy with its own install`,
  "",
  "| Claim | Run | Command | Result |",
  "| --- | --- | --- | --- |",
];
let failures = 0;
for (const claim of claims) {
  const base = await run(claim.test);
  const ok = base.outcomes.length === 1 && base.outcomes[0]?.status === "passed";
  lines.push(`| ${claim.id} | no break | \`${base.command}\` | ${ok ? "passed" : "NOT PASSED"} |`);
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
    const result = await run(claim.test);
    writeFileSync(join(copy, step.file), original);
    const v = verdict(result.outcomes, { file: claim.test.file, line });
    if (v.kind !== "caught") failures += 1;
    lines.push(`| ${claim.id} | ${step.id} | \`${result.command}\` | ${show(v)} |`);
    console.log(`${step.id}: ${show(v)}`);
  }
}
lines.push("", `${String(failures)} problem(s)`);
const text = lines.join("\n");
console.log(`\n${text}`);
if (reportPath !== undefined) writeFileSync(reportPath, `${text}\n`);
process.exitCode = failures === 0 ? 0 : 1;
