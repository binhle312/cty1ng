import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { parseConfig } from "../../src/app/config";

const run = promisify(execFile);
const BACKEND = join(import.meta.dirname, "../..");

// Starting a process with tsx takes about 2 s alone and longer while the rest of the suite runs.
const START_TIMEOUT_MS = 30_000;

async function start(env: Record<string, string>): Promise<{ code: number; stderr: string }> {
  try {
    await run(process.execPath, ["--import", "tsx", "src/app/main.ts"], {
      cwd: BACKEND,
      env: {
        PATH: process.env.PATH ?? "",
        DATA_DIR: join(BACKEND, "node_modules/.cache/startup-test"),
        ...env,
      },
      timeout: START_TIMEOUT_MS,
    });
    return { code: 0, stderr: "" };
  } catch (error) {
    if (error !== null && typeof error === "object" && "killed" in error && error.killed === true) {
      throw new Error("the backend did not exit; it was killed after the timeout", {
        cause: error,
      });
    }
    if (error !== null && typeof error === "object" && "code" in error && "stderr" in error) {
      return { code: Number(error.code), stderr: String(error.stderr) };
    }
    throw error;
  }
}

describe("AC2: the server never listens beyond loopback (security.md §2.1, §3)", () => {
  it(
    "AC2: starting with HOST=0.0.0.0 exits with a clear error",
    { timeout: START_TIMEOUT_MS + 5000 },
    async () => {
      const { code, stderr } = await start({ HOST: "0.0.0.0" });
      expect(code).toBe(1);
      expect(stderr).toContain("HOST");
      expect(stderr).toContain("loopback");
      expect(stderr).toContain('got "0.0.0.0"');
    },
  );

  it.each(["0.0.0.0", "::", "::1", "192.168.1.10", "example.com"])("refuses HOST=%s", (host) => {
    expect(parseConfig({ HOST: host }).ok).toBe(false);
  });

  it.each(["127.0.0.1", "localhost"])("accepts HOST=%s", (host) => {
    expect(parseConfig({ HOST: host }).ok).toBe(true);
  });
});

describe("configuration (architecture.md §8)", () => {
  it(
    "refuses APP_ENV=test with NODE_ENV=production",
    { timeout: START_TIMEOUT_MS + 5000 },
    async () => {
      const { code, stderr } = await start({ APP_ENV: "test", NODE_ENV: "production" });
      expect(code).toBe(1);
      expect(stderr).toContain("APP_ENV=test is refused with NODE_ENV=production");
    },
  );

  it("uses the documented defaults", () => {
    const result = parseConfig({});
    expect(result.ok && result.config).toMatchObject({
      dataDir: "./data",
      host: "127.0.0.1",
      port: 8000,
      allowedOrigins: ["http://127.0.0.1:5173", "http://localhost:5173"],
      appEnv: "dev",
      fakeModel: false,
      logLevel: "info",
      runs: {
        maxConcurrent: 3,
        leaseSeconds: 900,
        maxAttempts: 3,
        stallSeconds: 600,
        modelRequestTimeoutSeconds: 300,
        perConversationPerHour: 50,
      },
      apiKeyNames: [],
    });
  });

  it.each([
    ["PORT", "0"],
    ["PORT", "abc"],
    ["APP_ENV", "staging"],
    ["LOG_LEVEL", "verbose"],
    ["FAKE_MODEL", "yes"],
    ["ALLOWED_ORIGINS", "http://127.0.0.1:5173/path"],
    ["ALLOWED_ORIGINS", "*"],
  ])("refuses %s=%s with a message naming the variable", (name, value) => {
    const result = parseConfig({ [name]: value });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain(name);
  });

  it("lists which API keys are set by name only", () => {
    const result = parseConfig({ ANTHROPIC_API_KEY: "sk-1234567890", OPENAI_API_KEY: "" });
    expect(result.ok && result.config.apiKeyNames).toEqual(["ANTHROPIC_API_KEY"]);
  });
});
