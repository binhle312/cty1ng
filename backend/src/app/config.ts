import { isIP } from "node:net";
import { isAbsolute, resolve } from "node:path";
import { z } from "zod";

// Configuration from environment variables, parsed once at start (architecture.md §8). Defaults
// are the ones in that table. A bad value stops the start with a clear message.

// The repository root, from this file's own place (backend/src/app/), never from the folder the
// process starts in (M0b plan, decision F).
export const REPO_ROOT = resolve(import.meta.dirname, "../../..");

// The hosts the Host check accepts (security.md §2.1); HOST must be one of them.
const SERVED_HOSTS: readonly string[] = ["127.0.0.1", "localhost"];

const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;

const Flag = z.enum(["0", "1"]).transform((value) => value === "1");

const Env = z.object({
  DATA_DIR: z.string().min(1).default("./data"),
  HOST: z.string().min(1).default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1).max(65535).default(8000),
  ALLOWED_ORIGINS: z.string().default("http://127.0.0.1:5173,http://localhost:5173"),
  APP_ENV: z.enum(["dev", "test", "prod"]).default("dev"),
  NODE_ENV: z.string().optional(),
  FAKE_MODEL: Flag.default(false),
  LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),
  PURGE_INTERVAL_HOURS: z.coerce.number().positive().default(24),
  EVENT_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
  EVENT_PRUNE_INTERVAL_HOURS: z.coerce.number().int().positive().default(24),
  IMPORT_PREVIEW_MINUTES: z.coerce.number().positive().default(15),
  IMPORT_PREVIEW_MAX: z.coerce.number().int().min(1).default(5),
});

export interface Config {
  dataDir: string;
  databaseFile: string;
  host: string;
  port: number;
  // Origins allowed for requests and CORS (security.md §2.1): the app's own, plus ALLOWED_ORIGINS.
  allowedOrigins: readonly string[];
  // `host:port` values the Host header may have.
  allowedHosts: readonly string[];
  appEnv: "dev" | "test" | "prod";
  // The built frontend that the backend serves, only with NODE_ENV=production
  // (architecture.md §1.2). In development Vite serves it.
  frontendDir: string | null;
  fakeModel: boolean;
  logLevel: (typeof LOG_LEVELS)[number];
  // How often the Trash purge job runs; it also runs at start (architecture.md §6.1, §8).
  purgeIntervalHours: number;
  // How long events are kept, and how often the pruning job runs; it also runs at start
  // (architecture.md §6.1, §8).
  eventRetentionDays: number;
  eventPruneIntervalHours: number;
  // Skill import previews kept in memory (domain-model.md §3.5).
  importPreviewMinutes: number;
  importPreviewMax: number;
  // Values of every `*_API_KEY` variable, for log redaction only (security.md §2.6).
  secrets: readonly string[];
}

export class ConfigError extends Error {}

export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const parsed = Env.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map(
      (issue) => `${issue.path.join(".")}: ${issue.message}`,
    );
    throw new ConfigError(`Invalid configuration: ${problems.join("; ")}`);
  }
  const e = parsed.data;

  // security.md §2.1: loopback only until the VPS milestone adds authentication, and only the
  // addresses the Host check serves (127.0.0.1:PORT, localhost:PORT), so the server never
  // refuses its own requests.
  if (!isLoopback(e.HOST)) {
    throw new ConfigError(
      `HOST=${e.HOST} is not a loopback address. cty1ng has no login yet, so it binds only to 127.0.0.1 (docs/security.md §2.1).`,
    );
  }
  if (!SERVED_HOSTS.includes(e.HOST)) {
    throw new ConfigError(
      `HOST=${e.HOST} is a loopback address, but the Host check serves only ${SERVED_HOSTS.join(" and ")}. Use HOST=127.0.0.1 (docs/security.md §2.1).`,
    );
  }
  // architecture.md §8: test routes never run in a production build.
  if (e.APP_ENV === "test" && e.NODE_ENV === "production") {
    throw new ConfigError(
      "APP_ENV=test cannot run with NODE_ENV=production (docs/architecture.md §8).",
    );
  }

  const origins = e.ALLOWED_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin !== "");
  for (const origin of origins) {
    if (!isOrigin(origin)) throw new ConfigError(`ALLOWED_ORIGINS: ${origin} is not an origin`);
  }

  const dataDir = isAbsolute(e.DATA_DIR) ? e.DATA_DIR : resolve(REPO_ROOT, e.DATA_DIR);
  const ownOrigins = SERVED_HOSTS.map((host) => `http://${host}:${e.PORT}`);
  return {
    dataDir,
    databaseFile: resolve(dataDir, "app.db"),
    host: e.HOST,
    port: e.PORT,
    allowedOrigins: [...new Set([...ownOrigins, ...origins])],
    allowedHosts: SERVED_HOSTS.map((host) => `${host}:${e.PORT}`),
    appEnv: e.APP_ENV,
    frontendDir: e.NODE_ENV === "production" ? resolve(REPO_ROOT, "frontend/dist") : null,
    fakeModel: e.FAKE_MODEL,
    logLevel: e.LOG_LEVEL,
    purgeIntervalHours: e.PURGE_INTERVAL_HOURS,
    eventRetentionDays: e.EVENT_RETENTION_DAYS,
    eventPruneIntervalHours: e.EVENT_PRUNE_INTERVAL_HOURS,
    importPreviewMinutes: e.IMPORT_PREVIEW_MINUTES,
    importPreviewMax: e.IMPORT_PREVIEW_MAX,
    secrets: Object.entries(env)
      .filter(([name, value]) => name.endsWith("_API_KEY") && value !== undefined && value !== "")
      .map(([, value]) => value ?? ""),
  };
}

function isLoopback(host: string): boolean {
  if (host === "localhost") return true;
  if (isIP(host) === 4) return host.startsWith("127.");
  if (isIP(host) === 6) return host === "::1";
  return false;
}

function isOrigin(value: string): boolean {
  try {
    return new URL(value).origin === value;
  } catch {
    return false;
  }
}
