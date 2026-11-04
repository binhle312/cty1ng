import { createInterface } from "node:readline";
import { removeServeMarker, writeServeMarker } from "./e2e-serve-marker.ts";
import { spawnGroup, stopGroup } from "./process-group.ts";

export interface ServeServer {
  command: string;
  cwd: string | undefined;
  env: NodeJS.ProcessEnv;
  port: number;
  timeoutMs: number;
}

// The port of the backend's "listening" log line (backend/src/app/main.ts); other lines have none.
export function listeningPort(line: string): number | undefined {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return undefined;
  }
  if (typeof value !== "object" || value === null) return undefined;
  if (!("msg" in value) || value.msg !== "listening") return undefined;
  if (!("port" in value) || typeof value.port !== "number") return undefined;
  return value.port;
}

// The servers of the Playwright config, at the log level that prints the "listening" line.
export function serveServers(
  webServers: readonly {
    command: string;
    cwd?: string | undefined;
    env?: Record<string, string> | undefined;
    timeout?: number | undefined;
  }[],
): ServeServer[] {
  return webServers.map((server) => {
    const port = Number(server.env?.PORT);
    if (!Number.isInteger(port)) throw new Error(`no PORT for ${server.command}`);
    return {
      command: server.command,
      cwd: server.cwd,
      env: { ...process.env, ...server.env, LOG_LEVEL: "info" },
      port,
      // Playwright's default when the config sets none.
      timeoutMs: server.timeout ?? 60_000,
    };
  });
}

// Starts the servers and owns the marker. The marker says that this script's own servers hold the
// ports, so it exists only from the moment the last server has reported its port until the stop
// begins. The report is the backend's "listening" log line on the server's own stdout: it comes after
// the bind, and no other process can write it. A health check could not prove this, because a server
// that is not ours would answer it. A server that does not get its port exits, which stops the rest.
//
// | State    | The last server reports | A server exits, or the time ends | A stop            |
// | starting | write the marker: ready | stop, code 1                     | stop              |
// | ready    | cannot happen           | remove the marker, stop, code 1  | remove, stop      |
// | stopping | ignore                  | ignore                           | the same stop     |
//
// A serve that lost the ports wrote no marker, so it leaves the marker of the serve that won.
export function startServers(options: {
  servers: readonly ServeServer[];
  markerPath: string;
  pid: number;
  stopTimeoutMs: number;
  print: (line: string) => void;
}) {
  const { servers, markerPath, pid, stopTimeoutMs, print } = options;
  const waiting = new Map(
    servers.map((server) => [
      server.port,
      setTimeout(() => {
        print(`e2e:serve: nothing listening on ${String(server.port)} in time`);
        void stop("SIGTERM", 1);
      }, server.timeoutMs),
    ]),
  );
  let markerWritten = false;
  let stopping: Promise<number> | undefined;
  let finish: (code: number) => void = () => undefined;
  const done = new Promise<number>((resolve) => {
    finish = resolve;
  });

  function reported(port: number): void {
    if (stopping !== undefined) return;
    clearTimeout(waiting.get(port));
    waiting.delete(port);
    if (waiting.size > 0 || markerWritten) return;
    writeServeMarker({ path: markerPath, pid });
    markerWritten = true;
    print("e2e:serve: ready");
  }

  const children = servers.map((server) => {
    const child = spawnGroup(server.command, {
      cwd: server.cwd,
      env: server.env,
      stdio: ["ignore", "pipe", "inherit"],
    });
    if (child.stdout !== null) {
      createInterface({ input: child.stdout }).on("line", (line) => {
        print(line);
        if (listeningPort(line) === server.port) reported(server.port);
      });
    }
    child.on("exit", () => void stop("SIGTERM", 1));
    return child;
  });
  const pids = children.flatMap((child) => (child.pid === undefined ? [] : [child.pid]));

  function stop(signal: NodeJS.Signals, code: number): Promise<number> {
    stopping ??= (async () => {
      waiting.forEach((timer) => {
        clearTimeout(timer);
      });
      if (markerWritten) removeServeMarker(markerPath);
      await Promise.all(pids.map((pid) => stopGroup(pid, { signal, timeoutMs: stopTimeoutMs })));
      finish(code);
      return code;
    })();
    return stopping;
  }

  return { pids, done, stop };
}
