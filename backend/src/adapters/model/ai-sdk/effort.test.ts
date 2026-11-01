import { describe, expect, it } from "vitest";
import { effortOptions, isModelProvider, effortsOf } from "./effort.ts";

describe("effort mapping (domain-model.md §4)", () => {
  it.each(["low", "medium", "high", "xhigh", "max"] as const)(
    "Anthropic %s → providerOptions.anthropic.effort",
    (effort) => {
      expect(effortOptions("anthropic", effort)).toEqual({ anthropic: { effort } });
    },
  );

  it.each(["minimal", "low", "medium", "high"] as const)(
    "Google %s → providerOptions.google.thinkingConfig.thinkingLevel",
    (effort) => {
      expect(effortOptions("google", effort)).toEqual({
        google: { thinkingConfig: { thinkingLevel: effort } },
      });
    },
  );

  it("sends nothing for a model with no efforts", () => {
    expect(effortOptions("anthropic", null)).toEqual({});
  });

  it("refuses a level the provider does not take", () => {
    expect(() => effortOptions("anthropic", "minimal")).toThrow("anthropic has no effort minimal");
    expect(() => effortOptions("google", "max")).toThrow("google has no effort max");
  });

  it("knows Anthropic and Google only", () => {
    expect(isModelProvider("anthropic")).toBe(true);
    expect(isModelProvider("google")).toBe(true);
    expect(isModelProvider("openai")).toBe(false);
    expect(isModelProvider("toString")).toBe(false);
    expect(effortsOf("google")).toEqual(["minimal", "low", "medium", "high"]);
    expect(effortsOf("openai")).toEqual([]);
  });
});
