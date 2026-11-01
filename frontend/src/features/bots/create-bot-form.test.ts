import { describe, expect, it } from "vitest";
import {
  BOT_SETTINGS,
  FAKE_SCRIPTED,
  makeModel,
  makeTool,
  typeId,
} from "../../../test/fixtures.ts";
import { BOT_PALETTE } from "./bot-colours.ts";
import {
  type CreateForm,
  createBody,
  emptyForm,
  type FormContext,
  type FormSettings,
  hasInput,
  historyLabel,
  stepOfField,
  stepProblems,
  toolsTurnedOff,
  withModel,
} from "./create-bot-form.ts";

const SETTINGS: FormSettings = {
  limits: { nameMax: 32, descriptionMax: 160, personaMax: 8000 },
  historyMin: BOT_SETTINGS.bot_history_min_pct,
  historyMax: BOT_SETTINGS.bot_history_max_pct,
  defaultHistory: BOT_SETTINGS.bot_default_history_pct,
  defaultRequestLimit: BOT_SETTINGS.bot_default_request_limit,
  defaultMaxReplyChars: BOT_SETTINGS.bot_default_max_reply_chars,
};
const EFFORT = makeModel();
const NO_KEY = makeModel({
  id: "anthropic:claude-haiku-5-5",
  label: "Claude Haiku",
  available: false,
  unavailable_reason: "no_api_key",
  api_key_env: "ANTHROPIC_API_KEY",
});
const MODELS = [EFFORT, FAKE_SCRIPTED, NO_KEY];

function ctx(overrides: Partial<FormContext> = {}): FormContext {
  return {
    settings: SETTINGS,
    models: MODELS,
    botNames: [],
    missingSkillIds: new Set(),
    ...overrides,
  };
}

function filled(overrides: Partial<CreateForm> = {}): CreateForm {
  return {
    ...emptyForm(BOT_PALETTE[0], SETTINGS),
    name: "BA",
    description: "Writes stories.",
    persona_md: "You are the BA.",
    ...overrides,
  };
}

describe("the defaults of a new form", () => {
  it("come from the settings, with no model picked", () => {
    const form = emptyForm(BOT_PALETTE[0], SETTINGS);
    expect(form).toMatchObject({
      history_share_pct: 40,
      request_limit: 30,
      max_reply_chars: 6000,
      model_id: null,
      effort: null,
    });
  });

  it("count as no input, so leaving asks nothing", () => {
    const start = emptyForm(BOT_PALETTE[0], SETTINGS);
    expect(hasInput(start, start)).toBe(false);
    expect(hasInput({ ...start, name: "B" }, start)).toBe(true);
  });
});

describe("the effort (UI-5.1)", () => {
  it("is the model's default effort when a model with efforts is picked", () => {
    expect(withModel(filled(), EFFORT).effort).toBe("medium");
  });

  it("is null for a model with no efforts, so the field goes", () => {
    expect(withModel(filled({ model_id: EFFORT.id, effort: "high" }), FAKE_SCRIPTED).effort).toBe(
      null,
    );
  });

  it("keeps a Clone's effort when the model stays the same", () => {
    expect(withModel(filled({ model_id: EFFORT.id, effort: "high" }), EFFORT).effort).toBe("high");
  });
});

describe("the checks of each step (E1, E2)", () => {
  it("asks for a name and a description on Basics", () => {
    const problems = stepProblems("basics", filled({ name: "", description: "" }), ctx());
    expect(Object.keys(problems).sort()).toEqual(["description", "name"]);
  });

  it("says a name is taken, compared without case and spaces", () => {
    const problems = stepProblems("basics", filled({ name: " ba " }), ctx({ botNames: ["BA"] }));
    expect(problems.name).toBe("ba is taken by another bot. Pick another name.");
  });

  it("asks for an image when the style is Upload with no image", () => {
    const problems = stepProblems("basics", filled({ avatar_style: "upload" }), ctx());
    expect(problems.avatar_id).toBe("Upload an image, or pick Flat.");
  });

  it("asks for a persona on Persona", () => {
    expect(stepProblems("persona", filled({ persona_md: "" }), ctx()).persona_md).toBeDefined();
  });

  it("marks a ticked skill that is in Trash on Skills", () => {
    const skill = typeId("skill", 7);
    const form = filled({
      pins: [{ skill_id: skill, skill_version_id: null, always_load: false }],
    });
    expect(stepProblems("skills", form, ctx({ missingSkillIds: new Set([skill]) }))).toEqual({
      "pins[0]": "This skill is in Trash. Untick it, or restore the skill first.",
    });
  });

  it("asks for a model, refuses one with no key, and one that left the catalog", () => {
    expect(stepProblems("model", filled(), ctx()).model_id).toBe("Pick a model.");
    expect(stepProblems("model", withModel(filled(), NO_KEY), ctx()).model_id).toBe(
      "API key not set: ANTHROPIC_API_KEY. Set it and restart the app, or pick another model.",
    );
    expect(stepProblems("model", filled({ model_id: "google:gone" }), ctx()).model_id).toBe(
      "google:gone is no longer offered. Pick another model.",
    );
  });

  it("checks the history share against the settings, in steps of 5", () => {
    const form = withModel(filled({ history_share_pct: 42 }), EFFORT);
    expect(stepProblems("model", form, ctx()).history_share_pct).toBe(
      "Use a whole number from 10 to 80, in steps of 5.",
    );
    expect(stepProblems("model", { ...form, history_share_pct: 45 }, ctx())).toEqual({});
  });

  it("puts a server error on the step of its field", () => {
    expect(stepOfField("name")).toBe("basics");
    expect(stepOfField("pins[2]")).toBe("skills");
    expect(stepOfField("tool_settings.web_fetch")).toBe("model");
  });
});

describe("the tools", () => {
  const files = makeTool("files");
  const view = makeTool("view_images", { needs: ["files"] });
  const search = makeTool("google_search", {
    kind: "provider",
    provider: "google",
    job: "web_search",
  });
  const tools = [files, view, search];

  it("names the tools a model change turns off (§3.0)", () => {
    const withSearch = makeModel({ provider_tools: ["google_search"] });
    const text = makeModel({ multimodal: false });
    const form = { tool_choices: { google_search: true } };
    expect(toolsTurnedOff(form, tools, withSearch, text)).toEqual(["view_images", "google_search"]);
  });

  it("sends the effective switches of the picked model", () => {
    const form = withModel(filled({ tool_choices: { files: false } }), EFFORT);
    expect(createBody(form, tools, MODELS).tool_settings).toEqual({
      files: false,
      view_images: false,
    });
  });
});

describe("the request body (api.md §4)", () => {
  it("sends the copied skill version and the source of a Clone", () => {
    const skill = typeId("skill", 3);
    const version = typeId("skillv", 2);
    const source = typeId("bot", 9);
    const form = withModel(
      filled({
        pins: [{ skill_id: skill, skill_version_id: version, always_load: true }],
        cloned_from_bot_id: source,
      }),
      EFFORT,
    );
    const body = createBody(form, [], MODELS);
    expect(body.pins).toEqual([{ skill_id: skill, skill_version_id: version, always_load: true }]);
    expect(body.cloned_from_bot_id).toBe(source);
  });

  it("leaves out the version of a new pin, so the server pins the latest", () => {
    const skill = typeId("skill", 3);
    const form = filled({
      pins: [{ skill_id: skill, skill_version_id: null, always_load: false }],
    });
    expect(createBody(form, [], MODELS).pins).toEqual([{ skill_id: skill, always_load: false }]);
  });

  it("sends the image only with the Upload style", () => {
    const avatar = { id: typeId("avatar", 1), url: "/api/avatars/x" };
    expect(createBody(filled({ avatar }), [], MODELS)).not.toHaveProperty("avatar_id");
    expect(createBody(filled({ avatar, avatar_style: "upload" }), [], MODELS).avatar_id).toBe(
      avatar.id,
    );
  });
});

describe("the history label (D32)", () => {
  it("shows the tokens for history and the tokens left for work", () => {
    expect(historyLabel(40, 1_000_000)).toBe("≈ 400k tokens of 1M. 600k are left for work.");
    expect(historyLabel(25, 200_000)).toBe("≈ 50k tokens of 200k. 150k are left for work.");
    expect(historyLabel(40, undefined)).toBeNull();
  });
});
