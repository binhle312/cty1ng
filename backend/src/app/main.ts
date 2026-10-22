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

function shutdown(): void {
  server.close(() => {
    app.close();
    process.exit(0);
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
