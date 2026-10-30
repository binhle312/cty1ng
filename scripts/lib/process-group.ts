import { spawn, type ChildProcess, type StdioOptions } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

// Shell commands that run as their own process group (POSIX), so a stop reaches the whole
// tree: the shell and everything it started, not only the shell.

const POLL_MS = 100;

export function spawnGroup(
  command: string,
  options: { cwd?: string | undefined; env: NodeJS.ProcessEnv; stdio?: StdioOptions },
): ChildProcess {
  return spawn(command, {
    cwd: options.cwd,
    env: options.env,
    shell: true,
    stdio: options.stdio ?? "inherit",
    // The child leads a new process group with the id of its pid.
    detached: true,
  });
}

// True while any process of the group still runs.
export function groupAlive(pid: number): boolean {
  try {
    process.kill(-pid, 0);
    return true;
  } catch (error) {
    // EPERM: a process of the group exists but belongs to someone else.
    return !(error instanceof Error && "code" in error && error.code === "ESRCH");
  }
}

function signalGroup(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(-pid, signal);
  } catch {
    // The group stopped between the check and the signal.
  }
}

// Sends `signal` to the whole group and waits until every process in it has stopped. A group
// that is still running after `timeoutMs` gets SIGKILL.
export async function stopGroup(
  pid: number,
  options: { signal: NodeJS.Signals; timeoutMs: number },
): Promise<void> {
  signalGroup(pid, options.signal);
  const deadline = Date.now() + options.timeoutMs;
  let killed = false;
  while (groupAlive(pid)) {
    if (!killed && Date.now() >= deadline) {
      signalGroup(pid, "SIGKILL");
      killed = true;
    }
    await sleep(POLL_MS);
  }
}
