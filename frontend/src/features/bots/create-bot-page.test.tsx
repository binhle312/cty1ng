import { focusManager } from "@tanstack/react-query";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { fakeApi, NETWORK_ERROR, type RecordedRequest } from "../../../test/fake-api.ts";
import {
  BOT_SETTINGS,
  FAKE_SCRIPTED,
  makeBot,
  makeModel,
  makePin,
  makeSkill,
  makeVersions,
  typeId,
  versionId,
} from "../../../test/fixtures.ts";
import { renderApp } from "../../../test/render-app.tsx";

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
      "Could not create the bot. The app could not reach the server. Your input is kept.",
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
  cloned_from_bot_id: SOURCE.id,
};

// GET /skills hides deprecated skills unless the page asks for them, as the server does. The
// test changes `skills.list` to stand for a change made in another tab.
function skillsApi(
  skills = { list: [OLD, NEW] },
  source = { bot: SOURCE },
  versions: Answer | (() => Answer | Promise<Answer>) = { status: 200, body: makeVersions(3) },
) {
  return fakeApi({
    [`GET /api/skills/${OLD.id}/versions`]: () =>
      typeof versions === "function" ? versions() : versions,
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

  it("shows the copied version when the first answers saw different revisions", async () => {
    fake = skillsApi(undefined, { bot: sourceAtV2() });
    await renderApp(`/bots/new?from=${SOURCE.id}`);
    await screen.findByRole("button", { name: "Create" }, { timeout: 5000 });
    expect(screen.getByText(`${OLD.name} v1 (always load)`)).toBeTruthy();
    openStep(/Skills/);
    expect(within(rowOf(OLD.id)).getByText("v1")).toBeTruthy();
  });

  it("shows no version number when it cannot find the copied one", async () => {
    fake = skillsApi(
      undefined,
      { bot: sourceAtV2() },
      {
        status: 500,
        body: { error: { code: "internal_error", message: "x" } },
      },
    );
    await renderApp(`/bots/new?from=${SOURCE.id}`);
    await screen.findByRole("button", { name: "Create" }, { timeout: 5000 });
    expect(screen.getByText(`${OLD.name} (always load)`)).toBeTruthy();
    click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => {
      expect(fake?.sent("POST", "/api/bots")).toHaveLength(1);
    });
    expect(fake.sent("POST", "/api/bots")[0]?.body).toMatchObject({
      pins: [{ skill_id: OLD.id, skill_version_id: versionId(1), always_load: true }],
    });
  });

  it("keeps the owner's edits when a failed version lookup runs again", async () => {
    let lookups = 0;
    // The second lookup waits until the test lets it answer, so its pending state shows.
    let answer: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      answer = resolve;
    });
    fake = skillsApi(undefined, { bot: sourceAtV2() }, async () => {
      lookups += 1;
      if (lookups === 1) {
        return { status: 500, body: { error: { code: "internal_error", message: "x" } } };
      }
      await held;
      return { status: 200, body: makeVersions(3) };
    });
    const { queryClient } = await renderApp(`/bots/new?from=${SOURCE.id}`);
    await screen.findByRole("button", { name: "Create" }, { timeout: 5000 });
    openStep(/Basics/);
    type("Name", "My edited clone");
    const name = () => screen.getByLabelText("Name", { exact: true });

    // The owner comes back from another tab: the lookup does not run again.
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await waitFor(() => {
      expect(fake?.sent("GET", "/api/bots").length).toBeGreaterThan(1);
    });
    expect(lookups).toBe(1);
    expect(name()).toHaveProperty("value", "My edited clone");

    // Even when it runs again (pending, with no data), the form and the edit stay.
    act(() => {
      void queryClient.refetchQueries({
        predicate: (query) => JSON.stringify(query.queryKey).includes("listSkillVersions"),
      });
    });
    await waitFor(() => {
      expect(lookups).toBe(2);
    });
    expect(name()).toHaveProperty("value", "My edited clone");
    await act(async () => {
      answer();
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(name()).toHaveProperty("value", "My edited clone");
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
