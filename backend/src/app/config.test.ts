import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT, loadConfig } from "./config.ts";

// architecture.md §8 and the M0b plan, decision F.
describe("loadConfig", () => {
  it("uses the documented defaults", () => {
    const config = loadConfig({});
    expect(config).toMatchObject({
      dataDir: join(REPO_ROOT, "data"),
      databaseFile: join(REPO_ROOT, "data/app.db"),
      host: "127.0.0.1",
      port: 8000,
      appEnv: "dev",
      fakeModel: false,
      logLevel: "info",
    });
    expect(config.allowedOrigins).toEqual([
      "http://127.0.0.1:8000",
      "http://localhost:8000",
      "http://127.0.0.1:5173",
      "http://localhost:5173",
    ]);
    expect(config.allowedHosts).toEqual(["127.0.0.1:8000", "localhost:8000"]);
  });

  it.each(["127.0.0.1", "localhost"])("accepts HOST=%s", (host) => {
    expect(loadConfig({ HOST: host }).host).toBe(host);
  });

  // Review of PR #48: these are loopback, but the Host check would refuse their requests.
  it.each(["::1", "127.0.0.2"])("refuses HOST=%s, which the Host check does not serve", (host) => {
    expect(() => loadConfig({ HOST: host })).toThrow(
      /the Host check serves only 127\.0\.0\.1 and localhost/,
    );
  });

  it("refuses an ALLOWED_ORIGINS entry that is not an origin", () => {
    expect(() => loadConfig({ ALLOWED_ORIGINS: "http://a.test/path" })).toThrow(/not an origin/);
    expect(() => loadConfig({ ALLOWED_ORIGINS: "*" })).toThrow(/not an origin/);
  });

  it("collects only non-empty *_API_KEY values as secrets", () => {
    expect(loadConfig({ OPENAI_API_KEY: "k1", EMPTY_API_KEY: "", OTHER: "x" }).secrets).toEqual([
      "k1",
    ]);
  });

  it("keeps an absolute DATA_DIR as it is", () => {
    expect(loadConfig({ DATA_DIR: "/srv/cty1ng" }).dataDir).toBe("/srv/cty1ng");
  });

  it("chooses the same data folder when started from the root and from backend/", () => {
    const script =
      'import { loadConfig } from "./backend/src/app/config.ts"; console.log(loadConfig(process.env).dataDir);';
    const fromRoot = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
      cwd: REPO_ROOT,
      env: { PATH: process.env.PATH, DATA_DIR: "./data" },
      encoding: "utf8",
    });
    const fromBackend = spawnSync(
      process.execPath,
      ["--input-type=module", "-e", script.replace("./backend/", "./")],
      {
        cwd: resolve(REPO_ROOT, "backend"),
        env: { PATH: process.env.PATH, DATA_DIR: "./data" },
        encoding: "utf8",
      },
    );
    expect(fromRoot.stderr).toBe("");
    expect(fromRoot.stdout.trim()).toBe(join(REPO_ROOT, "data"));
    expect(fromBackend.stdout.trim()).toBe(fromRoot.stdout.trim());
  });
});
