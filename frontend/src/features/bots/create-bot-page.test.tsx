import { focusManager, onlineManager } from "@tanstack/react-query";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  fakeApi,
  heldAnswer,
  NETWORK_ERROR,
  type RecordedRequest,
} from "../../../test/fake-api.ts";
import {
  BOT_SETTINGS,
  FAKE_SCRIPTED,
  makeBot,
  makeModel,
  makePin,
  makeSkill,
  makeTool,
  typeId,
  versionId,
} from "../../../test/fixtures.ts";
import { renderApp } from "../../../test/render-app.tsx";
import { BOT_QUERIES, SETTINGS_QUERIES } from "../../lib/api/operation-queries.ts";

// Create with an Idempotency-Key (create-bot-page.md E3, E5; api.md §4): when the outcome is
// not known, Try again sends the same request with the same key, so a retry never makes two
// bots; after an answer, the next Create is a new request with a new key.
type Answer = { status: number; body: unknown } | typeof NETWORK_ERROR;

function api(answers: Answer[]) {
  let call = 0;
  return fakeApi({
    "GET /api/settings": () => ({ body: BOT_SETTINGS }),
    "GET /api/models": () => ({ body: [makeModel(), FAKE_SCRIPTED] }),
    "GET /api/tools": () => ({ body: [] }),
    "GET /api/skills": () => ({ body: [] }),
    "GET /api/bots": () => ({ body: [] }),
    "POST /api/bots": () => {
      const answer = answers[call] ?? answers[answers.length - 1];
      call += 1;
      return answer;
    },
  });
}

function click(element: HTMLElement) {
  act(() => {
    fireEvent.click(element);
  });
}

function type(label: string, text: string) {
  act(() => {
    fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value: text } });
  });
}

async function fillToModelStep(name = "BA") {
  type("Name", name);
  type("Description", "Writes stories.");
  click(screen.getByRole("button", { name: "Next" }));
  type("Persona", "You are the BA.");
  click(screen.getByRole("button", { name: "Next" }));
  click(await screen.findByRole("button", { name: "Next" }));
  const model = await screen.findByLabelText("Model", { exact: true });
  act(() => {
    fireEvent.change(model, { target: { value: FAKE_SCRIPTED.id } });
  });
}

const keyOf = (request: RecordedRequest | undefined) => request?.headers.get("idempotency-key");

describe("Create on the Create bot page", () => {
  let fake: ReturnType<typeof api> | null = null;
  afterEach(() => {
    fake?.restore();
    fake = null;
  });

  it("retries an unknown outcome with the same key and body (E5)", async () => {
    fake = api([NETWORK_ERROR, { status: 201, body: makeBot(1, "BA") }]);
    await renderApp("/bots/new");
    await screen.findByRole("heading", { name: "New bot" }, { timeout: 5000 });
    await fillToModelStep();
    click(screen.getByRole("button", { name: "Create" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(
      "Could not confirm whether the bot was created. Your input is kept.",
    );
    // The form is read-only while the outcome is not known.
    expect(screen.getByRole("button", { name: "Create" }).getAttribute("aria-disabled")).toBe(
      "true",
    );
    click(within(alert).getByRole("button", { name: "Try again" }));
    await waitFor(() => {
      expect(fake?.sent("POST", "/api/bots")).toHaveLength(2);
    });
    const [first, second] = fake.sent("POST", "/api/bots");
    expect(keyOf(first)).toBeTruthy();
    expect(keyOf(second)).toBe(keyOf(first));
    expect(second?.body).toEqual(first?.body);
    expect(await screen.findByText("Created BA ✨")).toBeTruthy();
  });

  it("keeps the page while the outcome is not known: Back does nothing (UI-5.6)", async () => {
    fake = api([NETWORK_ERROR]);
    await renderApp("/bots/new");
    await screen.findByRole("heading", { name: "New bot" }, { timeout: 5000 });
    await fillToModelStep();
    click(screen.getByRole("button", { name: "Create" }));
    await screen.findByRole("alert");
    // The Back link at the top of the page (the step buttons have their own Back).
    const [back] = screen.getAllByRole("button", { name: "Back" });
    if (back === undefined) throw new Error("no Back");
    expect(back.getAttribute("aria-disabled")).toBe("true");
    click(back);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(screen.getByRole("heading", { name: "New bot" })).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("sends one request for a double click on Create (UI-5.6)", async () => {
    fake = api([{ status: 201, body: makeBot(1, "BA") }]);
    await renderApp("/bots/new");
    await screen.findByRole("heading", { name: "New bot" }, { timeout: 5000 });
    await fillToModelStep();
    const create = screen.getByRole("button", { name: "Create" });
    act(() => {
      fireEvent.click(create);
      fireEvent.click(create);
    });
    expect(await screen.findByText("Created BA ✨")).toBeTruthy();
    expect(fake.sent("POST", "/api/bots")).toHaveLength(1);
  });

  it("shows a taken name on Basics and sends the next Create with a new key (E1, E3)", async () => {
    fake = api([
      {
        status: 409,
        body: { error: { code: "name_taken", message: "The name is taken.", field: "name" } },
      },
      { status: 201, body: makeBot(2, "QA") },
    ]);
    await renderApp("/bots/new");
    await screen.findByRole("heading", { name: "New bot" }, { timeout: 5000 });
    await fillToModelStep();
    click(screen.getByRole("button", { name: "Create" }));
    // The error belongs to Name, on step 1: the stepper marks it.
    expect(
      await screen.findByRole("button", { name: /Basics, has an error/ }, { timeout: 5000 }),
    ).toBeTruthy();
    click(
      within(screen.getByRole("list", { name: "Steps" })).getByRole("button", { name: /Basics/ }),
    );
    expect(
      await screen.findByText("BA is taken by another bot, maybe one in Trash. Pick another name."),
    ).toBeTruthy();
    type("Name", "QA");
    click(
      within(screen.getByRole("list", { name: "Steps" })).getByRole("button", { name: /Model/ }),
    );
    click(await screen.findByRole("button", { name: "Create" }));
    await waitFor(() => {
      expect(fake?.sent("POST", "/api/bots")).toHaveLength(2);
    });
    const [first, second] = fake.sent("POST", "/api/bots");
    expect(keyOf(second)).not.toBe(keyOf(first));
    expect(second?.body).toMatchObject({ name: "QA" });
  });
});

// Skills on step 3 (create-bot-page.md §3, §6): a Clone keeps its copied pins, deprecated ones
// too, with their versions; a ticked skill that another tab deletes can still be unticked.
const OLD = makeSkill({
  id: typeId("skill", 1),
  name: "Old skill",
  deprecated: true,
  deprecated_at: "2026-10-25T10:00:00.000Z",
});
const NEW = makeSkill({ id: typeId("skill", 2), slug: "new-skill", name: "New skill" });
const SOURCE = makeBot(9, "Source", [
  makePin({
    skill_id: OLD.id,
    skill_name: OLD.name,
    skill_version_id: versionId(1),
    version: 1,
    always_load: true,
    deprecated: true,
  }),
]);
const TEMPLATE = {
  name: "Source (copy)",
  description: SOURCE.description,
  persona_md: SOURCE.persona_md,
  avatar_style: "flat",
  model_id: FAKE_SCRIPTED.id,
  effort: null,
  history_share_pct: 50,
  request_limit: 10,
  max_reply_chars: 8000,
  tool_settings: {},
  pins: [{ skill_id: OLD.id, skill_version_id: versionId(1), always_load: true }],
  copied_pins: SOURCE.pins,
  cloned_from_bot_id: SOURCE.id,
};

// GET /skills hides deprecated skills unless the page asks for them, as the server does. The
// test changes `skills.list` to stand for a change made in another tab.
function skillsApi(skills = { list: [OLD, NEW] }, source = { bot: SOURCE }) {
  return fakeApi({
    "GET /api/settings": () => ({ body: BOT_SETTINGS }),
    "GET /api/models": () => ({ body: [makeModel(), FAKE_SCRIPTED] }),
    "GET /api/tools": () => ({ body: [] }),
    "GET /api/skills": (_request, search) => {
      const all = search.get("include_deprecated") === "true";
      return { body: skills.list.filter((skill) => all || !skill.deprecated) };
    },
    "GET /api/bots": () => ({ body: [source.bot] }),
    [`GET /api/bots/${SOURCE.id}/clone-template`]: () => ({ body: TEMPLATE }),
    "POST /api/bots": () => ({ status: 201, body: makeBot(10, "Source (copy)") }),
  });
}

const rowOf = (skillId: string) => {
  const row = document.querySelector(`li[data-skill="${skillId}"]`);
  if (!(row instanceof HTMLElement)) throw new Error(`no row for ${skillId}`);
  return row;
};
const openStep = (name: RegExp) => {
  click(within(screen.getByRole("list", { name: "Steps" })).getByRole("button", { name }));
};

describe("skills on the Create bot page", () => {
  let fake: ReturnType<typeof skillsApi> | null = null;
  afterEach(() => {
    fake?.restore();
    fake = null;
    focusManager.setFocused(undefined);
  });

  it("creates a Clone with its deprecated pin at the copied version (§6)", async () => {
    fake = skillsApi();
    await renderApp(`/bots/new?from=${SOURCE.id}`);
    click(await screen.findByRole("button", { name: "Create" }, { timeout: 5000 }));
    await waitFor(() => {
      expect(fake?.sent("POST", "/api/bots")).toHaveLength(1);
    });
    expect(fake.sent("POST", "/api/bots")[0]?.body).toMatchObject({
      pins: [{ skill_id: OLD.id, skill_version_id: versionId(1), always_load: true }],
    });
    // `copied_pins` is display data: Create leaves it out (api.md, clone-template).
    expect(fake.sent("POST", "/api/bots")[0]?.body).not.toHaveProperty("copied_pins");
  });

  it("gives a copied pin back its version when it is unticked and ticked again", async () => {
    fake = skillsApi();
    await renderApp(`/bots/new?from=${SOURCE.id}`);
    await screen.findByRole("button", { name: "Create" }, { timeout: 5000 });
    openStep(/Skills/);
    const box = () => within(rowOf(OLD.id)).getByRole("checkbox");
    click(box());
    click(box());
    openStep(/Model/);
    click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => {
      expect(fake?.sent("POST", "/api/bots")).toHaveLength(1);
    });
    expect(fake.sent("POST", "/api/bots")[0]?.body).toMatchObject({
      pins: [{ skill_id: OLD.id, skill_version_id: versionId(1), always_load: true }],
    });
  });

  it("shows the copied version while another tab upgrades the source bot", async () => {
    const source = { bot: SOURCE };
    fake = skillsApi(undefined, source);
    await renderApp(`/bots/new?from=${SOURCE.id}`);
    await screen.findByRole("button", { name: "Create" }, { timeout: 5000 });
    expect(screen.getByText(`${OLD.name} v1 (always load)`)).toBeTruthy();
    // Another tab moves the source bot to v2; the bot list comes again.
    const before = fake.sent("GET", "/api/bots").length;
    source.bot = makeBot(9, "Source", [
      makePin({
        skill_id: OLD.id,
        skill_name: OLD.name,
        skill_version_id: versionId(2),
        version: 2,
        always_load: true,
        deprecated: true,
      }),
    ]);
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await waitFor(() => {
      expect(fake?.sent("GET", "/api/bots").length).toBeGreaterThan(before);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(screen.getByText(`${OLD.name} v1 (always load)`)).toBeTruthy();
    expect(screen.queryByText(`${OLD.name} v2 (always load)`)).toBeNull();
    openStep(/Skills/);
    expect(within(rowOf(OLD.id)).getByText("v1")).toBeTruthy();
    openStep(/Model/);
    click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => {
      expect(fake?.sent("POST", "/api/bots")).toHaveLength(1);
    });
    expect(fake.sent("POST", "/api/bots")[0]?.body).toMatchObject({
      pins: [{ skill_id: OLD.id, skill_version_id: versionId(1), always_load: true }],
    });
  });

  // The source bot at v2, while the template (read a moment before) copied v1.
  const sourceAtV2 = () =>
    makeBot(9, "Source", [
      makePin({
        skill_id: OLD.id,
        skill_name: OLD.name,
        skill_version_id: versionId(2),
        version: 2,
        always_load: true,
        deprecated: true,
      }),
    ]);

  it("shows the copied version when the bot list already has another one (§3)", async () => {
    fake = skillsApi(undefined, { bot: sourceAtV2() });
    await renderApp(`/bots/new?from=${SOURCE.id}`);
    await screen.findByRole("button", { name: "Create" }, { timeout: 5000 });
    expect(screen.getByText(`${OLD.name} v1 (always load)`)).toBeTruthy();
    openStep(/Skills/);
    expect(within(rowOf(OLD.id)).getByText("v1")).toBeTruthy();
  });

  it("keeps the copied versions with the form when the template comes again (§3)", async () => {
    // The template answers v1 first; another tab then moves the source bot to v2, so a later
    // template answer names v2 in both `pins` and `copied_pins`.
    const atV2 = sourceAtV2();
    let template: typeof TEMPLATE = TEMPLATE;
    fake = fakeApi({
      "GET /api/settings": () => ({ body: BOT_SETTINGS }),
      "GET /api/models": () => ({ body: [makeModel(), FAKE_SCRIPTED] }),
      "GET /api/tools": () => ({ body: [] }),
      "GET /api/skills": () => ({ body: [OLD, NEW] }),
      "GET /api/bots": () => ({ body: [SOURCE] }),
      [`GET /api/bots/${SOURCE.id}/clone-template`]: () => ({ body: template }),
      "POST /api/bots": () => ({ status: 201, body: makeBot(10, "Source (copy)") }),
    });
    await renderApp(`/bots/new?from=${SOURCE.id}`);
    await screen.findByRole("button", { name: "Create" }, { timeout: 5000 });
    expect(screen.getByText(`${OLD.name} v1 (always load)`)).toBeTruthy();
    const before = fake.sent("GET", `/api/bots/${SOURCE.id}/clone-template`).length;
    template = {
      ...TEMPLATE,
      pins: [{ skill_id: OLD.id, skill_version_id: versionId(2), always_load: true }],
      copied_pins: atV2.pins,
    };
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await waitFor(() => {
      expect(fake?.sent("GET", `/api/bots/${SOURCE.id}/clone-template`).length).toBeGreaterThan(
        before,
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    // The form still holds v1, so the page still shows v1 and Create sends v1.
    expect(screen.getByText(`${OLD.name} v1 (always load)`)).toBeTruthy();
    openStep(/Skills/);
    expect(within(rowOf(OLD.id)).getByText("v1")).toBeTruthy();
    openStep(/Model/);
    click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => {
      expect(fake?.sent("POST", "/api/bots")).toHaveLength(1);
    });
    expect(fake.sent("POST", "/api/bots")[0]?.body).toMatchObject({
      pins: [{ skill_id: OLD.id, skill_version_id: versionId(1), always_load: true }],
    });
  });

  it("shows each Clone's own copied versions when the page moves to another source", async () => {
    // A second source bot pins the same skill at v2; its template copies v2.
    const other = makeBot(11, "Other", [
      makePin({
        skill_id: OLD.id,
        skill_name: OLD.name,
        skill_version_id: versionId(2),
        version: 2,
        always_load: false,
        deprecated: true,
      }),
    ]);
    fake = fakeApi({
      "GET /api/settings": () => ({ body: BOT_SETTINGS }),
      "GET /api/models": () => ({ body: [makeModel(), FAKE_SCRIPTED] }),
      "GET /api/tools": () => ({ body: [] }),
      "GET /api/skills": () => ({ body: [OLD, NEW] }),
      "GET /api/bots": () => ({ body: [SOURCE, other] }),
      [`GET /api/bots/${SOURCE.id}/clone-template`]: () => ({ body: TEMPLATE }),
      [`GET /api/bots/${other.id}/clone-template`]: () => ({
        body: {
          ...TEMPLATE,
          name: "Other (copy)",
          pins: [{ skill_id: OLD.id, skill_version_id: versionId(2), always_load: false }],
          copied_pins: other.pins,
          cloned_from_bot_id: other.id,
        },
      }),
      "POST /api/bots": () => ({ status: 201, body: makeBot(10, "Other (copy)") }),
    });
    const { router } = await renderApp(`/bots/new?from=${SOURCE.id}`);
    await screen.findByRole("button", { name: "Create" }, { timeout: 5000 });
    openStep(/Skills/);
    expect(within(rowOf(OLD.id)).getByText("v1")).toBeTruthy();
    await act(() => router.navigate({ to: "/bots/new", search: { from: other.id } }));
    await waitFor(() => {
      expect(screen.getByText("Step 4 of 4.", { exact: false })).toBeTruthy();
    });
    openStep(/Skills/);
    expect(within(rowOf(OLD.id)).getByText("v2")).toBeTruthy();
    expect(within(rowOf(OLD.id)).queryByText("v1")).toBeNull();
    openStep(/Model/);
    click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => {
      expect(fake?.sent("POST", "/api/bots")).toHaveLength(1);
    });
    expect(fake.sent("POST", "/api/bots")[0]?.body).toMatchObject({
      name: "Other (copy)",
      pins: [{ skill_id: OLD.id, skill_version_id: versionId(2), always_load: false }],
    });
  });

  it("goes back from Model when an earlier step has an error, but not forward (§1)", async () => {
    // The clone name is already taken: Basics has an error while the Clone opens on Model.
    fake = fakeApi({
      "GET /api/settings": () => ({ body: BOT_SETTINGS }),
      "GET /api/models": () => ({ body: [makeModel(), FAKE_SCRIPTED] }),
      "GET /api/tools": () => ({ body: [] }),
      "GET /api/skills": () => ({ body: [OLD, NEW] }),
      "GET /api/bots": () => ({ body: [SOURCE, makeBot(12, TEMPLATE.name)] }),
      [`GET /api/bots/${SOURCE.id}/clone-template`]: () => ({ body: TEMPLATE }),
    });
    await renderApp(`/bots/new?from=${SOURCE.id}`);
    await screen.findByRole("button", { name: "Create" }, { timeout: 5000 });
    // The footer's Back (the page top has ← Back too).
    const footer = screen.getByText("Step 4 of 4.", { exact: false }).parentElement;
    if (footer === null) throw new Error("no footer");
    click(within(footer).getByRole("button", { name: "Back" }));
    expect(screen.getByText("Step 3 of 4.", { exact: false })).toBeTruthy();
    openStep(/Basics/);
    expect(screen.getByText("Step 1 of 4.", { exact: false })).toBeTruthy();
    // Forward stays closed while Basics has the error.
    const steps = within(screen.getByRole("list", { name: "Steps" }));
    expect(steps.getByRole("button", { name: /Model/ }).getAttribute("aria-disabled")).toBe("true");
    openStep(/Model/);
    expect(screen.getByText("Step 1 of 4.", { exact: false })).toBeTruthy();
  });

  it("shows a copied model with no API key as an error at once (§6)", async () => {
    const noKey = makeModel({
      id: "anthropic:claude-haiku-5-5",
      label: "Claude Haiku",
      available: false,
      unavailable_reason: "no_api_key",
      api_key_env: "ANTHROPIC_API_KEY",
    });
    fake = fakeApi({
      "GET /api/settings": () => ({ body: BOT_SETTINGS }),
      "GET /api/models": () => ({ body: [noKey, FAKE_SCRIPTED] }),
      "GET /api/tools": () => ({ body: [] }),
      "GET /api/skills": () => ({ body: [OLD, NEW] }),
      "GET /api/bots": () => ({ body: [SOURCE] }),
      [`GET /api/bots/${SOURCE.id}/clone-template`]: () => ({
        body: { ...TEMPLATE, model_id: noKey.id },
      }),
    });
    await renderApp(`/bots/new?from=${SOURCE.id}`);
    expect(
      await screen.findByText(
        "API key not set: ANTHROPIC_API_KEY. Set it and restart the app, or pick another model.",
        { exact: false },
        { timeout: 5000 },
      ),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /Model, has an error/ })).toBeTruthy();
  });

  it("keeps a ticked skill that another tab deleted, so it can be unticked (D49)", async () => {
    const skills = { list: [NEW] };
    fake = skillsApi(skills);
    await renderApp("/bots/new");
    await screen.findByRole("heading", { name: "New bot" }, { timeout: 5000 });
    type("Name", "BA");
    type("Description", "Writes stories.");
    click(screen.getByRole("button", { name: "Next" }));
    type("Persona", "You are the BA.");
    click(screen.getByRole("button", { name: "Next" }));
    const box = () => within(rowOf(NEW.id)).getByRole("checkbox");
    click(await waitFor(box));
    // The skill goes to Trash in another tab; the list comes again without it.
    const before = fake.sent("GET", "/api/skills").length;
    skills.list = [];
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await waitFor(() => {
      expect(fake?.sent("GET", "/api/skills").length).toBeGreaterThan(before);
    });
    // Next keeps the owner on the step and says why.
    click(screen.getByRole("button", { name: "Next" }));
    expect(await within(rowOf(NEW.id)).findByText(/This skill is in Trash/)).toBeTruthy();
    // Its version number is gone with it: the row and the preview say so (owner, 2026-11-02).
    expect(within(rowOf(NEW.id)).getByText("Version number unavailable")).toBeTruthy();
    expect(screen.getByText("A skill in Trash (version number unavailable)")).toBeTruthy();
    expect(box().getAttribute("aria-checked")).toBe("true");
    click(box());
    // Unticked, a skill in Trash leaves the list, and its problem with it.
    expect(document.querySelector(`li[data-skill="${NEW.id}"]`)).toBeNull();
    expect(screen.getByText("0 ticked")).toBeTruthy();
    click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByLabelText("Model", { exact: true })).toBeTruthy();
  });
});

// An image the browser cannot decode (bot-avatar.md §6, create-bot-page.md "Texts added in the
// M2b build"): the crop card closes and the page says so, instead of waiting for ever.
describe("a broken image on the Create bot page", () => {
  let fake: ReturnType<typeof fakeApi> | null = null;
  afterEach(() => {
    fake?.restore();
    fake = null;
  });

  it("closes the crop card and shows the error when the image does not load", async () => {
    fake = fakeApi({
      "GET /api/settings": () => ({ body: BOT_SETTINGS }),
      "GET /api/models": () => ({ body: [FAKE_SCRIPTED] }),
      "GET /api/tools": () => ({ body: [] }),
      "GET /api/skills": () => ({ body: [] }),
      "GET /api/bots": () => ({ body: [] }),
      "GET /api/avatars/limits": () => ({
        body: { accepted_types: ["image/png", "image/jpeg", "image/webp"], max_bytes: 2_000_000 },
      }),
    });
    await renderApp("/bots/new");
    await screen.findByRole("heading", { name: "New bot" }, { timeout: 5000 });
    const input = screen.getByLabelText("Upload image", { selector: "input" });
    const file = new File(["not a png"], "broken.png", { type: "image/png" });
    act(() => {
      fireEvent.change(input, { target: { files: [file] } });
    });
    const crop = await screen.findByRole("dialog", { name: "Crop the image" });
    const image = crop.querySelector("img");
    if (image === null) throw new Error("no image");
    act(() => {
      fireEvent.error(image);
    });
    expect(
      await screen.findByText("The app could not read the image. Try another file."),
    ).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Crop the image" })).toBeNull();
    });
  });
});

// The page's size check needs `GET /avatars/limits` (bot-avatar.md §6 AV4, security.md §2.4): the
// server gets only the cropped square, so a file must never pass without the limits.
describe("the avatar limits on the Create bot page", () => {
  let fake: ReturnType<typeof fakeApi> | null = null;
  afterEach(() => {
    fake?.restore();
    fake = null;
  });
  const LIMITS = { accepted_types: ["image/png", "image/jpeg", "image/webp"], max_bytes: 10 };
  const BIG = () => new File(["more than ten bytes"], "big.png", { type: "image/png" });
  const SMALL = () => new File(["tiny"], "small.png", { type: "image/png" });
  const pageApi = (limits: () => Answer | Promise<Answer>) =>
    fakeApi({
      "GET /api/settings": () => ({ body: BOT_SETTINGS }),
      "GET /api/models": () => ({ body: [FAKE_SCRIPTED] }),
      "GET /api/tools": () => ({ body: [] }),
      "GET /api/skills": () => ({ body: [] }),
      "GET /api/bots": () => ({ body: [] }),
      "GET /api/avatars/limits": limits,
    });
  const pick = (file: File) => {
    act(() => {
      fireEvent.change(screen.getByLabelText("Upload image", { selector: "input" }), {
        target: { files: [file] },
      });
    });
  };

  it("holds a file until the limits come, then checks its size", async () => {
    let answer: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      answer = resolve;
    });
    fake = pageApi(async () => {
      await held;
      return { status: 200, body: LIMITS };
    });
    await renderApp("/bots/new");
    await screen.findByRole("heading", { name: "New bot" }, { timeout: 5000 });
    pick(BIG());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(screen.queryByRole("dialog", { name: "Crop the image" })).toBeNull();
    await act(async () => {
      answer();
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(await screen.findByText("The image is 0 MB. The limit is 0 MB.")).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: "Crop the image" })).toBeNull();
  });

  it("refuses a file while the limits cannot load, and asks again on the next file", async () => {
    let calls = 0;
    fake = pageApi(() => {
      calls += 1;
      return calls <= 2
        ? { status: 500, body: { error: { code: "internal_error", message: "x" } } }
        : { status: 200, body: LIMITS };
    });
    await renderApp("/bots/new");
    await screen.findByRole("heading", { name: "New bot" }, { timeout: 5000 });
    await waitFor(() => {
      expect(calls).toBe(1);
    });
    // The page asks again (2nd call, fails too): the file does not pass.
    pick(BIG());
    expect(
      await screen.findByText("The app could not check the image size. Upload the image again."),
    ).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: "Crop the image" })).toBeNull();
    // The next file asks again; the limits come and the size check runs.
    pick(BIG());
    expect(await screen.findByText("The image is 0 MB. The limit is 0 MB.")).toBeTruthy();
    expect(calls).toBe(3);
    expect(screen.queryByRole("dialog", { name: "Crop the image" })).toBeNull();
    pick(SMALL());
    expect(await screen.findByRole("dialog", { name: "Crop the image" })).toBeTruthy();
  });
});

// A form that fills once waits for a read from this visit (create-bot-page.md §5, §6): the Advanced
// defaults of a new bot come from the settings as they are now, not from the cache.
describe("the first load of the Create page", () => {
  const ANSWERS = {
    "/api/settings": BOT_SETTINGS,
    "/api/models": [makeModel(), FAKE_SCRIPTED],
    "/api/tools": [],
    "/api/skills": [],
    "/api/bots": [],
  };
  const READS = ["/api/settings", "/api/models", "/api/tools", "/api/skills", "/api/bots"] as const;
  const TEXT = "The app could not load what the Create page needs.";
  let fake: ReturnType<typeof fakeApi> | null = null;
  afterEach(() => {
    fake?.restore();
    fake = null;
  });
  type Routes = Parameters<typeof fakeApi>[0];
  function start(routes: Routes) {
    fake = fakeApi({
      "GET /api/settings": () => ({ body: ANSWERS["/api/settings"] }),
      "GET /api/models": () => ({ body: ANSWERS["/api/models"] }),
      "GET /api/tools": () => ({ body: [] }),
      "GET /api/skills": () => ({ body: [] }),
      "GET /api/bots": () => ({ body: [] }),
      ...routes,
    });
    return renderApp("/bots/new");
  }
  const form = () => screen.findByRole("heading", { name: "New bot" }, { timeout: 5000 });

  it.each(READS)("shows no form until %s answers", async (read) => {
    const held = heldAnswer();
    await start({ [`GET ${read}`]: () => held.promise });
    await waitFor(() => {
      expect(fake?.sent("GET", read)).toHaveLength(1);
    });
    expect(screen.queryByRole("heading", { name: "New bot" })).toBeNull();
    await held.answer({ body: ANSWERS[read] });
    expect(await form()).toBeTruthy();
  });

  it.each(READS)(
    "says the load failed when %s fails, and Try again opens the form",
    async (read) => {
      let failing = true;
      await start({
        [`GET ${read}`]: () =>
          failing
            ? { status: 500, body: { error: { code: "internal_error", message: "Failed." } } }
            : { body: ANSWERS[read] },
      });
      expect(await screen.findByText(TEXT, {}, { timeout: 5000 })).toBeTruthy();
      failing = false;
      click(screen.getByRole("button", { name: "Try again" }));
      expect(await form()).toBeTruthy();
      expect(screen.queryByText(TEXT)).toBeNull();
    },
  );

  it("an empty catalog opens the form, and Create stays off", async () => {
    await start({ "GET /api/models": () => ({ body: [] }) });
    await form();
    type("Name", "BA");
    type("Description", "Writes stories.");
    click(screen.getByRole("button", { name: "Next" }));
    type("Persona", "You are the BA.");
    click(screen.getByRole("button", { name: "Next" }));
    click(await screen.findByRole("button", { name: "Next" }));
    const model = await screen.findByLabelText("Model", { exact: true });
    expect(within(model).queryByRole("option", { name: new RegExp(FAKE_SCRIPTED.id) })).toBeNull();
    const create = screen.getByRole("button", { name: "Create" });
    expect(create.hasAttribute("disabled") || create.getAttribute("aria-disabled") === "true").toBe(
      true,
    );
  });
});

describe("the defaults of a new bot", () => {
  const OLD_LIMIT = BOT_SETTINGS.bot_default_request_limit;
  const NEW_LIMIT = OLD_LIMIT + 7;
  const FAILED = {
    status: 500,
    body: { error: { code: "internal_error", message: "Failed." } },
  };
  let fake: ReturnType<typeof fakeApi> | null = null;
  afterEach(() => {
    fake?.restore();
    fake = null;
  });
  type Settings = Parameters<typeof fakeApi>[0][string];

  function start(settings: Settings) {
    fake = fakeApi({
      "GET /api/settings": settings,
      "GET /api/models": () => ({ body: [makeModel(), FAKE_SCRIPTED] }),
      "GET /api/tools": () => ({ body: [] }),
      "GET /api/skills": () => ({ body: [] }),
      "GET /api/bots": () => ({ body: [] }),
    });
    return renderApp("/bots/new");
  }
  type Router = Awaited<ReturnType<typeof start>>["router"];
  const form = () => screen.findByRole("heading", { name: "New bot" }, { timeout: 5000 });
  // A page with no settings on it, so the cached settings wait with no refresh.
  const leave = (router: Router) => act(() => router.navigate({ to: "/" }));
  const back = (router: Router) => act(() => router.navigate({ to: "/bots/new" }));
  const limitOnForm = async () => {
    await fillToModelStep();
    const field = await screen.findByLabelText("Model requests per run", { exact: true });
    if (!(field instanceof HTMLInputElement)) throw new Error("no number field");
    return field.value;
  };

  it("takes the newest default when the settings changed since the last visit", async () => {
    let limit = OLD_LIMIT;
    const { router } = await start(() => ({
      body: { ...BOT_SETTINGS, bot_default_request_limit: limit },
    }));
    await form();
    await leave(router);
    limit = NEW_LIMIT;
    await back(router);
    await form();
    expect(await limitOnForm()).toBe(String(NEW_LIMIT));
  });

  it("shows the skeleton until the read of this visit answers", async () => {
    const held = heldAnswer();
    let read: Settings = () => ({ body: BOT_SETTINGS });
    const { router } = await start((...args) => read(...args));
    await form();
    await leave(router);
    read = () => held.promise;
    await back(router);
    await waitFor(() => {
      expect(fake?.sent("GET", "/api/settings")).toHaveLength(2);
    });
    expect(screen.queryByRole("heading", { name: "New bot" })).toBeNull();
    await held.answer({ body: { ...BOT_SETTINGS, bot_default_request_limit: NEW_LIMIT } });
    await form();
    expect(await limitOnForm()).toBe(String(NEW_LIMIT));
  });

  it("opens with the last values when the read of this visit fails", async () => {
    let read: Settings = () => ({ body: BOT_SETTINGS });
    const { router } = await start((...args) => read(...args));
    await form();
    await leave(router);
    read = () => FAILED;
    await back(router);
    await form();
    expect(await limitOnForm()).toBe(String(OLD_LIMIT));
  });

  it("opens at the first failed try, and does not wait for the retries", async () => {
    let read: Settings = () => ({ body: BOT_SETTINGS });
    const { router, queryClient } = await start((...args) => read(...args));
    await form();
    await leave(router);
    read = () => FAILED;
    // The app's own client retries. The next try is far away, so only the first try can open it.
    queryClient.setDefaultOptions({ queries: { retry: 3, retryDelay: 60_000 } });
    await back(router);
    await form();
    expect(await limitOnForm()).toBe(String(OLD_LIMIT));
  });

  // The app runs on 127.0.0.1: a laptop with no internet still reaches it.
  it("opens when the browser says it is offline", async () => {
    let limit = OLD_LIMIT;
    const { router } = await start(() => ({
      body: { ...BOT_SETTINGS, bot_default_request_limit: limit },
    }));
    await form();
    await leave(router);
    limit = NEW_LIMIT;
    onlineManager.setOnline(false);
    try {
      await back(router);
      await form();
      expect(await limitOnForm()).toBe(String(NEW_LIMIT));
    } finally {
      onlineManager.setOnline(true);
    }
  });

  it("keeps the form and its text while the settings load again and after they answer", async () => {
    const held = heldAnswer();
    let read: Settings = () => ({ body: BOT_SETTINGS });
    await start((...args) => read(...args));
    await form();
    type("Name", "Kept");
    read = () => held.promise;
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await waitFor(() => {
      expect(fake?.sent("GET", "/api/settings")).toHaveLength(2);
    });
    // Time for a skeleton to replace the form, if the page waited for this load.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(screen.getByLabelText<HTMLInputElement>("Name", { exact: true }).value).toBe("Kept");
    await held.answer({ body: { ...BOT_SETTINGS, bot_default_request_limit: NEW_LIMIT } });
    expect(screen.getByLabelText<HTMLInputElement>("Name", { exact: true }).value).toBe("Kept");
    act(() => {
      focusManager.setFocused(undefined);
    });
  });
});

// A second Clone starts from the source bot as it is now (create-bot-page.md §6; audit row 2). A
// cached template must not fill the form, because the form takes its first answer and keeps it.
describe("a second Clone of a bot", () => {
  const TEMPLATE_PATH = `/api/bots/${SOURCE.id}/clone-template`;
  const NEW_PIN = makePin({
    skill_id: NEW.id,
    skill_name: NEW.name,
    skill_version_id: versionId(2),
    version: 2,
  });
  // What the source bot is after another tab changed it.
  const CHANGED = {
    ...TEMPLATE,
    persona_md: "The new persona.",
    tool_settings: { read_file: false },
    pins: [{ skill_id: NEW.id, skill_version_id: versionId(2), always_load: false }],
    copied_pins: [NEW_PIN],
  };
  const FAILED = {
    status: 500,
    body: { error: { code: "internal_error", message: "Failed." } },
  };
  type Routes = Parameters<typeof fakeApi>[0];
  type Handler = Routes[string];

  let fake: ReturnType<typeof fakeApi> | null = null;
  afterEach(() => {
    fake?.restore();
    fake = null;
    act(() => {
      focusManager.setFocused(undefined);
    });
  });

  // Each read of the template takes the next answer, so a test sets the order of the answers.
  function inOrder(...answers: Handler[]): Handler {
    return (...args) => {
      const next = answers.shift();
      if (next === undefined) throw new Error("no answer left for this read");
      return next(...args);
    };
  }

  function start(template: Handler, routes: Routes = {}) {
    fake = fakeApi({
      "GET /api/settings": () => ({ body: BOT_SETTINGS }),
      "GET /api/models": () => ({ body: [makeModel(), FAKE_SCRIPTED] }),
      "GET /api/tools": () => ({ body: [makeTool("read_file", { label: "Read files" })] }),
      "GET /api/skills": () => ({ body: [OLD, NEW] }),
      "GET /api/bots": () => ({ body: [SOURCE] }),
      [`GET ${TEMPLATE_PATH}`]: template,
      "POST /api/bots": () => ({ status: 201, body: makeBot(10, "Source (copy)") }),
      ...routes,
    });
    return renderApp(`/bots/new?from=${SOURCE.id}`);
  }
  type Router = Awaited<ReturnType<typeof start>>["router"];

  const cloneBanner = () => screen.findByText("Cloning Source", {}, { timeout: 5000 });
  const reads = () => fake?.sent("GET", TEMPLATE_PATH).length;
  const waitForReads = (count: number) =>
    waitFor(() => {
      expect(reads()).toBe(count);
    });
  const leave = async (router: Router) => {
    await act(() => router.navigate({ to: "/bots" }));
    await screen.findByPlaceholderText(/Search/, {}, { timeout: 5000 });
  };
  const cloneAgain = (router: Router) =>
    act(() => router.navigate({ to: "/bots/new", search: { from: SOURCE.id } }));
  const personaStepText = () => {
    openStep(/Persona/);
    return document.getElementById("create-form")?.textContent;
  };
  const createdBody = async () => {
    openStep(/Model/);
    click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => {
      expect(fake?.sent("POST", "/api/bots")).toHaveLength(1);
    });
    return fake?.sent("POST", "/api/bots")[0]?.body;
  };

  it("sends the source bot's new persona, tools and pins, not the first answer's", async () => {
    const { router } = await start(
      inOrder(
        () => ({ body: TEMPLATE }),
        () => ({ body: CHANGED }),
      ),
    );
    await cloneBanner();
    await leave(router);
    await cloneAgain(router);
    await cloneBanner();
    expect(personaStepText()).toContain("The new persona.");
    expect(await createdBody()).toMatchObject({
      persona_md: "The new persona.",
      tool_settings: { read_file: false },
      pins: [{ skill_id: NEW.id, skill_version_id: versionId(2), always_load: false }],
    });
  });

  it("shows the skeleton, not the old form, until the new answer comes", async () => {
    const held = heldAnswer();
    const { router } = await start(
      inOrder(
        () => ({ body: TEMPLATE }),
        () => held.promise,
      ),
    );
    await cloneBanner();
    await leave(router);
    await cloneAgain(router);
    await waitForReads(2);
    expect(screen.queryByText("Cloning Source")).toBeNull();
    expect(screen.queryByRole("button", { name: "Create" })).toBeNull();
    await held.answer({ body: CHANGED });
    await cloneBanner();
    expect(personaStepText()).toContain("The new persona.");
  });

  it("opens when the browser says it is offline", async () => {
    const { router } = await start(
      inOrder(
        () => ({ body: TEMPLATE }),
        () => ({ body: CHANGED }),
      ),
    );
    await cloneBanner();
    await leave(router);
    onlineManager.setOnline(false);
    try {
      await cloneAgain(router);
      await cloneBanner();
      expect(personaStepText()).toContain("The new persona.");
    } finally {
      onlineManager.setOnline(true);
    }
  });

  it("says the bot is gone when it left for Trash since the first Clone", async () => {
    const { router } = await start(
      inOrder(
        () => ({ body: TEMPLATE }),
        () => ({ status: 404, body: { error: { code: "not_found", message: "No such bot." } } }),
      ),
    );
    await cloneBanner();
    await leave(router);
    await cloneAgain(router);
    expect(await screen.findByText("The app could not find the bot to copy.")).toBeTruthy();
    expect(screen.queryByText("Cloning Source")).toBeNull();
  });

  it("says the load failed, and Try again fills the form, when the second read fails", async () => {
    const { router } = await start(
      inOrder(
        () => ({ body: TEMPLATE }),
        () => FAILED,
        () => ({ body: CHANGED }),
      ),
    );
    await cloneBanner();
    await leave(router);
    await cloneAgain(router);
    expect(await screen.findByText("The app could not load the bot to copy.")).toBeTruthy();
    expect(screen.queryByText("Cloning Source")).toBeNull();
    click(screen.getByRole("button", { name: "Try again" }));
    await cloneBanner();
    expect(personaStepText()).toContain("The new persona.");
  });

  it("caller left: an answer that comes after the owner left fills no later Clone", async () => {
    const first = heldAnswer();
    const { router } = await start(
      inOrder(
        () => first.promise,
        () => ({ body: CHANGED }),
      ),
    );
    await waitForReads(1);
    await leave(router);
    await first.answer({ body: TEMPLATE });
    await cloneAgain(router);
    await cloneBanner();
    expect(reads()).toBe(2);
    expect(personaStepText()).toContain("The new persona.");
  });

  it("newer request: the old answer of a read from before the leave cannot fill the form", async () => {
    const first = heldAnswer();
    const second = heldAnswer();
    const { router } = await start(
      inOrder(
        () => first.promise,
        () => second.promise,
      ),
    );
    await waitForReads(1);
    await leave(router);
    await cloneAgain(router);
    await waitForReads(2);
    await first.answer({ body: TEMPLATE });
    expect(screen.queryByText("Cloning Source")).toBeNull();
    await second.answer({ body: CHANGED });
    await cloneBanner();
    expect(personaStepText()).toContain("The new persona.");
  });

  // A first load that a live event marks stale goes on (TanStack Query joins it, because it has no
  // data to keep), and it answers with the source at that moment. A change a moment later is no
  // different to the owner: an open form keeps its first answer (the test "keeps the copied versions
  // with the form when the template comes again").
  it("list load: a live event during the read still opens the form, and one read fills it", async () => {
    const held = heldAnswer();
    const { queryClient } = await start(inOrder(() => held.promise));
    await waitForReads(1);
    void queryClient.invalidateQueries({ predicate: BOT_QUERIES });
    await held.answer({ body: CHANGED });
    await cloneBanner();
    expect(reads()).toBe(1);
    expect(personaStepText()).toContain("The new persona.");
  });

  it("slow or failed refresh: the open form stays, with no skeleton and no error", async () => {
    const held = heldAnswer();
    await start(
      inOrder(
        () => ({ body: TEMPLATE }),
        () => held.promise,
      ),
    );
    await cloneBanner();
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await waitForReads(2);
    expect(screen.getByText("Cloning Source")).toBeTruthy();
    await held.answer(FAILED);
    expect(screen.getByText("Cloning Source")).toBeTruthy();
    expect(screen.queryByText("The app could not load the bot to copy.")).toBeNull();
    expect(await createdBody()).toMatchObject({ persona_md: TEMPLATE.persona_md });
  });

  // CL2 (§6): the form decides once if the model left the catalog, so it needs this visit's list.
  it("another request: a Clone waits for the catalog of this visit, and says the model is gone", async () => {
    const held = heldAnswer();
    let modelsAnswer: Handler = () => ({ body: [makeModel(), FAKE_SCRIPTED] });
    const { router } = await start(
      inOrder(
        () => ({ body: TEMPLATE }),
        () => ({ body: TEMPLATE }),
      ),
      { "GET /api/models": (...args) => modelsAnswer(...args) },
    );
    await cloneBanner();
    await leave(router);
    modelsAnswer = () => held.promise;
    await cloneAgain(router);
    await waitForReads(2);
    await waitFor(() => {
      expect(fake?.sent("GET", "/api/models").length).toBeGreaterThan(1);
    });
    expect(screen.queryByText("Cloning Source")).toBeNull();
    await held.answer({ body: [makeModel()] });
    expect(
      await screen.findByText(/Source cannot run: its model is no longer offered/),
    ).toBeTruthy();
    expect(
      screen.getByText(`${TEMPLATE.model_id} is no longer offered. Pick another model.`),
    ).toBeTruthy();
  });

  it("failed refresh: a Clone opens from the last catalog at the first failed try", async () => {
    let modelsAnswer: Handler = () => ({ body: [makeModel(), FAKE_SCRIPTED] });
    const { router, queryClient } = await start(
      inOrder(
        () => ({ body: TEMPLATE }),
        () => ({ body: CHANGED }),
      ),
      { "GET /api/models": (...args) => modelsAnswer(...args) },
    );
    await cloneBanner();
    await leave(router);
    modelsAnswer = () => ({
      status: 500,
      body: { error: { code: "internal_error", message: "Failed." } },
    });
    queryClient.setDefaultOptions({ queries: { retry: 3, retryDelay: 60_000 } });
    await cloneAgain(router);
    await cloneBanner();
    expect(personaStepText()).toContain("The new persona.");
  });

  // A Clone takes all three Advanced values from the template, so old settings cannot reach it.
  it("slow refresh: a Clone does not wait for a new read of the settings", async () => {
    const settings = heldAnswer();
    let settingsAnswer: Handler = () => ({ body: BOT_SETTINGS });
    const { router } = await start(
      inOrder(
        () => ({ body: TEMPLATE }),
        () => ({ body: CHANGED }),
      ),
      { "GET /api/settings": (...args) => settingsAnswer(...args) },
    );
    await cloneBanner();
    await leave(router);
    settingsAnswer = () => settings.promise;
    await cloneAgain(router);
    await cloneBanner();
    expect(personaStepText()).toContain("The new persona.");
    await settings.answer({ body: BOT_SETTINGS });
  });

  it("another request: the form with no settings at all waits for them, then takes this visit's template", async () => {
    const settings = heldAnswer();
    let settingsAnswer: Handler = () => ({ body: BOT_SETTINGS });
    const { router, queryClient } = await start(
      inOrder(
        () => ({ body: TEMPLATE }),
        () => ({ body: CHANGED }),
      ),
      { "GET /api/settings": (...args) => settingsAnswer(...args) },
    );
    await cloneBanner();
    await leave(router);
    // The settings have no answer yet on this visit.
    settingsAnswer = () => settings.promise;
    queryClient.removeQueries({ predicate: SETTINGS_QUERIES });
    await cloneAgain(router);
    await waitForReads(2);
    expect(screen.queryByText("Cloning Source")).toBeNull();
    await settings.answer({ body: BOT_SETTINGS });
    await cloneBanner();
    expect(personaStepText()).toContain("The new persona.");
  });
});
