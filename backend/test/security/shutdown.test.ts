import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { get } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const BACKEND = join(import.meta.dirname, "../..");

describe("graceful shutdown", () => {
  it(
    "SIGTERM ends open SSE streams and the process exits promptly",
    { timeout: 40_000 },
    async () => {
      const dataDir = mkdtempSync(join(tmpdir(), "cty1ng-shutdown-"));
      const port = 18_000 + Math.floor(Math.random() * 1000);
      const child = spawn(process.execPath, ["--import", "tsx", "src/app/main.ts"], {
        cwd: BACKEND,
        env: {
          PATH: process.env.PATH ?? "",
          DATA_DIR: dataDir,
          PORT: String(port),
          LOG_LEVEL: "info",
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      try {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error("server did not start")), 30_000);
          child.stdout.on("data", (chunk: Buffer) => {
            if (chunk.toString().includes('"app.listening"')) {
              clearTimeout(timer);
              resolve();
            }
          });
        });

        // Hold an SSE connection open, as a browser tab does.
        const streamEnded = new Promise<void>((resolve, reject) => {
          get({ host: "127.0.0.1", port, path: "/api/stream" }, (response) => {
            expect(response.statusCode).toBe(200);
            response.on("data", () => undefined);
            response.on("end", resolve);
            response.on("error", resolve);
            response.on("close", resolve);
          }).on("error", reject);
        });
        await new Promise((resolve) => setTimeout(resolve, 200));

        const started = Date.now();
        const exited = new Promise<number | null>((resolve) =>
          child.on("exit", (code) => resolve(code)),
        );
        child.kill("SIGTERM");
        const code = await Promise.race([
          exited,
          new Promise<"hung">((resolve) => setTimeout(() => resolve("hung"), 8_000)),
        ]);
        expect(code).toBe(0);
        expect(Date.now() - started).toBeLessThan(8_000);
        await streamEnded;
      } finally {
        child.kill("SIGKILL");
        rmSync(dataDir, { recursive: true, force: true });
      }
    },
  );
});
