import { describe, expect, it } from "vitest";
import { CatalogModel, CatalogTool } from "@cty1ng/shared/catalog";
import { loadCatalog, checkCatalogProviders } from "../../src/app/catalog-files.ts";
import { effortsOf, isModelProvider } from "../../src/adapters/model/ai-sdk/effort.ts";
import { testBackend, testConfig } from "../helpers.ts";

// api.md §3: GET /models and GET /tools, from the checked-in config/ files.
describe("GET /models", () => {
  it("lists the catalog in file order, none available with no key, never a key value", async () => {
    const backend = testBackend();
    const response = await backend.request("/api/models");
    expect(response.status).toBe(200);
    const models = CatalogModel.array().parse(await response.json());
    expect(models.map((model) => model.id)).toEqual([
      "google:gemini-3.8-flash",
      "anthropic:claude-opus-5-5",
      "anthropic:claude-sonnet-5-5",
      "anthropic:claude-haiku-5-5",
      "google:gemini-4-argon",
      "google:gemini-3.5-flash-lite",
    ]);
    expect(models.every((model) => !model.available)).toBe(true);
    expect(models[0]).toMatchObject({
      api_key_env: "GEMINI_API_KEY",
      unavailable_reason: "no_api_key",
      efforts: ["low", "medium", "high"],
      default_effort: "medium",
    });
    backend.close();
  });

  it("marks a provider's models available when its key is set, and never returns the key", async () => {
    const backend = testBackend({ GEMINI_API_KEY: "sk-test-gemini-value" });
    const text = await (await backend.request("/api/models")).text();
    expect(text).not.toContain("sk-test-gemini-value");
    const models = CatalogModel.array().parse(JSON.parse(text));
    expect(models.filter((model) => model.available).map((model) => model.provider)).toEqual([
      "google",
      "google",
      "google",
    ]);
    backend.close();
  });

  it("adds the two fake models with FAKE_MODEL=1", async () => {
    const backend = testBackend({ FAKE_MODEL: "1" });
    const models = CatalogModel.array().parse(await (await backend.request("/api/models")).json());
    expect(models.filter((model) => model.available).map((model) => model.id)).toEqual([
      "fake:scripted",
      "fake:effort",
    ]);
    backend.close();
  });
});

describe("GET /tools", () => {
  it("lists internal tools open and provider tools later or locked", async () => {
    const backend = testBackend();
    const tools = CatalogTool.array().parse(await (await backend.request("/api/tools")).json());
    const switchOf = Object.fromEntries(tools.map((tool) => [tool.id, tool.switch]));
    expect(switchOf).toMatchObject({
      files: "open",
      view_images: "open",
      skills: "open",
      hand_off: "open",
      memory: "open",
      web_search: "later",
      web_fetch: "later",
      code_execution: "later",
      advisor: "later",
      tool_search: "later",
      mcp_connector: "locked",
      google_search: "later",
      url_context: "later",
      google_code_execution: "later",
    });
    // A job both providers can do is one row on the page (decision 10).
    expect(tools.find((tool) => tool.id === "google_search")?.job).toBe("web_search");
    backend.close();
  });
});

describe("the checked-in catalog", () => {
  it("names only providers and efforts the model adapter can send", () => {
    const catalog = loadCatalog(testConfig("/tmp/unused"));
    expect(() => {
      checkCatalogProviders(catalog, { isProvider: isModelProvider, efforts: effortsOf });
    }).not.toThrow();
  });

  it("refuses a provider with no adapter at start", () => {
    const catalog = loadCatalog(testConfig("/tmp/unused"));
    expect(() => {
      checkCatalogProviders(catalog, { isProvider: (p) => p === "anthropic", efforts: effortsOf });
    }).toThrow("the app has no adapter for google yet");
  });
});
