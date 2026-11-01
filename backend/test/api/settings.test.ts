import { SETTING_DEFAULTS } from "@cty1ng/shared/settings";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ORIGIN, testBackend } from "../helpers.ts";

// GET and PATCH /settings (api.md §7) for the keys built so far.

let backend: ReturnType<typeof testBackend>;
beforeEach(() => {
  backend = testBackend();
});
afterEach(() => {
  backend.close();
});

const patch = (body: unknown) =>
  backend.request("/api/settings", {
    method: "PATCH",
    headers: { origin: ORIGIN, "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("settings API", () => {
  it("GET gives the defaults", async () => {
    const response = await backend.request("/api/settings");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(SETTING_DEFAULTS);
  });

  it("PATCH saves, GET reads it back, and the event is written", async () => {
    const response = await patch({ skill_body_max: 5_000 });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ skill_body_max: 5_000, trash_days: 30 });
    expect(await (await backend.request("/api/settings")).json()).toMatchObject({
      skill_body_max: 5_000,
    });
    const events = await backend.readers.events.after(0, 100);
    expect(events.map((event) => event.type)).toEqual(["settings.updated"]);
  });

  it.each([
    [{ trash_days: 0 }, "trash_days"],
    [{ skill_name_max: 15 }, "skill_name_max"],
    [{ skill_name_max: 129 }, "skill_name_max"],
    [{ skill_body_max: 999 }, "skill_body_max"],
    [{ skill_body_max: 100_001 }, "skill_body_max"],
    [{ skill_body_warn_lines: 49 }, "skill_body_warn_lines"],
    [{ skill_body_warn_lines: 5_001 }, "skill_body_warn_lines"],
    [{ trash_days: 1.5 }, "trash_days"],
    // Bot keys (domain-model.md §10, M2 spec gap pass).
    [{ bot_name_max: 15 }, "bot_name_max"],
    [{ bot_name_max: 65 }, "bot_name_max"],
    [{ bot_description_max: 79 }, "bot_description_max"],
    [{ bot_description_max: 501 }, "bot_description_max"],
    [{ bot_persona_max: 999 }, "bot_persona_max"],
    [{ bot_persona_max: 32_001 }, "bot_persona_max"],
    [{ bot_history_min_pct: 0 }, "bot_history_min_pct"],
    [{ bot_history_min_pct: 12 }, "bot_history_min_pct"],
    [{ bot_history_max_pct: 95 }, "bot_history_max_pct"],
    [{ bot_default_history_pct: 42 }, "bot_default_history_pct"],
    [{ bot_default_request_limit: 0 }, "bot_default_request_limit"],
    [{ bot_default_request_limit: 101 }, "bot_default_request_limit"],
    [{ bot_default_max_reply_chars: 499 }, "bot_default_max_reply_chars"],
    [{ bot_default_max_reply_chars: 20_001 }, "bot_default_max_reply_chars"],
    [{ health_recent_runs: 51 }, "health_recent_runs"],
    [{ health_limit_stops: 0 }, "health_limit_stops"],
    [{ health_limit_window_days: 31 }, "health_limit_window_days"],
    [{ bot_order: "name" }, "bot_order"],
    [{ bot_order_direction: "up" }, "bot_order_direction"],
    // Cross-field checks: 422 with the key the save changed; nothing is saved.
    [{ bot_history_min_pct: 45 }, "bot_history_min_pct"],
    [{ bot_history_max_pct: 50, bot_default_history_pct: 55 }, "bot_default_history_pct"],
    [{ bot_default_history_pct: 85 }, "bot_default_history_pct"],
    [{ health_failed_runs: 6 }, "health_failed_runs"],
    [{ health_recent_runs: 1 }, "health_recent_runs"],
  ])("refuses %j with 422 on its key", async (body, field) => {
    const response = await patch(body);
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ error: { code: "validation_error", field } });
    expect(await backend.readers.events.after(0, 100)).toEqual([]);
  });

  it("never changes the other key of a broken cross-field rule", async () => {
    expect((await patch({ health_failed_runs: 6 })).status).toBe(422);
    expect(await (await backend.request("/api/settings")).json()).toMatchObject({
      health_failed_runs: 2,
      health_recent_runs: 5,
    });
  });

  it("accepts two keys that only fit together", async () => {
    const response = await patch({
      bot_history_min_pct: 50,
      bot_history_max_pct: 90,
      bot_default_history_pct: 50,
    });
    expect(response.status).toBe(200);
  });

  it("refuses an unknown key with 422", async () => {
    const response = await patch({ budget_usd: 5 });
    expect(response.status).toBe(422);
  });

  it("accepts the edges of each range", async () => {
    const response = await patch({
      trash_days: 1,
      skill_name_max: 128,
      skill_body_max: 1_000,
      skill_body_warn_lines: 5_000,
    });
    expect(response.status).toBe(200);
  });
});
