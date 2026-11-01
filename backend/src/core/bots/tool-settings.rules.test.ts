import type { CatalogTool } from "@cty1ng/shared/catalog";
import { describe, expect, it } from "vitest";
import { effectiveToolSettings, toolSettingsProblem } from "./tool-settings.rules.ts";

function tool(id: string, fields: Partial<CatalogTool> = {}): CatalogTool {
  return {
    id,
    label: id,
    kind: "internal",
    provider: null,
    job: id,
    added: "2026-10-24",
    sends_data_out: false,
    web: false,
    line: id,
    off_line: null,
    needs: [],
    switch: "open",
    ...fields,
  };
}

const provider = (id: string, fields: Partial<CatalogTool> = {}) =>
  tool(id, { kind: "provider", provider: "anthropic", switch: "later", ...fields });

const TOOLS = [
  tool("files"),
  tool("view_images", { needs: ["files"] }),
  tool("hand_off", { needs: ["files"] }),
  tool("memory"),
  provider("web_search"),
  provider("mcp_connector", { switch: "locked" }),
];
const MODEL = {
  provider_tools: ["web_search", "mcp_connector"],
  multimodal: true,
  label: "Model A",
};

describe("effectiveToolSettings (domain-model.md §2, steps 1–6)", () => {
  it("(2) defaults internal tools on and provider tools off", () => {
    expect(effectiveToolSettings({}, TOOLS, MODEL)).toEqual({
      files: true,
      view_images: true,
      hand_off: true,
      memory: true,
      web_search: false,
      mcp_connector: false,
    });
  });

  it("(1) keeps a stored choice, and a tool added later takes its default", () => {
    expect(effectiveToolSettings({ memory: false }, TOOLS, MODEL)).toMatchObject({
      memory: false,
      files: true,
    });
  });

  it("(2a) reads a stored true on a later or locked tool as off", () => {
    expect(
      effectiveToolSettings({ web_search: true, mcp_connector: true }, TOOLS, MODEL),
    ).toMatchObject({ web_search: false, mcp_connector: false });
  });

  it("(3) drops tools the model does not offer and turns View images off when not multimodal", () => {
    const result = effectiveToolSettings({ web_search: true }, TOOLS, {
      provider_tools: [],
      multimodal: false,
    });
    expect(Object.hasOwn(result, "web_search")).toBe(false);
    expect(result.view_images).toBe(false);
  });

  it("(4) turns off a tool whose needed tool is off", () => {
    expect(effectiveToolSettings({ files: false }, TOOLS, MODEL)).toMatchObject({
      files: false,
      view_images: false,
      hand_off: false,
    });
  });

  it("(5) a new default never takes a job that a stored choice holds; (6) needs run again", () => {
    const tools = [
      tool("files"),
      tool("fetch_internal", { job: "web_fetch" }),
      provider("fetch_provider", { job: "web_fetch", switch: "open" }),
      tool("reader", { needs: ["fetch_internal"] }),
    ];
    const model = { provider_tools: ["fetch_provider"], multimodal: true };
    expect(effectiveToolSettings({ fetch_provider: true }, tools, model)).toEqual({
      files: true,
      fetch_internal: false,
      fetch_provider: true,
      reader: false,
    });
  });
});

describe("toolSettingsProblem (POST and PATCH bodies)", () => {
  it("refuses a provider tool turned on while its switch is later or locked", () => {
    expect(toolSettingsProblem({ web_search: true }, {}, TOOLS, MODEL)).toMatchObject({
      code: "tool_not_available",
      field: "tool_settings.web_search",
    });
    expect(toolSettingsProblem({ mcp_connector: true }, {}, TOOLS, MODEL)).toMatchObject({
      code: "tool_not_available",
      message: "mcp_connector needs a decision before a bot can use it.",
    });
  });

  it("refuses a tool the model does not offer when it is on, and ignores it when off", () => {
    const model = { ...MODEL, provider_tools: [] };
    expect(toolSettingsProblem({ web_search: true }, {}, TOOLS, model)).toMatchObject({
      code: "tool_not_available",
      message: "Model A has no web_search tool. Turn it off.",
    });
    expect(
      toolSettingsProblem({ web_search: false, nonsense: false }, {}, TOOLS, model),
    ).toBeNull();
  });

  it("refuses View images on a model that does not read images", () => {
    expect(
      toolSettingsProblem({ view_images: true }, {}, TOOLS, { ...MODEL, multimodal: false }),
    ).toMatchObject({ code: "tool_not_available", field: "tool_settings.view_images" });
  });

  it("refuses two tools of one job", () => {
    const tools = [tool("a", { job: "fetch" }), tool("b", { job: "fetch" })];
    expect(toolSettingsProblem({ a: true, b: true }, {}, tools, MODEL)).toMatchObject({
      code: "tool_job_conflict",
      field: "tool_settings.b",
    });
  });

  it("refuses a tool turned on whose job a saved tool still holds, unless the body turns it off", () => {
    const tools = [tool("a", { job: "fetch" }), tool("b", { job: "fetch" })];
    expect(toolSettingsProblem({ b: true }, { a: true, b: false }, tools, MODEL)).toEqual({
      code: "tool_job_conflict",
      field: "tool_settings.b",
      message: "a and b do the same job. Turn one off.",
    });
    expect(toolSettingsProblem({ a: false, b: true }, { a: true, b: false }, tools, MODEL)).toBe(
      null,
    );
    // A saved tool that is gated now holds no job.
    const gated = [tool("a", { job: "fetch", switch: "later" }), tool("b", { job: "fetch" })];
    expect(toolSettingsProblem({ b: true }, { a: true }, gated, MODEL)).toBe(null);
  });

  it("refuses a tool on while a tool it needs is off, also in the saved settings", () => {
    expect(
      toolSettingsProblem({ files: false, view_images: true }, {}, TOOLS, MODEL),
    ).toMatchObject({
      code: "validation_error",
      field: "tool_settings.view_images",
      message: "view_images needs files. Turn that on first.",
    });
    expect(
      toolSettingsProblem({ view_images: true }, { files: false }, TOOLS, MODEL),
    ).toMatchObject({
      code: "validation_error",
    });
    expect(toolSettingsProblem({ view_images: true }, {}, TOOLS, MODEL)).toBeNull();
  });
});
