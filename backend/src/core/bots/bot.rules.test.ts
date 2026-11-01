import { SETTING_DEFAULTS } from "@cty1ng/shared/settings";
import { describe, expect, it } from "vitest";
import {
  advancedProblem,
  botHealth,
  botTextProblem,
  orderBots,
  resolveEffort,
} from "./bot.rules.ts";

const S = SETTING_DEFAULTS;
const day = (n: number) => new Date(Date.UTC(2026, 10, n));

describe("botTextProblem", () => {
  it("checks the limit, then the guard", () => {
    expect(botTextProblem("name", "BA", S)).toBeNull();
    expect(botTextProblem("description", "x".repeat(161), S)).toMatchObject({
      code: "validation_error",
      field: "description",
    });
    expect(
      botTextProblem("persona_md", "You are nice.\nkey sk-ant-api03-" + "a".repeat(90), S),
    ).toMatchObject({ code: "sensitive_data", field: "persona_md" });
  });
});

describe("resolveEffort (decision 4)", () => {
  const model = { label: "M", efforts: ["low", "high"] as const, default_effort: "high" as const };
  it("takes the sent effort, else the model's default", () => {
    expect(resolveEffort({ ...model, efforts: [...model.efforts] }, "low")).toEqual({
      effort: "low",
    });
    expect(resolveEffort({ ...model, efforts: [...model.efforts] }, undefined)).toEqual({
      effort: "high",
    });
    expect(resolveEffort({ ...model, efforts: [...model.efforts] }, null)).toEqual({
      effort: "high",
    });
  });
  it("refuses an effort the model has not, and any effort on a model with none", () => {
    expect(resolveEffort({ ...model, efforts: [...model.efforts] }, "max")).toMatchObject({
      code: "effort_not_supported",
    });
    expect(resolveEffort({ label: "M", efforts: [], default_effort: null }, "low")).toMatchObject({
      code: "effort_not_supported",
    });
    expect(resolveEffort({ label: "M", efforts: [], default_effort: null }, null)).toEqual({
      effort: null,
    });
  });
});

describe("advancedProblem", () => {
  it.each([
    ["history_share_pct", 10, true],
    ["history_share_pct", 80, true],
    ["history_share_pct", 5, false],
    ["history_share_pct", 42, false],
    ["request_limit", 1, true],
    ["request_limit", 101, false],
    ["max_reply_chars", 499, false],
    ["max_reply_chars", 20_000, true],
  ] as const)("%s %d ok=%s", (field, value, ok) => {
    expect(advancedProblem(field, value, S) === null).toBe(ok);
  });
});

describe("orderBots (domain-model.md §2 Order)", () => {
  const bot = (id: string, created: number, pinned: number | null = null, active?: number) => ({
    id,
    pinnedPosition: pinned,
    createdAt: day(created),
    lastActivityAt: active === undefined ? null : day(active),
  });
  const ids = (list: { id: string }[]) => list.map((b) => b.id);

  it("puts pinned bots first by position, then the rest by the setting", () => {
    const bots = [bot("a", 1), bot("b", 2, 2), bot("c", 3), bot("d", 4, 1)];
    expect(ids(orderBots(bots, { bot_order: "created", bot_order_direction: "desc" }))).toEqual([
      "d",
      "b",
      "c",
      "a",
    ]);
    expect(ids(orderBots(bots, { bot_order: "created", bot_order_direction: "asc" }))).toEqual([
      "d",
      "b",
      "a",
      "c",
    ]);
  });

  it("with recent, bots with activity come first, then the rest by created_at", () => {
    const bots = [bot("a", 1, null, 9), bot("b", 2), bot("c", 3, null, 5), bot("d", 4)];
    expect(ids(orderBots(bots, { bot_order: "recent", bot_order_direction: "desc" }))).toEqual([
      "a",
      "c",
      "d",
      "b",
    ]);
  });
});

describe("botHealth (bots.md UI-4.6)", () => {
  it("gives Cannot run first, then a deprecated skill, else nothing", () => {
    expect(botHealth({ available: false, reason: "no_api_key" }, [{ deprecated: true }])).toEqual({
      level: "cannot_run",
      reason: "no_api_key",
    });
    expect(botHealth({ available: true, reason: null }, [{ deprecated: true }])).toEqual({
      level: "needs_attention",
      reason: "deprecated_skill",
    });
    expect(botHealth({ available: true, reason: null }, [{ deprecated: false }])).toBeNull();
  });
});
