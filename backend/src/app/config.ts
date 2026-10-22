import { z } from "zod";

const LOOPBACK_HOSTS = ["127.0.0.1", "localhost"] as const;

const positiveInt = (fallback: number) => z.coerce.number().int().positive().default(fallback);

const Origin = z
  .string()
  .trim()
  .refine((value) => URL.canParse(value) && new URL(value).origin === value, {
    message: "must be an origin such as http://127.0.0.1:5173 (scheme, host, port; no path)",
  });

/** Environment variables (architecture.md §8), parsed once at startup. */
const Env = z
  .object({
    DATA_DIR: z.string().min(1).default("./data"),
    HOST: z.string().default("127.0.0.1"),
    PORT: z.coerce.number().int().min(1).max(65535).default(8000),
    ALLOWED_ORIGINS: z
      .string()
      .default("http://127.0.0.1:5173,http://localhost:5173")
      .transform((value) => value.split(",").filter((part) => part.trim() !== ""))
      .pipe(z.array(Origin)),
    MAX_CONCURRENT_RUNS: positiveInt(3),
    RUN_LEASE_SECONDS: positiveInt(900),
    RUN_MAX_ATTEMPTS: positiveInt(3),
    RUN_STALL_SECONDS: positiveInt(600),
    MODEL_REQUEST_TIMEOUT_SECONDS: positiveInt(300),
    RUNS_PER_CONVERSATION_PER_HOUR: positiveInt(50),
    APP_ENV: z.enum(["dev", "test", "prod"]).default("dev"),
    FAKE_MODEL: z.enum(["0", "1"]).default("0"),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    NODE_ENV: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (!LOOPBACK_HOSTS.some((host) => host === env.HOST)) {
      ctx.addIssue({
        code: "custom",
        path: ["HOST"],
        message:
          `must be a loopback address (${LOOPBACK_HOSTS.join(" or ")}); got "${env.HOST}". ` +
          "Phase 1 has no login, so the server never listens beyond this machine (docs/security.md §2.1).",
      });
    }
    if (env.APP_ENV === "test" && env.NODE_ENV === "production") {
      ctx.addIssue({
        code: "custom",
        path: ["APP_ENV"],
        message:
          "APP_ENV=test is refused with NODE_ENV=production: test routes never ship in a production build.",
      });
    }
  });

export interface Config {
  dataDir: string;
  host: (typeof LOOPBACK_HOSTS)[number];
  port: number;
  allowedOrigins: string[];
  appEnv: "dev" | "test" | "prod";
  fakeModel: boolean;
  logLevel: z.infer<typeof Env>["LOG_LEVEL"];
  runs: {
    maxConcurrent: number;
    leaseSeconds: number;
    maxAttempts: number;
    stallSeconds: number;
    modelRequestTimeoutSeconds: number;
    perConversationPerHour: number;
  };
  /** Names of the `*_API_KEY` variables that are set. The values never leave app/ (§2.6). */
  apiKeyNames: string[];
  /** Values to redact from logs (security.md §2.6). Never returned or logged. */
  secretValues: string[];
}

export type ConfigResult = { ok: true; config: Config } | { ok: false; message: string };

export function parseConfig(env: Record<string, string | undefined>): ConfigResult {
  const parsed = Env.safeParse(env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((issue) => `  ${issue.path.join(".")}: ${issue.message}`);
    return { ok: false, message: `Invalid configuration:\n${lines.join("\n")}` };
  }
  const e = parsed.data;
  const host = LOOPBACK_HOSTS.find((candidate) => candidate === e.HOST) ?? "127.0.0.1";
  const keys = Object.entries(env).filter(
    (entry): entry is [string, string] =>
      entry[0].endsWith("_API_KEY") && entry[1] !== undefined && entry[1] !== "",
  );
  return {
    ok: true,
    config: {
      dataDir: e.DATA_DIR,
      host,
      port: e.PORT,
      allowedOrigins: e.ALLOWED_ORIGINS,
      appEnv: e.APP_ENV,
      fakeModel: e.FAKE_MODEL === "1",
      logLevel: e.LOG_LEVEL,
      runs: {
        maxConcurrent: e.MAX_CONCURRENT_RUNS,
        leaseSeconds: e.RUN_LEASE_SECONDS,
        maxAttempts: e.RUN_MAX_ATTEMPTS,
        stallSeconds: e.RUN_STALL_SECONDS,
        modelRequestTimeoutSeconds: e.MODEL_REQUEST_TIMEOUT_SECONDS,
        perConversationPerHour: e.RUNS_PER_CONVERSATION_PER_HOUR,
      },
      apiKeyNames: keys.map(([name]) => name).sort(),
      secretValues: keys.map(([, value]) => value),
    },
  };
}
