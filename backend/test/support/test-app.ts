import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import type { Logger } from "pino";
import { composeApp, type App } from "../../src/app/compose";
import { parseConfig } from "../../src/app/config";
import { createLogger } from "../../src/app/logger";

export const PORT = 8000;
export const BASE = `http://127.0.0.1:${PORT}`;
export const OWN_ORIGIN = BASE;
export const DEV_ORIGIN = "http://127.0.0.1:5173";

export interface TestApp extends App {
  /** Every log line written so far. */
  logs: string[];
  logger: Logger;
  dataDir: string;
  /** `app.request` with the loopback Host header set, as a real browser request has. */
  request(
    path: string,
    init?: Omit<RequestInit, "headers"> & { headers?: Record<string, string> },
  ): Promise<Response>;
  dispose(): void;
}

/** A composed app on a fresh temporary data dir, with logs captured in memory. */
export function makeTestApp(env: Record<string, string> = {}): TestApp {
  const dataDir = mkdtempSync(join(tmpdir(), "cty1ng-test-"));
  const result = parseConfig({ APP_ENV: "test", DATA_DIR: dataDir, LOG_LEVEL: "info", ...env });
  if (!result.ok) throw new Error(result.message);
  const logs: string[] = [];
  const destination = new Writable({
    write(chunk: Buffer, _encoding, done) {
      logs.push(chunk.toString("utf8"));
      done();
    },
  });
  const logger = createLogger({
    level: result.config.logLevel,
    secretValues: result.config.secretValues,
    destination,
  });
  const app = composeApp({ config: result.config, logger, sseHeartbeatMs: 50 });
  return {
    ...app,
    logs,
    logger,
    dataDir,
    request: (path, init = {}) =>
      Promise.resolve(
        app.http.request(`${BASE}${path}`, {
          ...init,
          headers: { host: `127.0.0.1:${PORT}`, ...init.headers },
        }),
      ),
    dispose() {
      app.close();
      rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

/** POST /api/_test/events from the app's own origin. */
export async function ping(app: TestApp, note: string): Promise<number> {
  const response = await app.request("/api/_test/events", {
    method: "POST",
    headers: { origin: OWN_ORIGIN, "content-type": "application/json" },
    body: JSON.stringify({ note }),
  });
  if (response.status !== 201)
    throw new Error(`ping failed: ${response.status} ${await response.text()}`);
  const body: unknown = await response.json();
  if (
    typeof body !== "object" ||
    body === null ||
    !("seq" in body) ||
    typeof body.seq !== "number"
  ) {
    throw new Error("ping returned no seq");
  }
  return body.seq;
}
