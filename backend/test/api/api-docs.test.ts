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
    // No inline script or style: every <script> has a src, and there is no <style> or style=.
    expect(html).not.toMatch(/<script\b(?![^>]*\ssrc=)|<style\b|\sstyle\s*=/i);
    expect(html).toMatch(/<script\s[^>]*src=/i);
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

// The generated client checks every answer against the OpenAPI document (scripts/gen-api.ts).
// A nullable enum whose `enum` list leaves out null makes every `null` answer fail in the
// browser: `z.literal("no_api_key").nullable()` did that to GET /models (M2b). Every nullable
// enum in the document lists null.
describe("the OpenAPI document", () => {
  const backend = testBackend({ APP_ENV: "prod" });
  afterAll(() => {
    backend.close();
  });

  function nullableEnumsWithoutNull(node: unknown, path: string, found: string[]): string[] {
    if (Array.isArray(node)) {
      node.forEach((item, index) =>
        nullableEnumsWithoutNull(item, `${path}[${String(index)}]`, found),
      );
      return found;
    }
    if (typeof node !== "object" || node === null) return found;
    const type: unknown = Reflect.get(node, "type");
    const values: unknown = Reflect.get(node, "enum");
    const nullable =
      (Array.isArray(type) && type.includes("null")) || Reflect.get(node, "nullable") === true;
    if (nullable && Array.isArray(values) && !values.includes(null)) found.push(path);
    for (const [key, value] of Object.entries(node)) {
      nullableEnumsWithoutNull(value, `${path}.${key}`, found);
    }
    return found;
  }

  it("lists null in the enum of every nullable enum", async () => {
    const response = await backend.request("/api/openapi.json");
    expect(response.status).toBe(200);
    const document: unknown = await response.json();
    expect(nullableEnumsWithoutNull(document, "$", [])).toEqual([]);
  });
});
