import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { compose } from "../../src/app/compose.ts";
import { HOST, memoryLogger, tempDir, testConfig } from "../helpers.ts";

// The backend serves the built frontend in a production build (M0c plan, decision B). A fake
// dist/ folder stands in for the Vite build; a secret file sits next to it.
const root = tempDir("dist");
const dist = join(root.path, "dist");
mkdirSync(join(dist, "assets"), { recursive: true });
writeFileSync(join(dist, "index.html"), "<!doctype html><title>app</title>");
writeFileSync(join(dist, "assets/app-abc123.js"), "console.log(1)");
writeFileSync(join(dist, "theme-init.js"), "void 0");
writeFileSync(join(root.path, "secret.txt"), "TOP SECRET");

const data = tempDir("frontend-files");
const config = { ...testConfig(data.path), frontendDir: dist };
const backend = compose(config, memoryLogger().log);
const get = (path: string, method = "GET") =>
  backend.app.request(`http://${HOST}${path}`, { method, headers: { host: HOST } });

afterAll(() => {
  backend.close();
  data.remove();
  root.remove();
});

describe("built frontend", () => {
  it("serves index.html at / with the CSP", async () => {
    const response = await get("/");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(response.headers.get("cache-control")).toBe("no-cache");
    expect(await response.text()).toContain("<title>app</title>");
  });

  it.each(["/bots/new", "/skills/write-stories", "/c/conv_01h455vb4pex5vsknk084sn02q", "/stats"])(
    "answers a reload of %s with the app page",
    async (path) => {
      const response = await get(path);
      expect(response.status).toBe(200);
      expect(await response.text()).toContain("<title>app</title>");
    },
  );

  it("serves hashed assets for a year and other files with no-cache", async () => {
    const asset = await get("/assets/app-abc123.js");
    expect(asset.status).toBe(200);
    expect(asset.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    const script = await get("/theme-init.js");
    expect(script.headers.get("cache-control")).toBe("no-cache");
  });

  it.each(["/api/nope", "/api", "/api/health/extra"])(
    "keeps %s an API error, not the app page",
    async (path) => {
      const response = await get(path);
      expect(response.status).toBe(404);
      expect(response.headers.get("content-type")).toContain("application/json");
      expect(await response.json()).toMatchObject({ error: { code: "not_found" } });
    },
  );

  it("gives a missing file a 404, not the app page", async () => {
    const response = await get("/assets/missing-123.js");
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code: "not_found" } });
  });

  it.each([
    "/../secret.txt",
    "/assets/../../secret.txt",
    "/%2e%2e/secret.txt",
    "/assets/%2e%2e%2f%2e%2e%2fsecret.txt",
    "/..%5csecret.txt",
  ])("never serves a file outside dist/: %s", async (path) => {
    const response = await get(path);
    expect(await response.text()).not.toContain("TOP SECRET");
  });

  it("answers HEAD with headers only", async () => {
    const response = await get("/bots", "HEAD");
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
  });
});

describe("startup", () => {
  it("stops with a clear message when the build is missing", () => {
    const dir = tempDir("no-dist");
    try {
      expect(() =>
        compose(
          { ...testConfig(dir.path), frontendDir: join(dir.path, "dist") },
          memoryLogger().log,
        ),
      ).toThrow(/index\.html does not exist\. Run `pnpm build`/);
    } finally {
      dir.remove();
    }
  });
});
