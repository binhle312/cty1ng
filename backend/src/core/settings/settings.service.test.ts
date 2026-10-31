import { SETTING_DEFAULTS } from "@cty1ng/shared/settings";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { backendAt, tempDir, testBackend } from "../../../test/helpers.ts";

// The settings service (api.md §7, domain-model.md §10).

let backend: ReturnType<typeof testBackend>;
beforeEach(() => {
  backend = testBackend();
});
afterEach(() => {
  backend.close();
});

describe("settings", () => {
  it("reads every key as its default when nothing was saved", async () => {
    expect(await backend.settings.get()).toEqual({
      trash_days: 30,
      skill_name_max: 64,
      skill_body_max: 20_000,
      skill_body_warn_lines: 500,
    });
    expect(await backend.settings.get()).toEqual(SETTING_DEFAULTS);
  });

  it("saves only the keys of the patch and emits one settings.updated", async () => {
    const saved = await backend.settings.update({ trash_days: 7, skill_name_max: 32 });
    expect(saved).toEqual({ ...SETTING_DEFAULTS, trash_days: 7, skill_name_max: 32 });
    expect(await backend.settings.get()).toEqual(saved);
    const events = await backend.readers.events.after(0, 100);
    expect(events.map((event) => [event.type, event.payload])).toEqual([
      ["settings.updated", { settings: saved }],
    ]);
  });

  it("keeps the values after a restart of the backend", async () => {
    const dir = tempDir("settings");
    const first = backendAt(dir.path);
    await first.settings.update({ skill_body_warn_lines: 80 });
    first.close();
    const again = backendAt(dir.path);
    expect((await again.settings.get()).skill_body_warn_lines).toBe(80);
    again.close();
    dir.remove();
  });

  it("an empty patch saves nothing and emits nothing", async () => {
    expect(await backend.settings.update({})).toEqual(SETTING_DEFAULTS);
    expect(await backend.readers.events.after(0, 100)).toEqual([]);
  });

  it("a stored value out of its range reads as the default", async () => {
    await backend.uow.run((tx) => tx.settings.set("skill_name_max", 9_999));
    expect((await backend.settings.get()).skill_name_max).toBe(64);
  });
});
