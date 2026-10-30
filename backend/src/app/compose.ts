import type { Logger } from "pino";
import { systemClock } from "../adapters/clock/system-clock.ts";
import { openReader } from "../adapters/db/client.ts";
import { sqliteReaders, sqliteUnitOfWork } from "../adapters/db/unit-of-work.ts";
import { createHttpApp } from "../adapters/http/app.ts";
import { sseBody, type SseOptions } from "../adapters/sse/sse-stream.ts";
import { buildCatalog } from "../core/catalog/catalog.ts";
import { createAppendEvent } from "../core/events/append-event.ts";
import { createEventHub } from "../core/events/hub.ts";
import { createTestPingService } from "../core/events/test-ping.service.ts";
import { createHealthService } from "../core/health/health.service.ts";
import type { Clock } from "../core/ports/clock.ts";
import type { Config } from "./config.ts";
import { openDatabase } from "./database.ts";

// The composition root (D35): the only place that wires adapters into the core.
export function compose(
  config: Config,
  log: Logger,
  options: { clock?: Clock; sse?: Omit<SseOptions, "onError"> } = {},
) {
  const { writer, applied } = openDatabase(config);
  if (applied > 0) log.info({ applied }, "migrations applied");
  const reader = openReader(config.databaseFile);

  const clock = options.clock ?? systemClock;
  const uow = sqliteUnitOfWork(writer, (error) => {
    log.error({ err: error }, "after-commit callback failed");
  });
  const readers = sqliteReaders(reader);
  const hub = createEventHub({
    readers,
    onInvalidEvent: (seq, type) => {
      log.warn({ seq, type }, "skipped an event that does not parse");
    },
  });
  const appendEvent = createAppendEvent({
    clock,
    notify: (seq) => {
      hub.notify(seq);
    },
  });
  const catalog = buildCatalog({ fakeModel: config.fakeModel });

  const app = createHttpApp({
    log,
    allowedHosts: config.allowedHosts,
    allowedOrigins: config.allowedOrigins,
    health: createHealthService({ readers, catalog }),
    openStream: (afterSeq, signal, onError) =>
      sseBody(hub, afterSeq, signal, { ...options.sse, onError }),
    testPing: config.appEnv === "test" ? createTestPingService({ uow, appendEvent }) : null,
  });

  return {
    app,
    uow,
    readers,
    hub,
    appendEvent,
    close: () => {
      reader.close();
      writer.close();
    },
  };
}
