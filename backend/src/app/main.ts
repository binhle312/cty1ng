import { serve } from "@hono/node-server";
import { createLogger } from "../adapters/log/pino-logger.ts";
import { compose } from "./compose.ts";
import { ConfigError, loadConfig } from "./config.ts";
import { startTimedJobs } from "./timed-jobs.ts";

// Starts the backend: configuration first, then migrations, then the server and the timed jobs.
// Any failure before listening stops the process with a clear message and a non-zero exit (M0b
// plan, decision E).
function start(): void {
  let config;
  try {
    config = loadConfig(process.env);
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    process.stderr.write(`cty1ng: ${error.message}\n`);
    process.exit(1);
  }

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
    log,
    purgeIntervalHours: config.purgeIntervalHours,
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

start();
