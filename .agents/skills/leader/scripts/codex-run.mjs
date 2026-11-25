import { execFile, execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { StringDecoder } from "node:string_decoder";
import { promisify } from "node:util";

const exits = {
  done: 0,
  limit: 3,
  "watch-error": 4,
  "codex-error": 5,
  stopped: 6,
  "cleanup-error": 7,
};
const watchFlags = ["check-interval", "start-wait", "count-wait"];
const options = {
  start: {
    required: ["run-dir", "workdir", "brief", "model", "effort", "sandbox", "limit"],
    values: ["writable-root", "image", ...watchFlags],
    flags: ["network", "skip-git-check"],
  },
  send: { required: ["run-dir", "message"], values: watchFlags, flags: ["handoff"] },
  context: { required: [], values: ["run-dir", "thread"], flags: [] },
  stop: { required: ["run-dir", "turn"], values: [], flags: [] },
};
const versionOf = promisify(execFile);
const codexHome = resolve(process.env.CODEX_HOME || join(homedir(), ".codex"));
const sessions = join(codexHome, "sessions");
const codexEnv = { ...process.env, CODEX_HOME: codexHome };

class UsageError extends Error {}

function fail(message) {
  throw new UsageError(message);
}

function parse(command, argv) {
  const spec = Object.hasOwn(options, command) && options[command];
  if (!spec) fail("Choose a command: start, send, context, or stop.");
  const result = Object.create(null);
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const name = flag.startsWith("--") ? flag.slice(2) : "";
    if (name === "ephemeral") fail("--ephemeral disables the session file required by the watch.");
    if (Object.hasOwn(result, name) && name !== "writable-root") fail("Option repeated: " + flag);
    if (spec.flags.includes(name)) {
      result[name] = true;
      continue;
    }
    if (![...spec.required, ...spec.values].includes(name)) fail("Unknown option: " + flag);
    const value = argv[++index];
    if (!value || value.startsWith("--")) fail("Give a value for " + flag);
    if (name === "writable-root") (result[name] ??= []).push(value);
    else result[name] = value;
  }
  for (const name of spec.required) {
    if (!Object.hasOwn(result, name)) fail("Required option: --" + name);
  }
  return result;
}

function number(value, option, min, max) {
  const parsed = typeof value === "number" || /^\d+(?:\.\d+)?$/.test(value) ? Number(value) : NaN;
  if (!Number.isFinite(parsed) || parsed < min || parsed > max)
    fail("Invalid value for --" + option + ": " + value);
  return parsed;
}

function positiveInteger(value, option) {
  const parsed = number(value, option, 1, Number.MAX_SAFE_INTEGER);
  if (!Number.isSafeInteger(parsed)) fail("Give a positive integer for --" + option);
  return parsed;
}

function canonical(path) {
  const absolute = resolve(path);
  try {
    return fs.realpathSync(absolute);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const parent = dirname(absolute);
    if (parent === absolute) throw error;
    return join(canonical(parent), relative(parent, absolute));
  }
}

function inside(root, path) {
  const part = relative(root, path);
  return part === "" || (part !== ".." && !part.startsWith(".." + sep) && !isAbsolute(part));
}

function validateFolder(dir, args) {
  for (const root of [args.workdir, ...args.roots]) {
    if (inside(canonical(root), dir))
      fail("The run folder is inside a work folder or writable root: " + root);
  }
}

function readJson(path) {
  try {
    return JSON.parse(fs.readFileSync(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function writeJson(path, value, exclusive = false) {
  const temporary = path + "." + process.pid + ".tmp";
  fs.writeFileSync(temporary, JSON.stringify(value) + "\n", { mode: 0o600 });
  try {
    if (exclusive) fs.linkSync(temporary, path);
    else fs.renameSync(temporary, path);
    return true;
  } catch (error) {
    if (exclusive && error.code === "EEXIST") return false;
    throw error;
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

function log(dir, message) {
  fs.appendFileSync(join(dir, "run.log"), new Date().toISOString() + " " + message + "\n");
}

function stateLine(state) {
  return [
    "state=" + state.state,
    "turn=" + state.turn,
    "thread=" + (state.thread ?? "-"),
    "context=" + (state.context ?? "-"),
    "window=" + (state.window ?? "-"),
    "report=" + state.report,
    "exit=" + state.exit,
  ].join(" ");
}

function recordEnd(dir, state) {
  writeJson(join(dir, "state.json"), state);
  log(dir, stateLine(state) + (state.note ? " " + state.note : ""));
}

function turnFile(dir, turn, name) {
  return join(dir, "t" + turn + "-" + name);
}

function makeState(dir, turn, state, { thread, count, note, pids } = {}) {
  return {
    state,
    turn,
    thread: thread ?? null,
    context: count ? percent(count) : null,
    window: count?.window ?? null,
    report: turnFile(dir, turn, "report.md"),
    exit: exits[state],
    note,
    pids,
  };
}

function running(pid) {
  if (pid == null) return false;
  if (!Number.isSafeInteger(pid) || pid < 1) fail("Invalid process ID in the run record.");
  try {
    process.kill(pid, 0);
  } catch (error) {
    if (error.code === "ESRCH") return false;
    if (error.code === "EPERM") return true;
    throw error;
  }
  try {
    const status = execFileSync("ps", ["-p", String(pid), "-o", "stat="], { encoding: "utf8" });
    return Boolean(status.trim()) && !status.trimStart().startsWith("Z");
  } catch (error) {
    if (error.status === 1) return false;
    throw error;
  }
}

function rejectRunning(lock, path) {
  if (running(lock.pid)) fail("Turn " + lock.turn + " is active (runner PID " + lock.pid + ").");
  if (running(lock.codexPid))
    fail("Turn " + lock.turn + " still has Codex PID " + lock.codexPid + ".");
  if (lock.launchPending && lock.codexPid == null)
    fail(
      "Turn " +
        lock.turn +
        " may still have Codex processes. " +
        "Confirm they have all ended before removing the launchPending field from " +
        path +
        ". " +
        "Keep the lock file so the next command can record the interrupted turn.",
    );
}

function recoverLock(dir) {
  const path = join(dir, "lock");
  const old = readJson(path);
  if (!old) return;
  rejectRunning(old, path);
  const claims = [];
  let acquired = false;
  try {
    for (let slot = 0; ; slot += 1) {
      const claim = join(dir, ".recover-" + old.turn + "-" + old.pid + "-" + slot);
      if (writeJson(claim, { pid: process.pid }, true)) {
        claims.push(claim);
        acquired = true;
        break;
      }
      const owner = readJson(claim);
      if (!owner) {
        slot -= 1;
        continue;
      }
      if (running(owner.pid))
        fail("Turn " + old.turn + " is being recovered (PID " + owner.pid + ").");
      claims.push(claim);
    }
    const current = readJson(path);
    if (!current || current.pid !== old.pid || current.turn !== old.turn) return;
    rejectRunning(current, path);
    const previous = readJson(join(dir, "state.json"));
    if (!previous || previous.turn < old.turn) {
      const thread = threadFrom(turnFile(dir, old.turn, "events.jsonl")) ?? previous?.thread;
      recordEnd(
        dir,
        makeState(dir, old.turn, "stopped", { thread, note: "runner ended with no record" }),
      );
    }
    fs.rmSync(turnFile(dir, old.turn, "stop"), { force: true });
    fs.unlinkSync(path);
  } finally {
    if (acquired) for (const claim of claims) fs.rmSync(claim, { force: true });
  }
}

function stop(dir, turn) {
  const lock = readJson(join(dir, "lock"));
  const ended = () => (readJson(join(dir, "state.json"))?.turn ?? 0) >= turn;
  if (ended()) {
    console.log("Turn " + turn + " already ended.");
    return;
  }
  if (lock?.turn !== turn || !running(lock.pid)) fail("Turn " + turn + " is not active.");
  const request = turnFile(dir, turn, "stop");
  fs.closeSync(fs.openSync(request, "a", 0o600));
  if (ended()) {
    fs.rmSync(request, { force: true });
    console.log("Turn " + turn + " already ended.");
  } else {
    console.log("Stop requested for turn " + turn + ".");
  }
}

function validThread(thread) {
  return typeof thread === "string" && /^[a-zA-Z0-9_-]+$/.test(thread);
}

function findSession(thread) {
  function find(folder, depth) {
    let entries;
    try {
      entries = fs.readdirSync(folder, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
    if (depth === 0) {
      const file = entries.find(
        (entry) =>
          entry.isFile() &&
          entry.name.startsWith("rollout-") &&
          entry.name.endsWith("-" + thread + ".jsonl"),
      );
      return file ? join(folder, file.name) : null;
    }
    entries.sort((a, b) => b.name.localeCompare(a.name));
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const path = find(join(folder, entry.name), depth - 1);
      if (path) return path;
    }
    return null;
  }
  return find(sessions, 3);
}

function cursor(offset = 0) {
  return { offset, tail: "", decoder: new StringDecoder("utf8") };
}

function readLines(path, position, consume) {
  const fd = fs.openSync(path, "r");
  try {
    const { size } = fs.fstatSync(fd);
    if (size < position.offset) throw new Error("JSONL file shrank.");
    if (size === position.offset) return;
    const buffer = Buffer.allocUnsafe(Math.min(size - position.offset, 64 * 1024));
    while (position.offset < size) {
      const length = fs.readSync(
        fd,
        buffer,
        0,
        Math.min(buffer.length, size - position.offset),
        position.offset,
      );
      if (length === 0) break;
      position.offset += length;
      const lines = (position.tail + position.decoder.write(buffer.subarray(0, length))).split(
        "\n",
      );
      position.tail = lines.pop();
      for (const line of lines) {
        if (consume(line) === false) return;
      }
    }
  } finally {
    fs.closeSync(fd);
  }
}

function parseLine(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function threadFrom(path) {
  let thread = null;
  try {
    readLines(path, cursor(), (line) => {
      const event = parseLine(line);
      if (event?.type !== "thread.started" || !validThread(event.thread_id)) return;
      thread = event.thread_id;
      return false;
    });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return thread;
}

function watchCounts(thread, path = null, offset = 0) {
  const position = cursor(offset);
  let latest = null;
  return () => {
    path ??= findSession(thread);
    if (!path) return null;
    readLines(path, position, (line) => {
      if (!line.trim()) return;
      const event = parseLine(line);
      if (!event) {
        latest = null;
        return;
      }
      if (event.payload?.type !== "token_count") return;
      const info = event.payload.info;
      const used = info?.last_token_usage?.total_tokens;
      const window = info?.model_context_window;
      latest =
        Number.isSafeInteger(used) && used >= 0 && Number.isSafeInteger(window) && window > 0
          ? { used, window }
          : null;
    });
    return position.tail.trim() ? null : latest;
  };
}

function percent({ used, window }) {
  return ((100 * used) / window).toFixed(2) + "%";
}

function atLimit({ used, window }, limit) {
  return used * 100 >= limit * window;
}

function sampleDescendants(codexPid, descendants) {
  if (!codexPid) return;
  const list = execFileSync("ps", ["-A", "-o", "pid=,ppid="], { encoding: "utf8" });
  const children = new Map();
  for (const line of list.trim().split("\n")) {
    const [pid, parent] = line.trim().split(/\s+/).map(Number);
    if (!pid) continue;
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(pid);
  }
  const queue = new Set([codexPid, ...descendants]);
  for (const pid of queue) {
    for (const child of children.get(pid) ?? []) {
      queue.add(child);
      descendants.add(child);
    }
  }
}

function codexArgs(args, thread, report) {
  const result = thread ? ["exec", "resume", thread] : ["exec"];
  result.push(
    "-m",
    args.model,
    "-c",
    "model_reasoning_effort=" + JSON.stringify(args.effort),
    "-c",
    'service_tier="default"',
  );
  if (args.image) result.push("-i", args.image);
  if (thread) result.push("-c", "sandbox_mode=" + JSON.stringify(args.sandbox));
  else result.push("-s", args.sandbox, "-C", args.workdir);
  if (args.sandbox === "workspace-write" || args.roots.length > 0) {
    result.push("-c", "sandbox_workspace_write.writable_roots=" + JSON.stringify(args.roots));
  }
  if (args.sandbox === "workspace-write" || args.network) {
    result.push("-c", "sandbox_workspace_write.network_access=" + args.network);
  }
  if (args.skipGitCheck) result.push("--skip-git-repo-check");
  result.push("--json", "-o", report, "-");
  return result;
}

function launch(dir, lock, args, input, argv) {
  const files = [];
  try {
    for (const [path, flags] of [
      [input, "r"],
      [turnFile(dir, lock.turn, "events.jsonl"), "wx"],
      [turnFile(dir, lock.turn, "log.txt"), "wx"],
    ]) {
      files.push(fs.openSync(path, flags, 0o600));
    }
    const lockPath = join(dir, "lock");
    writeJson(lockPath, { ...lock, launchPending: true });
    const child = spawn("codex", argv, { cwd: args.workdir, env: codexEnv, stdio: files });
    let error;
    const ended = new Promise((resolve) => {
      child.once("error", (cause) => {
        error = cause;
      });
      child.once("close", (code, signal) => resolve({ code, signal, error }));
    });
    let lockError;
    try {
      if (child.pid) writeJson(lockPath, { ...lock, codexPid: child.pid });
    } catch (cause) {
      lockError = cause;
    }
    return { child, ended, lockError };
  } finally {
    for (const fd of files) fs.closeSync(fd);
  }
}

async function runTurn(dir, lock, args, input, previousThread, handoff) {
  const { turn } = lock;
  const report = turnFile(dir, turn, "report.md");
  const events = turnFile(dir, turn, "events.jsonl");
  const request = turnFile(dir, turn, "stop");
  const { checkInterval, startWait, countWait } = args.watch;
  const descendants = new Set();
  let descendantError;
  let child;
  let thread = null;
  let readCount;
  let baseline;
  let cause;
  let note;
  let timer;
  let missing = 0;
  let signalled = false;

  function sample() {
    try {
      sampleDescendants(child?.pid, descendants);
    } catch (error) {
      descendantError = error.message;
    }
  }

  function interrupt(state, why) {
    if (cause) return;
    cause = state;
    note = why;
    sample();
    if (child?.pid && !signalled && child.exitCode === null && child.signalCode === null) {
      signalled = child.kill("SIGINT");
    }
  }

  function onSignal() {
    try {
      fs.closeSync(fs.openSync(request, "a", 0o600));
    } catch (error) {
      interrupt(
        "stopped",
        "signal to runner (could not write stop request: " + error.message + ")",
      );
      return;
    }
    interrupt("stopped", "signal to runner");
  }

  function observe() {
    thread ??= threadFrom(events);
    if (!thread || (previousThread && previousThread !== thread)) return null;
    readCount ??= watchCounts(thread, baseline?.path, baseline?.offset);
    try {
      return readCount();
    } catch {
      return null;
    }
  }

  function logCount(count) {
    const reading = count
      ? count.used + " / " + count.window + " tokens (" + percent(count) + ")"
      : "no fresh context count";
    log(dir, "turn " + turn + " context: " + reading);
  }

  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);
  try {
    const argv = codexArgs(args, previousThread, report);
    try {
      const version = await versionOf("codex", ["--version"], { cwd: args.workdir, env: codexEnv });
      log(dir, version.stdout.trim());
    } catch (error) {
      log(dir, "Codex version unavailable: " + error.message);
    }
    log(dir, "cwd=" + JSON.stringify(args.workdir) + " argv=" + JSON.stringify(["codex", ...argv]));

    if (previousThread) {
      try {
        const path = findSession(previousThread);
        if (path) baseline = { path, offset: fs.statSync(path).size };
      } catch (error) {
        return makeState(dir, turn, "watch-error", { thread: previousThread, note: error.message });
      }
    }

    if (cause || fs.existsSync(request))
      return makeState(dir, turn, "stopped", { thread: previousThread, note });

    let started;
    let ended;
    let lockError;
    try {
      ({ child, ended, lockError } = launch(dir, lock, args, input, argv));
      started = performance.now();
    } catch (error) {
      return makeState(dir, turn, "codex-error", { thread: previousThread, note: error.message });
    }

    function check() {
      if (cause) return;
      try {
        if (fs.existsSync(request)) {
          interrupt("stopped", "stop requested");
          return;
        }
        sample();
        const count = observe();
        logCount(count);
        const remaining = startWait - (performance.now() - started);
        if (!thread || (previousThread && previousThread !== thread)) {
          if (remaining <= 0) interrupt("watch-error", "no thread.started event for this turn");
          else timer = setTimeout(check, Math.min(checkInterval, remaining));
          return;
        }
        missing = count ? 0 : missing + 1;
        if (missing >= countWait) interrupt("watch-error", "no fresh readable context count");
        else if (count && !handoff && atLimit(count, args.limit))
          interrupt("limit", "context limit reached");
        else timer = setTimeout(check, checkInterval);
      } catch (error) {
        interrupt("watch-error", error.message);
      }
    }

    if (lockError) interrupt("watch-error", "cannot record Codex PID: " + lockError.message);
    else timer = setTimeout(check, 0);
    const outcome = await ended;
    clearTimeout(timer);
    if (!cause && fs.existsSync(request)) cause = "stopped";

    let count;
    try {
      count = observe();
      logCount(count);
    } catch (error) {
      note ??= error.message;
    }
    sample();
    let pids = [];
    try {
      pids = [...descendants].filter(running);
    } catch (error) {
      descendantError = error.message;
    }

    const codexError =
      outcome.error?.message ??
      (outcome.code === 0
        ? null
        : "Codex ended with " + (outcome.signal ?? "exit " + outcome.code));
    let state;
    if (pids.length || descendantError) {
      state = "cleanup-error";
      note = pids.length
        ? "still running: " + pids.join(", ")
        : "could not check descendants: " + descendantError;
    } else if (cause) {
      state = cause;
    } else if (count && atLimit(count, args.limit)) {
      state = "limit";
      note = codexError ?? note;
      if (handoff && !fs.statSync(report, { throwIfNoEntry: false })?.size) {
        note = note ? note + ". handoff report missing" : "handoff report missing";
      }
    } else if (codexError) {
      state = "codex-error";
      note = codexError;
    } else if (!count) {
      state = "watch-error";
      note ??= "Codex ended with no fresh readable context count";
    } else if (!fs.statSync(report, { throwIfNoEntry: false })?.size) {
      state = "codex-error";
      note = "Codex left an empty or missing report";
    } else {
      state = "done";
    }
    return makeState(dir, turn, state, {
      thread: previousThread ?? thread,
      count,
      note,
      pids: pids.length ? pids : undefined,
    });
  } finally {
    clearTimeout(timer);
    process.removeListener("SIGINT", onSignal);
    process.removeListener("SIGTERM", onSignal);
  }
}

function watchOptions(opts, defaults) {
  const maxDelay = (2 ** 31 - 1) / 1000;
  return {
    checkInterval:
      number(opts["check-interval"] ?? defaults.checkInterval, "check-interval", 0.001, maxDelay) *
      1000,
    startWait:
      number(opts["start-wait"] ?? defaults.startWait, "start-wait", 0.001, maxDelay) * 1000,
    countWait: positiveInteger(opts["count-wait"] ?? defaults.countWait, "count-wait"),
  };
}

function startArgs(opts) {
  const config = readJson(new URL("./codex-run.config.json", import.meta.url));
  if (!["read-only", "workspace-write"].includes(opts.sandbox))
    fail("Use read-only or workspace-write for --sandbox.");
  const workdir = canonical(opts.workdir);
  if (!fs.statSync(workdir, { throwIfNoEntry: false })?.isDirectory())
    fail("Work folder does not exist: " + workdir);
  return {
    workdir,
    brief: canonical(opts.brief),
    model: opts.model,
    effort: opts.effort,
    sandbox: opts.sandbox,
    limit: number(opts.limit, "limit", 0, 100),
    roots: (opts["writable-root"] ?? []).map(canonical),
    network: Boolean(opts.network),
    image: opts.image ? canonical(opts.image) : null,
    skipGitCheck: Boolean(opts["skip-git-check"]),
    watch: watchOptions(opts, config),
  };
}

async function execute(command, opts, dir) {
  const start = command === "start";
  const argsPath = join(dir, "args.json");
  const lockPath = join(dir, "lock");
  const statePath = join(dir, "state.json");
  let args;
  if (start) {
    args = startArgs(opts);
    validateFolder(dir, args);
    fs.mkdirSync(dirname(dir), { recursive: true });
    try {
      fs.mkdirSync(dir, { mode: 0o700 });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      if (fs.statSync(dir).isDirectory()) recoverLock(dir);
      fail("Run folder already exists: " + dir);
    }
  } else {
    recoverLock(dir);
    args = readJson(argsPath);
    if (!args) fail("No saved options in run folder: " + dir);
    validateFolder(dir, args);
    args.watch = watchOptions(opts, {
      checkInterval: args.watch.checkInterval / 1000,
      startWait: args.watch.startWait / 1000,
      countWait: args.watch.countWait,
    });
  }

  const lock = { turn: (readJson(statePath)?.turn ?? 0) + 1, pid: process.pid, codexPid: null };
  if (!writeJson(lockPath, lock, true)) fail("Another turn holds the lock in " + dir + ".");

  let input;
  let thread;
  try {
    if (start) {
      writeJson(argsPath, args);
      input = args.brief;
    } else {
      const state = readJson(statePath);
      if (state?.state === "cleanup-error")
        fail("Resolve the cleanup error before resuming " + dir + ".");
      if (state?.state === "limit" && !opts.handoff)
        fail("The context limit was reached. Use --handoff for the handoff turn.");
      if (!validThread(state?.thread)) fail("No thread to resume in " + dir + ".");
      thread = state.thread;
      input = canonical(opts.message);
      if (lock.turn !== state.turn + 1) {
        lock.turn = state.turn + 1;
        writeJson(lockPath, lock);
      }
    }
    if (!fs.statSync(input, { throwIfNoEntry: false })?.isFile())
      fail("Input file does not exist: " + input);
  } catch (error) {
    fs.unlinkSync(lockPath);
    throw error;
  }

  const state = await runTurn(dir, lock, args, input, thread, Boolean(opts.handoff));
  recordEnd(dir, state);
  fs.rmSync(turnFile(dir, lock.turn, "stop"), { force: true });
  fs.unlinkSync(lockPath);
  if (state.note) console.error(state.note);
  console.log(stateLine(state));
  return state.exit;
}

function contextThread(dir) {
  const lock = readJson(join(dir, "lock"));
  const active = lock && threadFrom(turnFile(dir, lock.turn, "events.jsonl"));
  return active ?? readJson(join(dir, "state.json"))?.thread;
}

async function main([command, ...argv]) {
  const opts = parse(command, argv);
  const dir = opts["run-dir"] ? canonical(opts["run-dir"]) : null;
  if (command === "context") {
    if (Boolean(dir) === Boolean(opts.thread)) fail("Use one of --run-dir or --thread.");
    const thread = opts.thread ?? contextThread(dir);
    if (!validThread(thread)) fail("No valid thread ID.");
    let count;
    try {
      count = watchCounts(thread)();
    } catch (error) {
      console.error(error.message);
    }
    if (!count) {
      console.error("No readable context count for thread " + thread + ".");
      return exits["watch-error"];
    }
    console.log(percent(count) + " (" + count.used + " of " + count.window + " tokens)");
    return 0;
  }
  if (command === "stop") {
    stop(dir, positiveInteger(opts.turn, "turn"));
    return 0;
  }
  return execute(command, opts, dir);
}

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exitCode = error instanceof UsageError ? 2 : exits["codex-error"];
}
