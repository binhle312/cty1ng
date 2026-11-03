import { describe, expect, it } from "vitest";
import { BOT_SETTINGS, makeBot } from "../../../test/fixtures.ts";
import {
  avatarChanged,
  changedFields,
  editFormOf,
  editProblems,
  type EffectiveTools,
  leaveText,
  mergeTab,
  patchBody,
  tabOfField,
  withTab,
} from "./bot-edit-form.ts";
import type { FormSettings } from "./create-bot-form.ts";

const SETTINGS: FormSettings = {
  limits: { nameMax: 32, descriptionMax: 160, personaMax: 100 },
  historyMin: BOT_SETTINGS.bot_history_min_pct,
  historyMax: BOT_SETTINGS.bot_history_max_pct,
  defaultHistory: BOT_SETTINGS.bot_default_history_pct,
  defaultRequestLimit: BOT_SETTINGS.bot_default_request_limit,
  defaultMaxReplyChars: BOT_SETTINGS.bot_default_max_reply_chars,
};
// The switches as they are: enough for the rules here, which only compare them.
const asIs: EffectiveTools = (form) => form.tool_choices;
const BOT = makeBot(1, "BA", [], { tool_settings: { read_file: true } });
const saved = editFormOf(BOT, SETTINGS);
const ctx = { settings: SETTINGS, otherNames: ["Designer"] };

describe("the bot page's edit form (bot-page.md §4, §6)", () => {
  it("starts with no change on either tab", () => {
    expect(changedFields({ tab: "profile", form: saved, saved, effective: asIs })).toEqual([]);
    expect(changedFields({ tab: "model", form: saved, saved, effective: asIs })).toEqual([]);
  });

  it("counts each tab's own fields only", () => {
    const form = { ...saved, name: "Analyst", request_limit: 20 };
    expect(changedFields({ tab: "profile", form, saved, effective: asIs })).toEqual(["name"]);
    expect(changedFields({ tab: "model", form, saved, effective: asIs })).toEqual([
      "request_limit",
    ]);
  });

  it("reads a colour in another case as the same colour", () => {
    const form = { ...saved, avatar_colour: saved.avatar_colour.toLowerCase() };
    expect(changedFields({ tab: "profile", form, saved, effective: asIs })).toEqual([]);
  });

  it("marks an avatar change, which the page top shows before Save", () => {
    const image = {
      ...saved,
      avatar_style: "upload" as const,
      avatar: { id: "a".repeat(64), url: "/x" },
    };
    const fields = changedFields({ tab: "profile", form: image, saved, effective: asIs });
    expect(fields).toEqual(["avatar_style", "avatar_image"]);
    expect(avatarChanged(fields)).toBe(true);
    expect(avatarChanged(["name"])).toBe(false);
  });

  it("sees a tool switch as one change", () => {
    const form = { ...saved, tool_choices: { read_file: false, web_fetch: true } };
    expect(changedFields({ tab: "model", form, saved, effective: asIs })).toEqual([
      "tool_settings",
    ]);
  });

  it("checks only the fields that changed, so a lower limit keeps a saved persona", () => {
    const long = { ...saved, persona_md: "x".repeat(150) };
    // Saved with 150 characters when the limit was higher: a rename still saves.
    const renamed = { ...long, name: "Analyst" };
    expect(
      editProblems({
        tab: "profile",
        form: renamed,
        changed: changedFields({ tab: "profile", form: renamed, saved: long, effective: asIs }),
        ctx,
      }),
    ).toEqual({});
    const edited = { ...long, persona_md: "y".repeat(150) };
    expect(
      editProblems({
        tab: "profile",
        form: edited,
        changed: changedFields({ tab: "profile", form: edited, saved: long, effective: asIs }),
        ctx,
      }).persona_md,
    ).toBeDefined();
  });

  it("says a taken name and an empty name under Name", () => {
    const taken = { ...saved, name: "designer" };
    expect(editProblems({ tab: "profile", form: taken, changed: ["name"], ctx }).name).toBe(
      "designer is taken by another bot. Pick another name.",
    );
    const empty = { ...saved, name: "  " };
    expect(editProblems({ tab: "profile", form: empty, changed: ["name"], ctx }).name).toBe(
      "Required",
    );
  });

  it("asks for an image when Upload image has none: a new style, or an image taken away", () => {
    const form = { ...saved, avatar_style: "upload" as const, avatar: null };
    expect(editProblems({ tab: "profile", form, changed: ["avatar_style"], ctx }).avatar_id).toBe(
      "Upload an image, or pick Flat.",
    );
    expect(editProblems({ tab: "profile", form, changed: ["avatar_image"], ctx }).avatar_id).toBe(
      "Upload an image, or pick Flat.",
    );
    // The Model tab does not check the avatar.
    expect(editProblems({ tab: "model", form, changed: [], ctx })).toEqual({});
  });

  it("checks the Advanced ranges of the Model tab", () => {
    const form = { ...saved, request_limit: 0, history_share_pct: 33 };
    const problems = editProblems({
      tab: "model",
      form,
      changed: ["request_limit", "history_share_pct"],
      ctx,
    });
    expect(problems.request_limit).toMatch(/^Use a whole number from/);
    expect(problems.history_share_pct).toMatch(/in steps of/);
  });

  it("sends row_version and the changed fields only", () => {
    const form = { ...saved, description: "Writes user stories.", request_limit: 20 };
    expect(
      patchBody({ tab: "profile", form, changed: ["description"], rowVersion: 4, effective: asIs }),
    ).toEqual({
      row_version: 4,
      description: "Writes user stories.",
    });
    expect(
      patchBody({ tab: "model", form, changed: ["request_limit"], rowVersion: 4, effective: asIs }),
    ).toEqual({
      row_version: 4,
      request_limit: 20,
    });
  });

  it("sends an image with its style, and no image with Flat", () => {
    const id = "b".repeat(64);
    const upload = { ...saved, avatar_style: "upload" as const, avatar: { id, url: "/y" } };
    expect(
      patchBody({
        tab: "profile",
        form: upload,
        changed: ["avatar_style", "avatar_image"],
        rowVersion: 1,
        effective: asIs,
      }),
    ).toEqual({
      row_version: 1,
      avatar_style: "upload",
      avatar_id: id,
    });
    const flat = { ...upload, avatar_style: "flat" as const };
    expect(
      patchBody({
        tab: "profile",
        form: flat,
        changed: ["avatar_style"],
        rowVersion: 1,
        effective: asIs,
      }),
    ).toEqual({
      row_version: 1,
      avatar_style: "flat",
    });
  });

  it("sends the whole effective switch map when a tool changed", () => {
    const form = { ...saved, tool_choices: { read_file: false } };
    expect(
      patchBody({ tab: "model", form, changed: ["tool_settings"], rowVersion: 2, effective: asIs }),
    ).toEqual({
      row_version: 2,
      tool_settings: { read_file: false },
    });
  });

  it("copies one tab's fields and leaves the other tab's", () => {
    const form = { ...saved, name: "Analyst", request_limit: 20 };
    const discarded = withTab({ into: form, from: saved, tab: "profile" });
    expect(discarded.name).toBe("BA");
    expect(discarded.request_limit).toBe(20);
  });

  it("takes the other side's values on one tab, except the fields the owner changed", () => {
    const theirs = { ...saved, description: "Saved.", name: "Saved name", request_limit: 99 };
    const mine = { ...saved, name: "Analyst" };
    const merged = mergeTab({ tab: "profile", base: saved, mine, theirs, effective: asIs });
    expect(merged.description).toBe("Saved.");
    expect(merged.name).toBe("Analyst");
    // The other tab stays as it is.
    expect(merged.request_limit).toBe(saved.request_limit);
  });

  it("keeps the style with a new image: an upload after a Discard while a Flat save waits", () => {
    const a = { id: "avatar-a", url: "/a.png" };
    const b = { id: "avatar-b", url: "/b.png" };
    const base = { ...saved, avatar_style: "upload" as const, avatar: a };
    const mine = { ...base, avatar: b };
    const theirs = { ...base, avatar_style: "flat" as const };
    const merged = mergeTab({ tab: "profile", base, mine, theirs, effective: asIs });
    expect(merged.avatar_style).toBe("upload");
    expect(merged.avatar).toEqual(b);
    expect(changedFields({ tab: "profile", form: merged, saved: theirs, effective: asIs })).toEqual(
      ["avatar_style", "avatar_image"],
    );
  });

  it("keeps the image with a new style: Upload of the remembered image while a save waits", () => {
    const a = { id: "avatar-a", url: "/a.png" };
    const c = { id: "avatar-c", url: "/c.png" };
    const base = { ...saved, avatar_style: "flat" as const, avatar: a };
    const mine = { ...base, avatar_style: "upload" as const };
    const theirs = { ...base, avatar: c };
    const merged = mergeTab({ tab: "profile", base, mine, theirs, effective: asIs });
    expect(merged.avatar_style).toBe("upload");
    expect(merged.avatar).toEqual(a);
  });

  it("finds the tab of a field the server named", () => {
    expect(tabOfField("name")).toBe("profile");
    expect(tabOfField("avatar_id")).toBe("profile");
    expect(tabOfField("tool_settings.web_fetch")).toBe("model");
    expect(tabOfField("max_reply_chars")).toBe("model");
  });

  it("names the changed fields in the leave question", () => {
    expect(leaveText(["name"])).toBe(
      "You changed the name. The app has not saved it yet. Stay and save, or let it go.",
    );
    expect(leaveText(["name", "persona_md", "tool_settings"])).toBe(
      "You changed the name, the persona and the tools. The app has not saved them yet. Stay and save, or let them go.",
    );
  });
});
