import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serve, type ServerType } from "@hono/node-server";
import Database from "better-sqlite3";
import { systemClock } from "../src/adapters/clock/system-clock.ts";
import { sqliteReaders, sqliteUnitOfWork } from "../src/adapters/db/unit-of-work.ts";
import { typeIdIds } from "../src/adapters/ids/typeid-ids.ts";
import { createAppendEvent } from "../src/core/events/append-event.ts";
import { createSettingsService } from "../src/core/settings/settings.service.ts";
import { createSkillImportService } from "../src/core/skills/skill-import.service.ts";
import { createSkillsService } from "../src/core/skills/skills.service.ts";
import { createLogger, type Logger } from "../src/adapters/log/pino-logger.ts";
import { compose } from "../src/app/compose.ts";
import { loadConfig, type Config } from "../src/app/config.ts";

// Shared helpers for backend tests. Every test gets its own data folder.

export function tempDir(prefix: string): { path: string; remove: () => void } {
  const path = mkdtempSync(join(tmpdir(), `cty1ng-${prefix}-`));
  return {
    path,
    remove: () => {
      rmSync(path, { recursive: true, force: true });
    },
  };
}

export const PORT = 8000;
export const HOST = `127.0.0.1:${PORT}`;
export const ORIGIN = "http://127.0.0.1:5173";

export function testConfig(dataDir: string, env: NodeJS.ProcessEnv = {}): Config {
  return loadConfig({ DATA_DIR: dataDir, APP_ENV: "test", PORT: String(PORT), ...env });
}

// A logger whose lines the test can read.
export function memoryLogger(secrets: readonly string[] = []): { log: Logger; lines: string[] } {
  const lines: string[] = [];
  const log = createLogger({
    level: "trace",
    secrets,
    destination: {
      write: (line: string) => {
        lines.push(line);
      },
    },
  });
  return { log, lines };
}

// The composed backend on a temporary database.
export function testBackend(env: NodeJS.ProcessEnv = {}, sse = { heartbeatMs: 50 }) {
  const dir = tempDir("backend");
  const config = testConfig(dir.path, env);
  const { log, lines } = memoryLogger(config.secrets);
  const backend = compose(config, log, { sse });
  return {
    ...backend,
    config,
    lines,
    request: (path: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers);
      if (!headers.has("host")) headers.set("host", HOST);
      return backend.app.request(`http://${HOST}${path}`, { ...init, headers });
    },
    postTestEvent: (note: string) =>
      backend.app.request(`http://${HOST}/api/_test/events`, {
        method: "POST",
        headers: { host: HOST, origin: ORIGIN, "content-type": "application/json" },
        body: JSON.stringify({ note }),
      }),
    close: () => {
      backend.close();
      dir.remove();
    },
  };
}

// The services of `createHttpApp` for a test that builds the HTTP app itself and never calls
// them: real services over an empty in-memory database.
export function idleServices() {
  const db = new Database(":memory:");
  const uow = sqliteUnitOfWork(db, () => undefined);
  const readers = sqliteReaders(db);
  const appendEvent = createAppendEvent({ clock: systemClock, notify: () => undefined });
  const skills = createSkillsService({
    uow,
    readers,
    appendEvent,
    clock: systemClock,
    ids: typeIdIds,
  });
  return {
    settings: createSettingsService({ uow, readers, appendEvent }),
    skills,
    skillImport: createSkillImportService({
      uow,
      readers,
      skills,
      clock: systemClock,
      previewMinutes: 15,
      previewMax: 5,
    }),
  };
}

export async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      probe.close(() => {
        resolve(port);
      });
    });
  });
}

// The composed backend behind a real HTTP server on a free loopback port.
export async function testServer(env: NodeJS.ProcessEnv = {}) {
  const port = await freePort();
  const backend = testBackend({ PORT: String(port), ...env });
  const server: ServerType = await new Promise((resolve) => {
    const s = serve({ fetch: backend.app.fetch, hostname: "127.0.0.1", port }, () => {
      resolve(s);
    });
  });
  return {
    ...backend,
    port,
    url: `http://127.0.0.1:${port}`,
    close: async () => {
      if ("closeAllConnections" in server) server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
      backend.close();
    },
  };
}

// One parsed SSE frame. `comment` is set for a `: ping` line.
export interface SseFrame {
  id?: string;
  event?: string;
  data?: string;
  retry?: string;
  comment?: string;
}

export function parseFrames(text: string): SseFrame[] {
  return text
    .split("\n\n")
    .filter((block) => block !== "")
    .map((block) => {
      const frame: SseFrame = {};
      for (const line of block.split("\n")) {
        if (line.startsWith(":")) frame.comment = line.slice(1).trim();
        const [, field, value = ""] = /^(id|event|data|retry): (.*)$/.exec(line) ?? [];
        if (field === "id") frame.id = value;
        if (field === "event") frame.event = value;
        if (field === "data") frame.data = value;
        if (field === "retry") frame.retry = value;
      }
      return frame;
    });
}

// Reads SSE frames from a body as they arrive.
export async function* readFrames(body: ReadableStream<Uint8Array>): AsyncGenerator<SseFrame> {
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });
    let end = buffer.indexOf("\n\n");
    while (end !== -1) {
      yield* parseFrames(buffer.slice(0, end + 2));
      buffer = buffer.slice(end + 2);
      end = buffer.indexOf("\n\n");
    }
  }
}

// Reads an async iterable in the background, so a test can wait for items or check that none
// came, without losing any.
export function collect<T>(iterable: AsyncIterable<T>) {
  const items: T[] = [];
  let done = false;
  let failure: Error | undefined;
  let wake = (): void => undefined;
  void (async () => {
    try {
      for await (const item of iterable) {
        items.push(item);
        wake();
      }
    } catch (error) {
      failure = error instanceof Error ? error : new Error(String(error));
    } finally {
      done = true;
      wake();
    }
  })();

  return {
    items,
    get done() {
      return done;
    },
    // Resolves when at least `count` items came; fails after `ms` or if the iterable ends first.
    async waitFor(count: number, ms = 2000): Promise<T[]> {
      const deadline = Date.now() + ms;
      while (items.length < count) {
        if (failure !== undefined) throw failure;
        if (done) throw new Error(`Ended with ${items.length} of ${count} items`);
        const left = deadline - Date.now();
        if (left <= 0) throw new Error(`Timed out with ${items.length} of ${count} items`);
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, left);
          wake = () => {
            clearTimeout(timer);
            resolve();
          };
        });
      }
      return items.slice(0, count);
    },
  };
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
