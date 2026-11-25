import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { setTimeout as wait } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./codex-run.mjs", import.meta.url));
const config = fileURLToPath(new URL("./codex-run.config.json", import.meta.url));
const temporary = realpathSync(mkdtempSync(join(tmpdir(), "leader-selftest-")));
const finish = { finish: true };

function fakeCodex() {
  const fs = require("node:fs");
  const path = require("node:path");
  const { spawn } = require("node:child_process");
  const args = process.argv.slice(2);
  const scenario = JSON.parse(fs.readFileSync(process.env.FAKE_SCENARIO, "utf8"));
  const record = (entry) =>
    fs.appendFileSync(scenario.calls, JSON.stringify({ pid: process.pid, ...entry }) + "\n");
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function gate(pathname) {
    while (!fs.existsSync(pathname)) await delay(5);
  }

  async function main() {
    if (args[0] === "--version") {
      record({ kind: "version" });
      if (scenario.versionGate) await gate(scenario.versionGate);
      console.log("codex-cli fake");
      return;
    }
    if (args[0] === "orphan") {
      process.on("SIGINT", () => record({ kind: "orphan-signal" }));
      record({ kind: "orphan" });
      fs.writeFileSync(scenario.orphan, String(process.pid));
      await delay(5000);
      return;
    }
    if (scenario.exitMarker) process.on("exit", () => fs.writeFileSync(scenario.exitMarker, ""));
    let interrupted = false;
    process.on("SIGINT", () => {
      record({ kind: "interrupt" });
      if (interrupted) return;
      interrupted = true;
      setTimeout(() => process.exit(1), 25);
    });
    record({
      kind: "exec",
      args,
      cwd: process.cwd(),
      input: fs.readFileSync(0).toString("base64"),
    });
    if (scenario.threadEvent !== false) {
      console.log(JSON.stringify({ type: "thread.started", thread_id: scenario.thread }));
    }
    const folder = path.join(process.env.CODEX_HOME, "sessions", "2026", "11", "25");
    const session = path.join(folder, "rollout-fake-" + scenario.thread + ".jsonl");
    const report = args[args.indexOf("-o") + 1];
    const count = (used) =>
      JSON.stringify({
        payload: {
          type: "token_count",
          info: { last_token_usage: { total_tokens: used }, model_context_window: 10000 },
        },
      }) + "\n";

    for (const step of scenario.steps) {
      if (typeof step === "number" || step.bad) {
        fs.mkdirSync(folder, { recursive: true });
        fs.appendFileSync(session, typeof step === "number" ? count(step) : step.bad);
      } else if (step.wait) {
        await delay(step.wait);
      } else if (step.gate) {
        await gate(step.gate);
      } else if (step.orphan) {
        spawn(process.execPath, [__filename, "orphan"], { stdio: "ignore" }).unref();
        await gate(scenario.orphan);
      } else if (step.finish) {
        if (interrupted) return;
        fs.writeFileSync(report, step.report ?? "Fake last message\n");
        process.exitCode = step.code ?? 0;
        return;
      }
    }
    await delay(1400);
    if (!interrupted) process.exitCode = 89;
  }
  main().catch((error) => {
    console.error(error);
    process.exitCode = 90;
  });
}

const read = (path) => JSON.parse(readFileSync(path, "utf8"));

function alive(pid) {
  try {
    process.kill(pid, 0);
  } catch (error) {
    if (error.code === "ESRCH") return false;
    throw error;
  }
  try {
    return !execFileSync("ps", ["-p", String(pid), "-o", "stat="], { encoding: "utf8" })
      .trim()
      .startsWith("Z");
  } catch (error) {
    if (error.status === 1) return false;
    throw error;
  }
}

async function until(predicate, label, job) {
  const deadline = Date.now() + 3500;
  while (Date.now() < deadline) {
    const result = predicate();
    if (result) return result;
    if (job?.result) assert.fail(label + ": runner ended: " + JSON.stringify(job.result));
    await wait(5);
  }
  assert.fail(label + ": timed out");
}

function fixture(folder, runner) {
  const bin = join(folder, "bin");
  const work = join(folder, "work folder");
  const run = join(folder, "run folder");
  const other = join(folder, "other run");
  const home = join(folder, "codex-home");
  const calls = join(folder, "calls.jsonl");
  const brief = join(folder, "brief.txt");
  const message = join(folder, "message.txt");
  const image = join(folder, "image.png");
  const briefBytes = Buffer.from("First line\r\n\nΩ \t$()\n");
  const messageBytes = Buffer.from([0xc3, 0xa9, 0x0d, 0x0a, 0x09, 0xff]);
  const thread = "90ad4ddb-dead-426e-8179-ecf59fea5919";
  const secondThread = "bf595a54-b628-4a26-9509-64658135be27";
  const jobs = [];
  let sequence = 0;
  mkdirSync(bin);
  mkdirSync(work);
  writeFileSync(join(bin, "codex"), "#!/usr/bin/env node\n(" + fakeCodex.toString() + ")();\n", {
    mode: 0o700,
  });
  symlinkSync(process.execPath, join(bin, "node"));
  symlinkSync(existsSync("/bin/ps") ? "/bin/ps" : "/usr/bin/ps", join(bin, "ps"));
  writeFileSync(brief, briefBytes);
  writeFileSync(message, messageBytes);
  writeFileSync(image, "");

  function call(args, scenario = {}, preload) {
    const file = join(folder, "scenario-" + ++sequence + ".json");
    writeFileSync(file, JSON.stringify({ thread, calls, steps: [1200, finish], ...scenario }));
    const env = {
      ...process.env,
      PATH: bin,
      CODEX_HOME: home,
      FAKE_SCENARIO: file,
      NODE_OPTIONS: "",
    };
    const child = spawn(
      process.execPath,
      [...(preload ? ["--require", preload] : []), runner, ...args],
      {
        cwd: folder,
        env,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    const job = { child };
    jobs.push(job);
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (part) => (stdout += part));
    child.stderr.setEncoding("utf8").on("data", (part) => (stderr += part));
    job.end = new Promise((resolve, reject) => {
      child.on("error", reject);
      child.on("close", (code, signal) => {
        job.result = { code, signal, stdout, stderr };
        resolve(job.result);
      });
    });
    return job;
  }

  function start(
    scenario,
    {
      at = run,
      inWork = work,
      from = brief,
      sandbox = "workspace-write",
      interval = "0.04",
      startWait = "0.65",
      countWait = "6",
      options = [],
      preload,
    } = {},
  ) {
    return call(
      [
        "start",
        "--run-dir",
        at,
        "--workdir",
        inWork,
        "--brief",
        from,
        "--model",
        "fake-model",
        "--effort",
        "low",
        "--sandbox",
        sandbox,
        "--limit",
        "35",
        "--check-interval",
        interval,
        "--start-wait",
        startWait,
        "--count-wait",
        countWait,
        ...options,
      ],
      scenario,
      preload,
    );
  }

  const send = (scenario, options = []) =>
    call(["send", "--run-dir", run, "--message", message, ...options], scenario);
  const stop = (turn) => call(["stop", "--run-dir", run, "--turn", String(turn)]);
  const records = (kind) =>
    existsSync(calls)
      ? readFileSync(calls, "utf8")
          .trim()
          .split("\n")
          .map(JSON.parse)
          .filter((entry) => !kind || entry.kind === kind)
      : [];
  const file = (name, at = run) => join(at, name);
  const state = (at = run) => read(file("state.json", at));
  const entered = (job, number = 1) =>
    until(() => records("exec")[number - 1], "fake exec " + number, job);
  const live = () =>
    [
      ...new Set([...jobs.map(({ child }) => child.pid), ...records().map(({ pid }) => pid)]),
    ].filter((pid) => pid && alive(pid));

  async function cleanup() {
    for (const pid of live()) {
      try {
        process.kill(pid, "SIGKILL");
      } catch (error) {
        if (error.code !== "ESRCH") throw error;
      }
    }
    await Promise.allSettled(jobs.map(({ end }) => end));
    await until(() => live().length === 0, "test processes stopped");
  }

  return {
    folder,
    work,
    run,
    other,
    brief,
    image,
    briefBytes,
    messageBytes,
    thread,
    secondThread,
    call,
    start,
    send,
    stop,
    records,
    state,
    file,
    entered,
    live,
    cleanup,
  };
}

async function expectEnd(f, job, name, code, label, turn = 1, at = f.run) {
  const result = await job.end;
  assert.equal(
    result.code,
    code,
    label + ": exit (" + result.stderr.trim() + " " + result.stdout.trim() + ")",
  );
  assert.equal(f.state(at).state, name, label + ": recorded state");
  assert.equal(f.state(at).turn, turn, label + ": recorded turn");
  assert.match(
    result.stdout.trimEnd().split("\n").at(-1),
    new RegExp(
      "^state=" +
        name +
        " turn=" +
        turn +
        " thread=.* context=.* window=.* report=.* exit=" +
        code +
        "$",
    ),
    label + ": end line",
  );
  assert.equal(existsSync(f.file("lock", at)), false, label + ": lock released");
  return result;
}

async function expectUsage(job, label, message) {
  const result = await job.end;
  assert.equal(
    result.code,
    2,
    label + ": usage exit (" + result.stderr.trim() + " " + result.stdout.trim() + ")",
  );
  if (message) assert.match(result.stderr, message, label + ": usage reason");
}

const limitScenario = { steps: [1200, { wait: 180 }, 3500, finish] };
const limitTurn = (f) =>
  expectEnd(f, f.start(limitScenario, { interval: "1" }), "limit", 3, "final count");

const cases = [
  [
    1,
    "normal turn and context",
    async (f) => {
      const result = await expectEnd(f, f.start(), "done", 0, "normal");
      const report = f.file("t1-report.md");
      assert.equal(f.state().report, report, "normal: report path");
      assert.ok(
        result.stdout.includes("report=" + report + " exit=0"),
        "normal: printed report path",
      );
      assert.equal(readFileSync(report, "utf8"), "Fake last message\n", "normal: report content");
      assert.equal(
        f.records("exec")[0].input,
        f.briefBytes.toString("base64"),
        "normal: brief bytes",
      );
      for (const target of [
        ["--run-dir", f.run],
        ["--thread", f.thread],
      ]) {
        const context = await f.call(["context", ...target]).end;
        assert.equal(context.code, 0, "normal: context exit");
        assert.match(context.stdout, /12(?:\.0+)?%.*10000/, "normal: context reading");
      }
      const log = readFileSync(f.file("run.log"), "utf8");
      for (const text of ["codex-cli fake", "fake-model", "1200", "state=done"]) {
        assert.ok(log.includes(text), "normal: log includes " + text);
      }
    },
  ],
  [
    2,
    "cross the limit while running",
    async (f) => {
      await expectEnd(
        f,
        f.start({ steps: [1200, { wait: 100 }, 3600] }),
        "limit",
        3,
        "crossed limit",
      );
      assert.equal(f.records("interrupt").length, 1, "crossed limit: one SIGINT");
    },
  ],
  [
    3,
    "reach the exact limit",
    async (f) => {
      await expectEnd(
        f,
        f.start({ steps: [3500, { wait: 190 }, finish] }),
        "limit",
        3,
        "exact limit",
      );
      assert.equal(f.records("interrupt").length, 1, "exact limit: one SIGINT");
    },
  ],
  [
    4,
    "stay just below the limit",
    async (f) => {
      await expectEnd(
        f,
        f.start({ steps: [3496, { wait: 140 }, finish] }),
        "done",
        0,
        "below limit",
      );
      assert.equal(f.records("interrupt").length, 0, "below limit: no SIGINT");
    },
  ],
  [
    5,
    "end above the limit between checks",
    async (f) => {
      await limitTurn(f);
      assert.equal(f.records("interrupt").length, 0, "final count: natural exit");
      assert.equal(
        readFileSync(f.file("t1-report.md"), "utf8"),
        "Fake last message\n",
        "final count: kept report",
      );
    },
  ],
  [
    6,
    "Codex exits during a session read",
    async (f) => {
      const gate = join(f.folder, "read-started");
      const exitMarker = join(f.folder, "codex-exited");
      const preload = join(f.folder, "overlap.cjs");
      writeFileSync(
        preload,
        [
          'const fs = require("node:fs");',
          "const open = fs.openSync;",
          "const gate = " + JSON.stringify(gate) + ";",
          "const exit = " + JSON.stringify(exitMarker) + ";",
          "fs.openSync = function (path, ...args) {",
          "  const fd = open(path, ...args);",
          '  if (String(path).includes("rollout-") && !fs.existsSync(gate)) {',
          '    fs.writeFileSync(gate, "");',
          "    const deadline = Date.now() + 1500;",
          "    while (!fs.existsSync(exit) && Date.now() < deadline) {",
          "      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);",
          "    }",
          '    if (!fs.existsSync(exit)) throw new Error("Codex did not exit during the read");',
          "  }",
          "  return fd;",
          "};",
        ].join("\n"),
      );
      const result = await expectEnd(
        f,
        f.start({ steps: [1200, { gate }, finish], exitMarker }, { preload }),
        "done",
        0,
        "overlap",
      );
      assert.ok(
        existsSync(exitMarker) && existsSync(gate),
        "overlap: read and child exit overlapped",
      );
      assert.equal(
        result.stdout.split("\n").filter((line) => line.startsWith("state=")).length,
        1,
        "overlap: one end line",
      );
      assert.equal(
        readFileSync(f.file("run.log"), "utf8")
          .split("\n")
          .filter((line) => line.includes("state=done")).length,
        1,
        "overlap: one logged end",
      );
    },
  ],
  [
    7,
    "handoff above the limit",
    async (f) => {
      await expectEnd(f, f.start({ steps: [3500] }), "limit", 3, "setup handoff");
      const release = join(f.folder, "release-handoff");
      const runner = f.send({ steps: [3600, { gate: release }, { wait: 60 }, finish] }, [
        "--handoff",
      ]);
      await until(
        () => readFileSync(f.file("run.log"), "utf8").includes("turn 2 context: 3600"),
        "handoff: over-limit count observed",
        runner,
      );
      writeFileSync(release, "");
      await expectEnd(f, runner, "limit", 3, "handoff", 2);
      assert.equal(f.records("interrupt").length, 1, "handoff: no SIGINT");
      assert.equal(
        readFileSync(f.file("t2-report.md"), "utf8"),
        "Fake last message\n",
        "handoff: kept report",
      );
    },
  ],
  [
    8,
    "require handoff after a limit",
    async (f) => {
      await limitTurn(f);
      await expectUsage(f.send(), "missing handoff", /--handoff/);
      assert.equal(f.records("exec").length, 1, "missing handoff: no new exec");
    },
  ],
  [
    9,
    "resume requires a fresh context count",
    async (f) => {
      await expectEnd(f, f.start(), "done", 0, "setup resume");
      await expectEnd(f, f.send({ steps: [] }), "watch-error", 4, "stale count", 2);
      assert.equal(f.records("interrupt").length, 1, "stale count: SIGINT");
    },
  ],
  [
    10,
    "missing thread event",
    async (f) => {
      await expectEnd(
        f,
        f.start({ threadEvent: false, steps: [] }, { startWait: "0.18" }),
        "watch-error",
        4,
        "missing thread",
      );
      assert.equal(f.records("interrupt").length, 1, "missing thread: SIGINT");
    },
  ],
  [
    11,
    "late count arrives in time",
    async (f) => {
      await expectEnd(
        f,
        f.start({ steps: [{ wait: 170 }, 1200, { wait: 70 }, finish] }, { countWait: "12" }),
        "done",
        0,
        "late count",
      );
      assert.equal(f.records("interrupt").length, 0, "late count: no SIGINT");
    },
  ],
  [
    12,
    "missing session and unreadable count after a good count",
    async (f) => {
      const variants = [
        [],
        [1200, { wait: 110 }, { bad: '{"payload":{"type":"token_count","info":{}}}\n' }],
        [1200, { wait: 110 }, { bad: '{"payload":{"type":"token_count"' }],
      ];
      for (const [index, steps] of variants.entries()) {
        const at = join(f.folder, "unreadable-" + index);
        const thread = "2bd6c431-e44f-4ed0-99c2-4dec5101490" + index;
        await expectEnd(
          f,
          f.start({ steps, thread }, { at }),
          "watch-error",
          4,
          "unreadable " + index,
          1,
          at,
        );
        assert.equal(f.records("interrupt").length, index + 1, "unreadable: SIGINT");
      }
      await expectEnd(
        f,
        f.start({ thread: f.secondThread, steps: [finish] }, { at: f.other }),
        "watch-error",
        4,
        "unreadable on natural exit",
        1,
        f.other,
      );
      assert.equal(
        f.records("interrupt").length,
        variants.length,
        "unreadable on natural exit: no SIGINT",
      );
    },
  ],
  [
    13,
    "Codex fails or leaves an empty report",
    async (f) => {
      await expectEnd(
        f,
        f.start({ steps: [1200, { finish: true, code: 1 }] }),
        "codex-error",
        5,
        "Codex exit 1",
      );
      await expectEnd(
        f,
        f.start(
          { thread: f.secondThread, steps: [1200, { finish: true, report: "" }] },
          { at: f.other },
        ),
        "codex-error",
        5,
        "empty report",
        1,
        f.other,
      );
      assert.equal(f.records("interrupt").length, 0, "Codex error: no SIGINT");
    },
  ],
  [
    14,
    "resolve paths before entering the work folder",
    async (f) => {
      const rel = (path) => relative(f.folder, path);
      await expectEnd(
        f,
        f.start(undefined, { at: rel(f.run), from: rel(f.brief), inWork: rel(f.work) }),
        "done",
        0,
        "relative paths",
      );
      const [invocation] = f.records("exec");
      assert.equal(invocation.cwd, f.work, "relative paths: work folder");
      assert.equal(invocation.input, f.briefBytes.toString("base64"), "relative paths: brief");
      assert.equal(f.state().report, f.file("t1-report.md"), "relative paths: report");
    },
  ],
  [
    15,
    "refuse existing and writable run folders",
    async (f) => {
      mkdirSync(f.run);
      const writable = join(f.folder, "writable");
      const alias = join(f.folder, "alias");
      mkdirSync(writable);
      symlinkSync(writable, alias);
      await expectUsage(f.start(), "existing folder");
      await expectUsage(f.start(undefined, { at: join(f.work, "new-run") }), "work folder");
      for (const root of [writable, alias]) {
        await expectUsage(
          f.start(undefined, { at: join(root, "new-run"), options: ["--writable-root", writable] }),
          "writable root",
        );
      }
      assert.equal(f.records("exec").length, 0, "unsafe folders: no exec");
    },
  ],
  [
    16,
    "one start wins and a concurrent send is refused",
    async (f) => {
      const release = join(f.folder, "release");
      const scenario = { steps: [1200, { gate: release }, finish] };
      const first = f.start(scenario);
      const second = f.start(scenario);
      const loser = await Promise.race([
        first.end.then(() => first),
        second.end.then(() => second),
      ]);
      await expectUsage(loser, "concurrent start");
      const winner = loser === first ? second : first;
      await f.entered(winner);
      await expectUsage(f.send(), "concurrent send");
      assert.equal(f.records("exec").length, 1, "concurrent start and send: one exec");
      writeFileSync(release, "");
      await expectEnd(f, winner, "done", 0, "winning start");
    },
  ],
  [
    17,
    "resume keeps the run options and message bytes",
    async (f) => {
      const roots = [join(f.folder, "write one"), join(f.folder, "write two")];
      for (const path of roots) mkdirSync(path);
      const options = [
        "--writable-root",
        relative(f.folder, roots[0]),
        "--writable-root",
        roots[1],
        "--network",
        "--image",
        relative(f.folder, f.image),
        "--skip-git-check",
      ];
      await expectEnd(f, f.start(undefined, { options }), "done", 0, "setup options");
      await expectEnd(f, f.send(), "done", 0, "resume options", 2);
      const [first, resumed] = f.records("exec");
      assert.equal(
        resumed.input,
        f.messageBytes.toString("base64"),
        "resume options: message bytes",
      );
      assert.equal(resumed.cwd, f.work, "resume options: work folder");
      assert.deepEqual(
        resumed.args.slice(0, 3),
        ["exec", "resume", f.thread],
        "resume options: thread",
      );
      for (const { args } of [first, resumed]) {
        assert.equal(args[args.indexOf("-m") + 1], "fake-model", "resume options: model");
        assert.ok(args.includes('model_reasoning_effort="low"'), "resume options: effort");
        assert.ok(args.includes('service_tier="default"'), "resume options: service tier");
        assert.ok(
          args.includes("sandbox_workspace_write.writable_roots=" + JSON.stringify(roots)),
          "resume options: roots",
        );
        assert.ok(
          args.includes("sandbox_workspace_write.network_access=true"),
          "resume options: network",
        );
        assert.equal(args[args.indexOf("-i") + 1], f.image, "resume options: image");
        assert.ok(args.includes("--skip-git-repo-check"), "resume options: skip Git check");
      }
      assert.ok(resumed.args.includes('sandbox_mode="workspace-write"'), "resume options: sandbox");
      assert.ok(
        !resumed.args.some((arg) => ["-s", "-C", "-p"].includes(arg)),
        "resume options: unsupported flags",
      );
    },
  ],
  [
    18,
    "stop before the locked turn launches Codex",
    async (f) => {
      const versionGate = join(f.folder, "version-release");
      const runner = f.start({ versionGate });
      await until(() => f.records("version").length, "pre-start version", runner);
      assert.equal((await f.stop(1).end).code, 0, "pre-start stop: request");
      writeFileSync(versionGate, "");
      await expectEnd(f, runner, "stopped", 6, "pre-start stop");
      assert.equal(f.records("exec").length, 0, "pre-start stop: no exec");
      assert.equal(existsSync(f.file("t1-events.jsonl")), false, "pre-start stop: no events file");
    },
  ],
  [
    19,
    "stop a running turn",
    async (f) => {
      const runner = f.start({ steps: [1200] });
      await f.entered(runner);
      assert.equal((await f.stop(1).end).code, 0, "running stop: request");
      await expectEnd(f, runner, "stopped", 6, "running stop");
      assert.equal(f.records("interrupt").length, 1, "running stop: one SIGINT");
    },
  ],
  [
    20,
    "ignore a stop for an ended turn",
    async (f) => {
      await expectEnd(f, f.start(), "done", 0, "setup late stop");
      const release = join(f.folder, "release");
      const runner = f.send({ steps: [1200, { gate: release }, finish] });
      await f.entered(runner, 2);
      const result = await f.stop(1).end;
      assert.equal(result.code, 0, "late stop: exit");
      assert.match(result.stdout, /ended/, "late stop: already ended");
      writeFileSync(release, "");
      await expectEnd(f, runner, "done", 0, "late stop", 2);
      assert.equal(f.records("interrupt").length, 0, "late stop: no SIGINT");
    },
  ],
  [
    21,
    "SIGTERM to the runner",
    async (f) => {
      const runner = f.start({ steps: [1200] });
      await f.entered(runner);
      assert.ok(runner.child.kill("SIGTERM"), "runner signal: delivered");
      await expectEnd(f, runner, "stopped", 6, "runner signal");
      assert.equal(f.records("interrupt").length, 1, "runner signal: Codex got SIGINT");
      assert.deepEqual(f.live(), [], "runner signal: no process left");
    },
  ],
  [
    22,
    "report a surviving descendant",
    async (f) => {
      const orphan = join(f.folder, "orphan-ready");
      const runner = f.start({ steps: [1200, { orphan: true }], orphan });
      await until(() => existsSync(orphan), "orphan became ready", runner);
      await f.stop(1).end;
      await expectEnd(f, runner, "cleanup-error", 7, "surviving descendant");
      const pid = Number(readFileSync(orphan, "utf8"));
      assert.ok(alive(pid), "surviving descendant: remains alive");
      assert.ok(f.state().pids.includes(pid), "surviving descendant: state lists PID");
      assert.equal(f.records("orphan-signal").length, 0, "surviving descendant: got no SIGINT");
      await expectUsage(f.send(), "surviving descendant: cannot resume");
      process.kill(pid, "SIGTERM");
      await until(() => !alive(pid), "surviving descendant stopped by test");
    },
  ],
  [
    23,
    "two independent run folders",
    async (f) => {
      const release = join(f.folder, "release");
      const first = f.start({
        steps: [1200, { gate: release }, { finish: true, report: "First" }],
      });
      const second = f.start({ thread: f.secondThread, steps: [3600] }, { at: f.other });
      await expectEnd(f, second, "limit", 3, "second independent run", 1, f.other);
      writeFileSync(release, "");
      await expectEnd(f, first, "done", 0, "first independent run");
      assert.equal(f.state().thread, f.thread, "independent runs: first thread");
      assert.equal(f.state(f.other).thread, f.secondThread, "independent runs: second thread");
      assert.equal(
        readFileSync(f.file("t1-report.md"), "utf8"),
        "First",
        "independent runs: first report",
      );
    },
  ],
  [
    24,
    "reject ephemeral sessions",
    async (f) => {
      await expectUsage(
        f.start(undefined, { options: ["--ephemeral"] }),
        "ephemeral session",
        /ephemeral/,
      );
      assert.equal(f.records("exec").length, 0, "ephemeral session: no exec");
    },
  ],
  [
    25,
    "a read-only handoff saves the last message",
    async (f) => {
      await expectEnd(
        f,
        f.start(undefined, { sandbox: "read-only" }),
        "done",
        0,
        "setup read-only",
      );
      await expectEnd(
        f,
        f.send({ steps: [1200, { finish: true, report: "Review handoff.\n" }] }, ["--handoff"]),
        "done",
        0,
        "read-only handoff",
        2,
      );
      assert.ok(
        f.records("exec")[1].args.includes('sandbox_mode="read-only"'),
        "read-only handoff: sandbox",
      );
      assert.equal(
        readFileSync(f.file("t2-report.md"), "utf8"),
        "Review handoff.\n",
        "read-only handoff: last message",
      );
    },
  ],
  [
    27,
    "recover the lock after the runner dies",
    async (f) => {
      await expectEnd(f, f.start(), "done", 0, "setup recovery");
      async function crash(turn, execNumber) {
        const runner = f.send({ steps: [1200] });
        const invocation = await f.entered(runner, execNumber);
        const lock = await until(
          () => {
            const data = read(f.file("lock"));
            return data.codexPid === invocation.pid && data;
          },
          "Codex PID in lock",
          runner,
        );
        assert.equal(lock.pid, runner.child.pid, "recovery: runner PID");
        assert.equal(lock.turn, turn, "recovery: lost turn number");
        assert.ok(runner.child.kill("SIGKILL"), "recovery: kill test runner");
        assert.equal((await runner.end).signal, "SIGKILL", "recovery: runner killed");
        assert.equal(f.state().turn, turn - 1, "recovery: no end record for killed turn");
        return invocation.pid;
      }
      async function stopFake(pid) {
        process.kill(pid, "SIGTERM");
        await until(() => !alive(pid), "orphaned fake Codex stopped by test");
      }
      const pid = await crash(2, 2);
      await expectUsage(f.send(), "recovery: live Codex blocks send", new RegExp(String(pid)));
      await expectUsage(f.start(), "recovery: live Codex blocks start", new RegExp(String(pid)));
      await stopFake(pid);
      await expectUsage(f.start(), "recovery: start still refuses existing folder");
      assert.equal(f.state().state, "stopped", "recovery: stale turn stopped");
      assert.equal(f.state().note, "runner ended with no record", "recovery: saved note");
      assert.equal(f.state().turn, 2, "recovery: saved turn");
      await expectEnd(f, f.send(), "done", 0, "recovery send after start", 3);
      await stopFake(await crash(4, 4));
      await expectEnd(f, f.send(), "done", 0, "recovery send directly", 5);
      assert.match(
        readFileSync(f.file("run.log"), "utf8"),
        /state=stopped turn=4.*runner ended with no record/,
        "recovery: log preserves repaired turn",
      );
    },
  ],
];

async function runCase([number, , test], runner = script) {
  const folder = mkdtempSync(join(temporary, "case-" + number + "-"));
  const f = fixture(folder, runner);
  try {
    await test(f);
    const listing = execFileSync("ps", ["-A", "-o", "pid=,ppid="], { encoding: "utf8" });
    const listed = new Set(
      listing
        .trim()
        .split("\n")
        .map((line) => Number(line.trim().split(/\s+/)[0])),
    );
    assert.deepEqual(
      f.live().filter((pid) => listed.has(pid)),
      [],
      "test left a live process",
    );
  } finally {
    await f.cleanup();
    rmSync(folder, { recursive: true, force: true });
  }
}

async function proveBreak(entry, runner, reason) {
  try {
    await runCase(entry, runner);
  } catch (error) {
    assert.match(
      error.message,
      reason,
      "case " + entry[0] + " did not fail at the intended assertion",
    );
    return;
  }
  assert.fail("case " + entry[0] + " survived the break");
}

const breaks = [
  [
    1,
    "replace the brief with empty stdin",
    '[input, "r"]',
    '["/dev/null", "r"]',
    /normal: brief bytes/,
  ],
  [
    2,
    "skip the in-turn limit stop",
    'interrupt("limit", "context limit reached");',
    "void count;",
    /crossed limit: exit/,
  ],
  [
    3,
    "use > for the limit comparison",
    "return used * 100 >= limit * window;",
    "return used * 100 > limit * window;",
    /exact limit: exit/,
  ],
  [
    4,
    "round the percentage before comparison",
    "return used * 100 >= limit * window;",
    "return Math.round((100 * used) / window) >= limit;",
    /below limit: exit/,
  ],
  [
    5,
    "omit the final limit decision",
    'state = atLimit(count, args.limit) ? "limit" : "done";',
    'state = "done";',
    /final count: exit/,
  ],
  [
    6,
    "print two end lines",
    "console.log(stateLine(state));",
    "console.log(stateLine(state));\nconsole.log(stateLine(state));",
    /overlap: one end line/,
  ],
  [
    7,
    "apply the in-turn limit to a handoff",
    "count && !handoff && atLimit(count, args.limit)",
    "count && atLimit(count, args.limit)",
    /handoff: (no SIGINT|kept report|exit)/,
  ],
  [
    8,
    "allow a regular send after a limit",
    'state?.state === "limit" && !opts.handoff',
    "false",
    /missing handoff: usage exit/,
  ],
  [
    9,
    "read the old context count on resume",
    "watchCounts(thread, baseline?.path, baseline?.offset)",
    "watchCounts(thread, baseline?.path)",
    /stale count: exit/,
  ],
  [
    10,
    "keep resetting the wait for the thread event",
    "startWait - (performance.now() - started)",
    "startWait",
    /missing thread: exit/,
  ],
  [
    11,
    "stop after one missed count",
    "if (missing >= countWait)",
    "if (missing >= 1)",
    /late count: exit/,
  ],
  [
    12,
    "ignore a token count with missing usage",
    'if (event.payload?.type !== "token_count") return;',
    'if (event.payload?.type !== "token_count" || !event.payload.info?.last_token_usage) return;',
    /unreadable 1: exit/,
  ],
  [
    13,
    "accept an empty report",
    "!fs.statSync(report, { throwIfNoEntry: false })?.size",
    "false",
    /empty report: exit/,
  ],
  [
    14,
    "pass a relative run folder to Codex",
    'const dir = opts["run-dir"] ? canonical(opts["run-dir"]) : null;',
    'const dir = opts["run-dir"] ?? null;',
    /relative paths: exit/,
  ],
  [
    15,
    "remove the writable folder check",
    "if (inside(canonical(root), dir))",
    "if (false)",
    /work folder: usage exit/,
  ],
  [
    16,
    "return success for a concurrent send",
    "    recoverLock(dir);\n    args = readJson(argsPath);",
    "    if (fs.existsSync(lockPath)) return 0;\n    recoverLock(dir);\n    args = readJson(argsPath);",
    /concurrent send: usage exit/,
  ],
  [
    17,
    "send the brief instead of the message",
    "input = canonical(opts.message);",
    "input = args.brief;",
    /resume options: message bytes/,
  ],
  [
    18,
    "ignore a stop before launch",
    "cause || fs.existsSync(request)",
    "cause",
    /pre-start stop: no (exec|events file)/,
  ],
  [
    19,
    "ignore a stop while Codex runs",
    "if (fs.existsSync(request)) {",
    "if (false) {",
    /running stop: one SIGINT/,
  ],
  [
    20,
    "retarget a late stop to the active turn",
    'const ended = () => (readJson(join(dir, "state.json"))?.turn ?? 0) >= turn;',
    'turn = lock?.turn ?? turn;\nconst ended = () => (readJson(join(dir, "state.json"))?.turn ?? 0) >= turn;',
    /late stop: already ended/,
  ],
  [
    21,
    "classify a runner signal as a watch error",
    'interrupt("stopped", "signal to runner");',
    'interrupt("watch-error", "signal to runner");',
    /runner signal: exit/,
  ],
  [
    22,
    "ignore a descendant that survives",
    "pids.length || descendantError",
    "descendantError",
    /surviving descendant: exit/,
  ],
  [
    23,
    "share one lock across run folders",
    'const lockPath = join(dir, "lock");',
    'const lockPath = join(dirname(dir), "lock");',
    /second independent run:/,
  ],
  [
    24,
    "accept --ephemeral",
    'if (name === "ephemeral") fail("--ephemeral disables the session file required by the watch.");',
    'if (name === "ephemeral") continue;',
    /ephemeral session: usage exit/,
  ],
  [
    25,
    "drop the report option on a read-only resume",
    'result.push("--json", "-o", report, "-");',
    'if (thread && args.sandbox === "read-only") result.push("--json", "-");\nelse result.push("--json", "-o", report, "-");',
    /read-only handoff: exit/,
  ],
  [
    27,
    "reclaim the lock while orphaned Codex runs",
    "if (running(lock.codexPid))",
    "if (false)",
    /recovery: live Codex blocks send: usage exit/,
  ],
];

async function proveCases() {
  const source = readFileSync(script, "utf8");
  assert.deepEqual(
    breaks.map(([number]) => number),
    cases.map(([number]) => number),
    "one break per behavior case",
  );
  const folder = join(temporary, "broken");
  mkdirSync(folder);
  const target = join(folder, "codex-run.mjs");
  writeFileSync(join(folder, "codex-run.config.json"), readFileSync(config));
  for (const [number, description, from, to, reason] of breaks) {
    assert.equal(source.split(from).length, 2, "case " + number + ": unique break target");
    writeFileSync(
      target,
      source.replace(from, () => to),
    );
    await proveBreak(
      cases.find(([id]) => id === number),
      target,
      reason,
    );
    console.log("break " + number + ": " + description + " — expected failure");
  }
  writeFileSync(target, source);
  await assert.rejects(proveBreak(cases[0], target, /normal/), /case 1 survived the break/);
}

let failures = 0;
try {
  for (const entry of cases) {
    const [number, name] = entry;
    try {
      await runCase(entry);
      console.log("case " + number + ": pass — " + name);
    } catch (error) {
      failures += 1;
      console.error("case " + number + ": fail — " + name + "\n" + error.message);
    }
  }
  try {
    await proveCases();
    console.log("case 26: pass — each behavior case detects its break");
  } catch (error) {
    failures += 1;
    console.error("case 26: fail — " + error.message);
  }
  console.log("selftest: " + (cases.length + 1 - failures) + "/" + (cases.length + 1) + " passed");
  process.exitCode = failures ? 1 : 0;
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
