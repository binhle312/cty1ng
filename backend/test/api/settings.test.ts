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
  ])("refuses %j with 422 on its key", async (body, field) => {
    const response = await patch(body);
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ error: { code: "validation_error", field } });
    expect(await backend.readers.events.after(0, 100)).toEqual([]);
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
