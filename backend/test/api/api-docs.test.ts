import { afterAll, describe, expect, it } from "vitest";
import { testBackend } from "../helpers.ts";

// The OpenAPI docs page only when APP_ENV=dev (security.md §2.10), with no inline script, so
// the CSP stays as it is.
describe("OpenAPI docs page", () => {
  const dev = testBackend({ APP_ENV: "dev" });
  afterAll(() => {
    dev.close();
  });

  it("serves the page, its files and its start script in dev", async () => {
    const page = await dev.request("/api/docs");
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).not.toMatch(/<script>|<style>|style=/);
    expect(page.headers.get("content-security-policy")).toContain("default-src 'self'");
    for (const file of [
      "/api/docs/init.js",
      "/api/docs/swagger-ui-bundle.js",
      "/api/docs/swagger-ui.css",
    ]) {
      const response = await dev.request(file);
      expect(response.status, file).toBe(200);
    }
  });

  it.each(["test", "prod"])("is not there when APP_ENV=%s", async (appEnv) => {
    const backend = testBackend({ APP_ENV: appEnv });
    try {
      expect((await backend.request("/api/docs")).status).toBe(404);
    } finally {
      backend.close();
    }
  });
});
