import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Logger } from "pino";
import { systemClock } from "../adapters/clock/system-clock.ts";
import { openReader } from "../adapters/db/client.ts";
import { sqliteReaders, sqliteUnitOfWork } from "../adapters/db/unit-of-work.ts";
import { createHttpApp } from "../adapters/http/app.ts";
import { typeIdIds } from "../adapters/ids/typeid-ids.ts";
import { sseBody, type SseOptions } from "../adapters/sse/sse-stream.ts";
import { createAppendEvent } from "../core/events/append-event.ts";
import { createEventPruning } from "../core/events/event-pruning.service.ts";
import { createEventHub } from "../core/events/hub.ts";
import { createTestPingService } from "../core/events/test-ping.service.ts";
import { createHealthService } from "../core/health/health.service.ts";
import type { Clock } from "../core/ports/clock.ts";
import { createSettingsService } from "../core/settings/settings.service.ts";
import { createSkillImportService } from "../core/skills/skill-import.service.ts";
import { createSkillsService } from "../core/skills/skills.service.ts";
import { createAvatarsService } from "../core/bots/avatars.service.ts";
import { createBotsService } from "../core/bots/bots.service.ts";
import { diskAvatarFiles } from "../adapters/avatars/avatar-files.ts";
import { effortsOf, isModelProvider } from "../adapters/model/ai-sdk/effort.ts";
import { checkCatalogProviders, loadCatalog } from "./catalog-files.ts";
import type { Config } from "./config.ts";
import { openDatabase } from "./database.ts";

// The composition root (D35): the only place that wires adapters into the core.
export function compose(
  config: Config,
  log: Logger,
  options: { clock?: Clock; sse?: Omit<SseOptions, "onError"> } = {},
) {
  // A production build must have the frontend built first, or every page would be a 404.
  if (config.frontendDir !== null && !existsSync(join(config.frontendDir, "index.html"))) {
    throw new Error(
      `NODE_ENV=production serves the built frontend, but ${config.frontendDir}/index.html does not exist. Run \`pnpm build\` first, or start with \`pnpm start\`.`,
    );
  }
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
    notify: () => {
      hub.notify();
    },
  });
  const eventPruning = createEventPruning({
    uow,
    clock,
    retentionDays: config.eventRetentionDays,
    notify: () => {
      hub.notify();
    },
  });
  const catalog = loadCatalog(config);
  checkCatalogProviders(catalog, { isProvider: isModelProvider, efforts: effortsOf });
  const settings = createSettingsService({ uow, readers, appendEvent });
  const avatarFiles = diskAvatarFiles(join(config.dataDir, "avatars"));
  const bots = createBotsService({
    uow,
    readers,
    appendEvent,
    clock,
    ids: typeIdIds,
    catalog,
    avatarFiles,
  });
  const avatars = createAvatarsService({
    uow,
    clock,
    files: avatarFiles,
    orphanHours: config.avatarOrphanHours,
  });
  const skills = createSkillsService({
    uow,
    readers,
    appendEvent,
    clock,
    ids: typeIdIds,
    pinsChanged: bots.emitPinsChanged,
  });
  const skillImport = createSkillImportService({
    uow,
    readers,
    skills,
    clock,
    previewMinutes: config.importPreviewMinutes,
    previewMax: config.importPreviewMax,
  });

  const app = createHttpApp({
    log,
    allowedHosts: config.allowedHosts,
    allowedOrigins: config.allowedOrigins,
    health: createHealthService({ readers, catalog }),
    catalog,
    settings,
    skills,
    skillImport,
    bots,
    avatars,
    avatarMaxBytes: config.avatarMaxBytes,
    openStream: (afterSeq, signal, onError) =>
      sseBody(hub, afterSeq, signal, { ...options.sse, onError }),
    testPing: config.appEnv === "test" ? createTestPingService({ uow, appendEvent }) : null,
    apiDocs: config.appEnv === "dev",
    frontendDir: config.frontendDir,
  });

  return {
    app,
    catalog,
    uow,
    readers,
    hub,
    appendEvent,
    settings,
    skills,
    skillImport,
    bots,
    avatars,
    eventPruning,
    close: () => {
      reader.close();
      writer.close();
    },
  };
}
