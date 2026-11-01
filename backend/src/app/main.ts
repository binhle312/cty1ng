import { ConfigError, loadConfig } from "./config.ts";

// Starts the backend: configuration first, then migrations, then the server and the timed jobs.
// Any failure before listening stops the process with a clear message and a non-zero exit (M0b
// plan, decision E).
//
// Only the settings module is imported up front. The app (the logger, the database, `sharp`,
// the model SDKs) loads after the settings pass, so a refused start uses about a quarter of the
// memory and time (startup.test.ts proves that it does not load the app).
async function start(): Promise<void> {
  let config;
  try {
    config = loadConfig(process.env);
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    process.stderr.write(`cty1ng: ${error.message}\n`);
    process.exit(1);
  }

  const [{ serve }, { createLogger }, { compose }, { startTimedJobs }] = await Promise.all([
    import("@hono/node-server"),
    import("../adapters/log/pino-logger.ts"),
    import("./compose.ts"),
    import("./timed-jobs.ts"),
  ]);
  const log = createLogger({ level: config.logLevel, secrets: config.secrets });
  let app;
  try {
    app = compose(config, log);
  } catch (error) {
    log.fatal({ err: error }, "startup failed");
    process.stderr.write("cty1ng: startup failed; see the log above.\n");
    process.exit(1);
  }

  const server = serve(
    { fetch: app.app.fetch, hostname: config.host, port: config.port },
    (info) => {
      log.info({ host: info.address, port: info.port, app_env: config.appEnv }, "listening");
    },
  );

  const stopJobs = startTimedJobs({
    skills: app.skills,
    bots: app.bots,
    avatars: app.avatars,
    eventPruning: app.eventPruning,
    log,
    purgeIntervalHours: config.purgeIntervalHours,
    eventPruneIntervalHours: config.eventPruneIntervalHours,
  });

  const shutdown = (): void => {
    log.info("shutting down");
    stopJobs();
    server.close();
    // Open event streams would keep the server open.
    if ("closeAllConnections" in server) server.closeAllConnections();
    app.close();
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

await start();
