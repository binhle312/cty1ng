import { join, resolve } from "node:path";
import type { Logger } from "pino";
import { createDatabaseProbe, createUnitOfWork } from "../adapters/db/unit-of-work";
import { createEventLogReader } from "../adapters/db/events-repository";
import { openDatabase, type Connections } from "../adapters/db/connection";
import { systemClock } from "../adapters/clock/system-clock";
import { createHttpApp } from "../adapters/http/app";
import { createFakeModel } from "../adapters/model/fake/fake-model";
import { createSseStream, cursorFromLastEventId } from "../adapters/sse/sse-stream";
import { createEventHub, type EventHub } from "../core/events/hub";
import { createTestEventsService } from "../core/events/test-events.service";
import { createHealthService } from "../core/health/health.service";
import type { Clock } from "../core/ports/clock";
import type { ModelCatalogEntry } from "../core/ports/model";
import type { UnitOfWork } from "../core/ports/repositories";
import type { Config } from "./config";

const BACKEND_ROOT = resolve(import.meta.dirname, "../..");
export const MIGRATIONS_FOLDER = join(BACKEND_ROOT, "migrations");
export const FAKE_SCRIPTS_DIR = join(BACKEND_ROOT, "test/fixtures/fake-scripts");

export interface App {
  http: ReturnType<typeof createHttpApp>;
  /** Ends every open stream (shutdown); SSE responses never end on their own. */
  stopStreams(): void;
  hub: EventHub;
  uow: UnitOfWork;
  connections: Connections;
  close(): void;
}

/**
 * The composition root (architecture.md §3): builds the adapters, hands them to the core and
 * returns the HTTP app. This is the only place adapters are chosen (§4.1).
 */
export function composeApp(input: {
  config: Config;
  logger: Logger;
  clock?: Clock;
  sseHeartbeatMs?: number;
}): App {
  const { config, logger } = input;
  const clock = input.clock ?? systemClock;

  const connections = openDatabase({
    file: join(config.dataDir, "app.db"),
    migrationsFolder: MIGRATIONS_FOLDER,
  });
  const hub = createEventHub({ log: createEventLogReader(connections.read.db) });
  const uow = createUnitOfWork({
    connections,
    onCommit: () => {
      hub.notify();
    },
  });

  const catalog: ModelCatalogEntry[] = [];
  if (config.fakeModel) catalog.push(...createFakeModel({ scriptsDir: FAKE_SCRIPTS_DIR }).catalog);

  const streams = new AbortController();

  const testEvents = config.appEnv === "test" ? createTestEventsService({ uow, clock }) : undefined;
  if (testEvents !== undefined)
    logger.warn({ event: "app.test_endpoints" }, "test endpoints enabled");

  const http = createHttpApp({
    port: config.port,
    allowedOrigins: config.allowedOrigins,
    logger,
    health: createHealthService({ db: createDatabaseProbe(connections), catalog }),
    openStream: ({ lastEventId, signal }) =>
      createSseStream({
        feed: hub,
        cursor: cursorFromLastEventId(lastEventId),
        signal: AbortSignal.any([signal, streams.signal]),
        ...(input.sseHeartbeatMs === undefined ? {} : { heartbeatMs: input.sseHeartbeatMs }),
        onError: (error) => logger.error({ event: "sse.error", err: error }, "stream failed"),
      }),
    ...(testEvents === undefined ? {} : { testEvents }),
  });

  return {
    http,
    stopStreams: () => {
      streams.abort();
    },
    hub,
    uow,
    connections,
    close: () => {
      connections.close();
    },
  };
}
