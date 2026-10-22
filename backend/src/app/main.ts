import { serve } from "@hono/node-server";
import { composeApp } from "./compose";
import { parseConfig } from "./config";
import { createLogger } from "./logger";

/** Process entry: parse config (exit on error), compose, listen on loopback only. */
const result = parseConfig(process.env);
if (!result.ok) {
  process.stderr.write(`${result.message}\n`);
  process.exit(1);
}
const { config } = result;
const logger = createLogger({ level: config.logLevel, secretValues: config.secretValues });
const app = composeApp({ config, logger });

const server = serve(
  { fetch: app.http.fetch, hostname: config.host, port: config.port },
  (info) => {
    logger.info(
      { event: "app.listening", host: config.host, port: info.port, app_env: config.appEnv },
      "listening",
    );
  },
);

/** How long open requests get to finish before their connections are closed. */
const SHUTDOWN_GRACE_MS = 5_000;
let stopping = false;

/**
 * Stops accepting connections, ends open SSE streams (they never end on their own), waits for
 * the rest, and closes remaining connections after the grace period.
 */
function shutdown(signal: string): void {
  if (stopping) return;
  stopping = true;
  logger.info({ event: "app.stopping", signal }, "stopping");
  app.stopStreams();
  const force = setTimeout(() => {
    logger.warn({ event: "app.forced_close" }, "closing connections after the grace period");
    if ("closeAllConnections" in server) server.closeAllConnections();
  }, SHUTDOWN_GRACE_MS);
  force.unref();
  server.close(() => {
    clearTimeout(force);
    app.close();
    process.exit(0);
  });
}
process.on("SIGINT", () => {
  shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  shutdown("SIGTERM");
});
