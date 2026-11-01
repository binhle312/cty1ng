import { describe, expect, it } from "vitest";
import { buildCatalog, CatalogError, modelAvailability } from "./catalog.rules.ts";

const TOOLS = [
  {
    id: "files",
    label: "Files",
    kind: "internal",
    job: "files",
    added: "2026-10-24",
    sends_data_out: false,
    web: false,
    line: "Files.",
    switch: "open",
  },
  {
    id: "web_search",
    label: "Web search",
    kind: "provider",
    provider: "anthropic",
    job: "web_search",
    added: "2026-10-24",
    sends_data_out: false,
    web: true,
    line: "Search.",
    switch: "later",
  },
];

const MODEL = {
  id: "anthropic:model-a",
  label: "Model A",
  api_key_env: "ANTHROPIC_API_KEY",
  efforts: ["low", "medium", "high"],
  default_effort: "medium",
  multimodal: true,
  context_window: 1000,
  provider_tools: ["web_search"],
};

function build(models: unknown[], options: { fakeModel?: boolean; keys?: string[] } = {}) {
  return buildCatalog({
    models,
    tools: TOOLS,
    fakeModel: options.fakeModel ?? false,
    keySet: (name) => (options.keys ?? []).includes(name),
  });
}

describe("buildCatalog (domain-model.md §4, §4.1)", () => {
  it("marks a model available only when its key variable is set", () => {
    expect(build([MODEL]).models[0]).toMatchObject({
      provider: "anthropic",
      available: false,
      unavailable_reason: "no_api_key",
      api_key_env: "ANTHROPIC_API_KEY",
    });
    expect(build([MODEL], { keys: ["ANTHROPIC_API_KEY"] }).models[0]).toMatchObject({
      available: true,
      unavailable_reason: null,
    });
  });

  it("adds fake:scripted and fake:effort after the file's models with FAKE_MODEL=1", () => {
    const catalog = build([MODEL], { fakeModel: true });
    expect(catalog.models.map((model) => model.id)).toEqual([
      "anthropic:model-a",
      "fake:scripted",
      "fake:effort",
    ]);
    expect(catalog.model("fake:scripted")).toMatchObject({ available: true, efforts: [] });
    expect(catalog.model("fake:effort")).toMatchObject({
      available: true,
      efforts: ["low", "medium", "high"],
      default_effort: "medium",
    });
    expect(build([MODEL]).model("fake:scripted")).toBeUndefined();
  });

  it("keeps file order", () => {
    const second = { ...MODEL, id: "anthropic:model-b" };
    expect(build([second, MODEL]).models.map((model) => model.id)).toEqual([
      "anthropic:model-b",
      "anthropic:model-a",
    ]);
  });

  it.each([
    ["a default effort not in the list", { default_effort: "max" }, "default_effort must be one"],
    ["no default with efforts", { default_effort: undefined }, "default_effort must be one"],
    ["a default with no efforts", { efforts: [] }, "default_effort without efforts"],
    ["an unknown effort level", { efforts: ["turbo"] }, "efforts.0"],
    ["a provider tool it does not list", { provider_tools: ["files"] }, "is not a anthropic tool"],
    ["another provider's tool", { id: "google:g" }, "is not a google tool"],
    ["a key variable without _API_KEY", { api_key_env: "SECRET" }, "api_key_env"],
    ["a fake model in the file", { id: "fake:x" }, "the fake provider is built in"],
    ["an unknown field", { colour: "red" }, "Unrecognized key"],
  ])("refuses %s", (_label, change, message) => {
    expect(() => build([{ ...MODEL, ...change }])).toThrow(message);
  });

  it("refuses a model listed twice", () => {
    expect(() => build([MODEL, MODEL])).toThrow("anthropic:model-a is listed twice");
  });

  it("refuses a tool that needs a tool not in the list", () => {
    expect(() =>
      buildCatalog({
        models: [],
        tools: [{ ...TOOLS[0], id: "view_images", needs: ["nothing"] }],
        fakeModel: false,
        keySet: () => false,
      }),
    ).toThrow("view_images needs nothing");
  });

  it("refuses a provider tool with no provider", () => {
    expect(() =>
      buildCatalog({
        models: [],
        tools: [{ ...TOOLS[1], provider: undefined }],
        fakeModel: false,
        keySet: () => false,
      }),
    ).toThrow(CatalogError);
  });
});

describe("modelAvailability (domain-model.md §2 Availability)", () => {
  it("says why a bot cannot run", () => {
    const catalog = build([MODEL]);
    expect(modelAvailability(catalog, "anthropic:gone")).toEqual({
      available: false,
      reason: "model_removed",
    });
    expect(modelAvailability(catalog, "anthropic:model-a")).toEqual({
      available: false,
      reason: "no_api_key",
    });
    expect(
      modelAvailability(build([MODEL], { keys: ["ANTHROPIC_API_KEY"] }), "anthropic:model-a"),
    ).toEqual({
      available: true,
      reason: null,
    });
  });
});
