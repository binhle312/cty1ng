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

  // Try again (E4, E5): the resend is a send like the first one. A held answer shows the state
  // while it waits; the outcome of the resend ends the wait.
  const tryAgainApi = () => {
    const held = heldAnswer();
    let call = 0;
    const server = fakeApi({
      "GET /api/settings": () => ({ body: BOT_SETTINGS }),
      "GET /api/models": () => ({ body: [makeModel(), FAKE_SCRIPTED] }),
      "GET /api/tools": () => ({ body: [] }),
      "GET /api/skills": () => ({ body: [] }),
      "GET /api/bots": () => ({ body: [] }),
      "POST /api/bots": async () => {
        call += 1;
        if (call === 1) return NETWORK_ERROR;
        return held.promise;
      },
    });
    return { held, server };
  };
  const toUnknown = async () => {
    await renderApp("/bots/new");
    await screen.findByRole("heading", { name: "New bot" }, { timeout: 5000 });
    await fillToModelStep();
    click(screen.getByRole("button", { name: "Create" }));
    return screen.findByRole("alert");
  };

  it("shows Creating while Try again waits for its answer (E4)", async () => {
    const { held, server } = tryAgainApi();
    fake = server;
    const alert = await toUnknown();
    click(within(alert).getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("button", { name: "Creating" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    await held.answer({ status: 201, body: makeBot(1, "BA") });
  });

  it("shows the banner again when Try again fails on the way too", async () => {
    const { held, server } = tryAgainApi();
    fake = server;
    const alert = await toUnknown();
    click(within(alert).getByRole("button", { name: "Try again" }));
    await held.answer(NETWORK_ERROR);
    const again = await screen.findByRole("alert");
    expect(again.textContent).toContain("Could not confirm whether the bot was created.");
    expect(screen.queryByRole("button", { name: "Creating" })).toBeNull();
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

  // The wait after Create (frontend-conventions.md §5; owner, 2026-11-12): the bot page finds the
  // bot in the list, so Create moves after the newest list came. A live event in that time starts
  // a newer load, and the wait follows it.
  it("stays on the Create page until the newest bot list comes", async () => {
    const bot = makeBot(1, "BA");
    const held: ReturnType<typeof heldAnswer>[] = [];
    let created = false;
    fake = fakeApi({
      "GET /api/settings": () => ({ body: BOT_SETTINGS }),
      "GET /api/models": () => ({ body: [makeModel(), FAKE_SCRIPTED] }),
      "GET /api/tools": () => ({ body: [] }),
      "GET /api/skills": () => ({ body: [] }),
      // The list from before Create has no bot; each load after Create waits.
      "GET /api/bots": () => {
        if (!created) return { body: [] };
        const answer = heldAnswer();
        held.push(answer);
        return answer.promise;
      },
      "POST /api/bots": () => {
        created = true;
        return { status: 201, body: bot };
      },
    });
    const { router, queryClient } = await renderApp("/bots/new");
    await screen.findByRole("heading", { name: "New bot" }, { timeout: 5000 });
    await fillToModelStep();
    click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => {
      expect(held).toHaveLength(1);
    });
    // Two live events while the refresh waits: each one cuts the load and starts a newer one.
    for (const count of [2, 3]) {
      act(() => {
        void queryClient.invalidateQueries({ predicate: BOT_QUERIES });
      });
      await waitFor(() => {
        expect(held).toHaveLength(count);
      });
    }
    // The move and the toast come in the same step as the end of the wait, so one timer step
    // shows them.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(router.state.location.pathname, "before the newest list").toBe("/bots/new");
    expect(screen.queryByText("Created BA ✨"), "before the newest list").toBeNull();
    // Only the newest load gets an answer: the two cut loads never do.
    await held.at(-1)?.answer({ body: [bot] });
    expect(await screen.findByText("Created BA ✨")).toBeTruthy();
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/bots/ba");
    });
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
function skillsApi(
  skills = { list: [OLD, NEW] },
  source = { bot: SOURCE },
  post: () => { status: number; body: unknown } = () => ({
    status: 201,
    body: makeBot(10, "Source (copy)"),
  }),
) {
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
    "POST /api/bots": post,
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

  // The server refuses a Clone whose source bot was purged meanwhile (bots.service.ts). No step
  // has that field, so the text shows as an error with no field (plan Q2 A).
  const SOURCE_GONE = {
    status: 422,
    body: {
      error: {
        code: "validation_error",
        message: "The bot to copy does not exist.",
        field: "cloned_from_bot_id",
      },
    },
  };

  it("shows a server error on the source bot next to Create", async () => {
    fake = skillsApi(undefined, undefined, () => SOURCE_GONE);
    await renderApp(`/bots/new?from=${SOURCE.id}`);
    click(await screen.findByRole("button", { name: "Create" }, { timeout: 5000 }));
    expect(await screen.findByText("The bot to copy does not exist.")).toBeTruthy();
  });

  it("keeps Create on after a server error on the source bot", async () => {
    fake = skillsApi(undefined, undefined, () => SOURCE_GONE);
    await renderApp(`/bots/new?from=${SOURCE.id}`);
    click(await screen.findByRole("button", { name: "Create" }, { timeout: 5000 }));
    await waitFor(() => {
      expect(fake?.sent("POST", "/api/bots")).toHaveLength(1);
    });
    // The answer came: the button says Create again, not Creating.
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Create" }).textContent).toBe("Create");
    });
    expect(screen.getByRole("button", { name: "Create" }).getAttribute("aria-disabled")).toBe(
      "false",
    );
  });

  it("marks no step after a server error on the source bot", async () => {
    fake = skillsApi(undefined, undefined, () => SOURCE_GONE);
    await renderApp(`/bots/new?from=${SOURCE.id}`);
    click(await screen.findByRole("button", { name: "Create" }, { timeout: 5000 }));
    await waitFor(() => {
      expect(fake?.sent("POST", "/api/bots")).toHaveLength(1);
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Create" }).textContent).toBe("Create");
    });
    expect(screen.queryByRole("button", { name: /has an error/ })).toBeNull();
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
    // CL2 keeps a model with no key: only a model that left the catalog starts empty.
    const model = screen.getByLabelText("Model", { exact: true });
    expect(model instanceof HTMLSelectElement && model.value).toBe(noKey.id);
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

  it("names a ticked skill that another tab deprecated, with the Deprecated pill", async () => {
    const skills = { list: [NEW] };
    fake = skillsApi(skills);
    await renderApp("/bots/new");
    await screen.findByRole("heading", { name: "New bot" }, { timeout: 5000 });
    type("Name", "BA");
    type("Description", "Writes stories.");
    click(screen.getByRole("button", { name: "Next" }));
    type("Persona", "You are the BA.");
    click(screen.getByRole("button", { name: "Next" }));
    click(await waitFor(() => within(rowOf(NEW.id)).getByRole("checkbox")));
    // Another tab deprecates the skill; the list (with deprecated skills) comes again.
    const before = fake.sent("GET", "/api/skills").length;
    skills.list = [{ ...NEW, deprecated: true, deprecated_at: "2026-11-15T00:00:00.000Z" }];
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await waitFor(() => {
      expect(fake?.sent("GET", "/api/skills").length).toBeGreaterThan(before);
    });
    await waitFor(() => {
      expect(within(rowOf(NEW.id)).getByText("Deprecated")).toBeTruthy();
    });
    expect(within(rowOf(NEW.id)).getByText(NEW.name)).toBeTruthy();
    expect(screen.queryByText(/A skill in Trash/)).toBeNull();
  });

  it("drops the row of a deprecated skill when the owner unticks it", async () => {
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
    const before = fake.sent("GET", "/api/skills").length;
    skills.list = [{ ...NEW, deprecated: true, deprecated_at: "2026-11-15T00:00:00.000Z" }];
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await waitFor(() => {
      expect(fake?.sent("GET", "/api/skills").length).toBeGreaterThan(before);
    });
    click(box());
    expect(document.querySelector(`li[data-skill="${NEW.id}"]`)).toBeNull();
  });
});

// CL2 (create-bot-page.md §6, domain-model.md §2 Clone): a Clone whose model left the catalog
// starts with no model. Its error text does not prove this, because a form that kept the old
// model shows the same text. If the model comes back, the field stays empty until the owner picks.
describe("a Clone whose model left the catalog (CL2)", () => {
  let fake: ReturnType<typeof fakeApi> | null = null;
  afterEach(() => {
    fake?.restore();
    fake = null;
    focusManager.setFocused(undefined);
  });

  const GONE = makeModel({ id: "fake:gone", label: "Fake gone", default_effort: "low" });
  const isOff = (button: HTMLElement) =>
    button.hasAttribute("disabled") || button.getAttribute("aria-disabled") === "true";

  it("starts with no model, and sends the model that the owner picks with its default effort", async () => {
    const catalog = { models: [makeModel()] };
    fake = fakeApi({
      "GET /api/settings": () => ({ body: BOT_SETTINGS }),
      "GET /api/models": () => ({ body: catalog.models }),
      "GET /api/tools": () => ({ body: [] }),
      "GET /api/skills": () => ({ body: [OLD, NEW] }),
      "GET /api/bots": () => ({ body: [SOURCE] }),
      [`GET /api/bots/${SOURCE.id}/clone-template`]: () => ({
        body: { ...TEMPLATE, model_id: GONE.id, effort: "high" },
      }),
      "POST /api/bots": () => ({ status: 201, body: makeBot(10, "Source (copy)") }),
    });
    await renderApp(`/bots/new?from=${SOURCE.id}`);
    expect(
      await screen.findByText(
        /Source cannot run: its model is no longer offered/,
        {},
        { timeout: 5000 },
      ),
    ).toBeTruthy();
    const model = screen.getByLabelText("Model", { exact: true });
    if (!(model instanceof HTMLSelectElement)) throw new Error("The model field is not a select.");
    expect(model.value).toBe("");
    expect(screen.queryByLabelText("Effort", { exact: true })).toBeNull();
    expect(isOff(screen.getByRole("button", { name: "Create" }))).toBe(true);

    // The model comes back (a restart with it in the catalog), and the list loads again.
    catalog.models = [makeModel(), GONE];
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await waitFor(() => {
      expect(within(model).queryByRole("option", { name: GONE.label })).not.toBeNull();
    });
    expect(model.value).toBe("");
    expect(isOff(screen.getByRole("button", { name: "Create" }))).toBe(true);
    // The Clone decided once (§6): the banner and the field error stay until the owner picks.
    expect(screen.getByText(/Source cannot run: its model is no longer offered/)).toBeTruthy();
    expect(screen.getByText(`${GONE.id} is no longer offered. Pick another model.`)).toBeTruthy();

    // The owner picks the model: Create sends it with its own default effort, not the old one.
    act(() => {
      fireEvent.change(model, { target: { value: GONE.id } });
    });
    click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => {
      expect(fake?.sent("POST", "/api/bots")).toHaveLength(1);
    });
    expect(fake.sent("POST", "/api/bots")[0]?.body).toMatchObject({
      model_id: GONE.id,
      effort: "low",
    });
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

// A form that fills once waits for a read from this visit (create-bot-page.md §5, §6): the Advanced
// defaults of a new bot come from the settings as they are now, not from the cache.
describe("the read of this visit (create-bot-page.md §5)", () => {
  const READS = ["/api/settings", "/api/models", "/api/tools", "/api/skills"] as const;
  type Read = (typeof READS)[number];
  const ANSWERS: Record<Read, unknown> = {
    "/api/settings": BOT_SETTINGS,
    "/api/models": [makeModel(), FAKE_SCRIPTED],
    "/api/tools": [],
    "/api/skills": [],
  };
  const OK = (read: Read) => ({ body: ANSWERS[read] });
  const FAILED = {
    status: 500,
    body: { error: { code: "internal_error", message: "Failed." } },
  };
  let fake: ReturnType<typeof fakeApi> | null = null;
  afterEach(() => {
    fake?.restore();
    fake = null;
  });
  type Handler = Parameters<typeof fakeApi>[0][string];

  // The first answer of `read` is fine. A test sets `next.answer` for the reads after it.
  function start(read: Read, routes: Parameters<typeof fakeApi>[0] = {}) {
    const next: { answer: Handler } = { answer: () => OK(read) };
    fake = fakeApi({
      "GET /api/settings": () => OK("/api/settings"),
      "GET /api/models": () => OK("/api/models"),
      "GET /api/tools": () => OK("/api/tools"),
      "GET /api/skills": () => OK("/api/skills"),
      "GET /api/bots": () => ({ body: [] }),
      [`GET ${read}`]: (...args) => next.answer(...args),
      ...routes,
    });
    return { next, rendered: renderApp("/bots/new") };
  }
  const form = () => screen.findByRole("heading", { name: "New bot" }, { timeout: 5000 });
  const noForm = () => {
    expect(screen.queryByRole("heading", { name: "New bot" })).toBeNull();
  };
  const noSkeletonOverForm = () => {
    expect(screen.getByRole("heading", { name: "New bot" })).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>("Name", { exact: true }).value).toBe(
      "Typed by the owner",
    );
  };
  const readsOf = (read: Read) => fake?.sent("GET", read).length ?? 0;
  const waitForReads = (read: Read, count: number) =>
    waitFor(() => {
      expect(readsOf(read)).toBe(count);
    });

  it.each(READS)("slow refresh: the second visit waits for %s", async (read) => {
    const { next, rendered } = start(read);
    const { router } = await rendered;
    await form();
    await act(() => router.navigate({ to: "/settings" }));
    const held = heldAnswer();
    next.answer = () => held.promise;
    const before = readsOf(read);
    await act(() => router.navigate({ to: "/bots/new" }));
    await waitForReads(read, before + 1);
    noForm();
    await held.answer(OK(read));
    expect(await form()).toBeTruthy();
  });

  // The wait ends once, when this visit's read gives its last answer (DQ-104).
  it.each(READS)("failed refresh: the form opens when the retries of %s end", async (read) => {
    const { next, rendered } = start(read);
    const { router, queryClient } = await rendered;
    await form();
    await act(() => router.navigate({ to: "/settings" }));
    const lastTry = heldAnswer();
    const answers = [() => FAILED, () => lastTry.promise];
    next.answer = () => {
      const answer = answers.shift();
      if (answer === undefined) throw new Error("no answer left for this read");
      return answer();
    };
    const before = readsOf(read);
    queryClient.setDefaultOptions({ queries: { retry: 1, retryDelay: 1 } });
    await act(() => router.navigate({ to: "/bots/new" }));
    await waitForReads(read, before + 2);
    noForm();
    await lastTry.answer(FAILED);
    expect(await form()).toBeTruthy();
  });

  // A live event starts the read again. The old wait used the failure count, which goes back to 0.
  it.each(READS)(
    "leaving with unsaved: a live event after a failed read of %s keeps the form and the text",
    async (read) => {
      const { next, rendered } = start(read);
      const { router, queryClient } = await rendered;
      await form();
      await act(() => router.navigate({ to: "/settings" }));
      next.answer = () => FAILED;
      queryClient.setDefaultOptions({ queries: { retry: 1, retryDelay: 200 } });
      await act(() => router.navigate({ to: "/bots/new" }));
      await form();
      type("Name", "Typed by the owner");
      const again = heldAnswer();
      next.answer = () => again.promise;
      const before = readsOf(read);
      act(() => {
        void queryClient.invalidateQueries();
      });
      await waitFor(() => {
        expect(readsOf(read)).toBeGreaterThan(before);
      });
      noSkeletonOverForm();
      await again.answer(FAILED);
      noSkeletonOverForm();
    },
  );

  // The open form keeps its first values, but its check of the name follows the bots list.
  it("changes back: a name that is taken and then free keeps the text, and the error goes", async () => {
    const TAKEN = "BA is taken by another bot. Pick another name.";
    let bots: unknown[] = [];
    const { rendered } = start("/api/tools", { "GET /api/bots": () => ({ body: bots }) });
    const { queryClient } = await rendered;
    await form();
    const name = () => screen.getByLabelText<HTMLInputElement>("Name", { exact: true });
    type("Name", "BA");
    act(() => {
      fireEvent.blur(name());
    });
    expect(screen.queryByText(TAKEN)).toBeNull();
    bots = [makeBot(1, "BA")];
    act(() => {
      void queryClient.invalidateQueries();
    });
    expect(await screen.findByText(TAKEN)).toBeTruthy();
    expect(name().value).toBe("BA");
    bots = [];
    act(() => {
      void queryClient.invalidateQueries();
    });
    await waitFor(() => {
      expect(screen.queryByText(TAKEN)).toBeNull();
    });
    expect(name().value).toBe("BA");
  });

  // `/bots/new` and `/bots/new?from={id}` are one route, so only a key gives each form its own mount.
  const CLONE_ROUTES = {
    "GET /api/bots": () => ({ body: [SOURCE] }),
    [`GET /api/bots/${SOURCE.id}/clone-template`]: () => ({
      body: { ...TEMPLATE, pins: [], copied_pins: [] },
    }),
  };
  it.each(READS)(
    "leaving and coming back: a move from the new-bot form to a Clone waits for %s",
    async (read) => {
      const { next, rendered } = start(read, CLONE_ROUTES);
      const { router } = await rendered;
      await form();
      const held = heldAnswer();
      next.answer = () => held.promise;
      const before = readsOf(read);
      await act(() => router.navigate({ to: "/bots/new", search: { from: SOURCE.id } }));
      await waitForReads(read, before + 1);
      expect(screen.queryByText("Cloning Source")).toBeNull();
      await held.answer(OK(read));
      expect(await screen.findByText("Cloning Source", {}, { timeout: 5000 })).toBeTruthy();
    },
  );

  it.each(READS)(
    "leaving and coming back: a move from a Clone to the new-bot form waits for %s",
    async (read) => {
      const { next, rendered } = start(read, CLONE_ROUTES);
      const { router } = await rendered;
      await form();
      await act(() => router.navigate({ to: "/bots/new", search: { from: SOURCE.id } }));
      await screen.findByText("Cloning Source", {}, { timeout: 5000 });
      const held = heldAnswer();
      next.answer = () => held.promise;
      const before = readsOf(read);
      await act(() => router.navigate({ to: "/bots/new", search: {} }));
      await waitForReads(read, before + 1);
      noForm();
      await held.answer(OK(read));
      expect(await form()).toBeTruthy();
      expect(screen.queryByText("Cloning Source")).toBeNull();
    },
  );

  it.each(READS)("offline: the second visit reads %s and opens", async (read) => {
    const { rendered } = start(read);
    const { router } = await rendered;
    await form();
    await act(() => router.navigate({ to: "/settings" }));
    const before = readsOf(read);
    onlineManager.setOnline(false);
    try {
      await act(() => router.navigate({ to: "/bots/new" }));
      expect(await form()).toBeTruthy();
      expect(readsOf(read)).toBe(before + 1);
    } finally {
      onlineManager.setOnline(true);
    }
  });

  it.each(READS)(
    "caller left: a read of %s from before the leave does not open the form",
    async (read) => {
      const { next, rendered } = start(read);
      const { router } = await rendered;
      await form();
      await act(() => router.navigate({ to: "/settings" }));
      const old = heldAnswer();
      const current = heldAnswer();
      const answers = [old, current];
      next.answer = () => {
        const held = answers.shift();
        if (held === undefined) throw new Error("no answer left for this read");
        return held.promise;
      };
      const before = readsOf(read);
      await act(() => router.navigate({ to: "/bots/new" }));
      await waitForReads(read, before + 1);
      await act(() => router.navigate({ to: "/settings" }));
      await act(() => router.navigate({ to: "/bots/new" }));
      await waitForReads(read, before + 2);
      await old.answer(OK(read));
      noForm();
      await current.answer(OK(read));
      expect(await form()).toBeTruthy();
    },
  );

  it.each(READS)(
    "list load: a live event during the read of %s starts a new one, and the old answer does not open the form",
    async (read) => {
      const { next, rendered } = start(read);
      const { router, queryClient } = await rendered;
      await form();
      await act(() => router.navigate({ to: "/settings" }));
      const old = heldAnswer();
      const current = heldAnswer();
      const answers = [old, current];
      next.answer = () => {
        const held = answers.shift();
        if (held === undefined) throw new Error("no answer left for this read");
        return held.promise;
      };
      const before = readsOf(read);
      await act(() => router.navigate({ to: "/bots/new" }));
      await waitForReads(read, before + 1);
      act(() => {
        void queryClient.invalidateQueries();
      });
      await waitForReads(read, before + 2);
      await old.answer(OK(read));
      noForm();
      await current.answer(OK(read));
      expect(await form()).toBeTruthy();
    },
  );
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

  it("waits for the retries of the settings, then opens with the last values", async () => {
    let read: Settings = () => ({ body: BOT_SETTINGS });
    const { router, queryClient } = await start((...args) => read(...args));
    await form();
    await leave(router);
    const lastTry = heldAnswer();
    const answers = [() => FAILED, () => lastTry.promise];
    read = () => {
      const answer = answers.shift();
      if (answer === undefined) throw new Error("no answer left for this read");
      return answer();
    };
    queryClient.setDefaultOptions({ queries: { retry: 1, retryDelay: 1 } });
    await back(router);
    await waitFor(() => {
      expect(fake?.sent("GET", "/api/settings")).toHaveLength(3);
    });
    expect(screen.queryByRole("heading", { name: "New bot" })).toBeNull();
    await lastTry.answer(FAILED);
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

  // The open form keeps its first values, but its limits follow the settings.
  it("changes back: a limit that changes and changes back keeps the text, and the error goes", async () => {
    const usual = BOT_SETTINGS.bot_name_max;
    let limit = usual;
    const { queryClient } = await start(() => ({ body: { ...BOT_SETTINGS, bot_name_max: limit } }));
    await form();
    const name = "x".repeat(20);
    const nameOnForm = () => screen.getByLabelText<HTMLInputElement>("Name", { exact: true }).value;
    type("Name", name);
    expect(screen.queryByText(/The limit is 16/)).toBeNull();
    limit = 16;
    act(() => {
      void queryClient.invalidateQueries();
    });
    expect(await screen.findByText(/The limit is 16/)).toBeTruthy();
    expect(nameOnForm()).toBe(name);
    limit = usual;
    act(() => {
      void queryClient.invalidateQueries();
    });
    await waitFor(() => {
      expect(screen.queryByText(/The limit is 16/)).toBeNull();
    });
    expect(nameOnForm()).toBe(name);
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
  // with the form when the template comes again"). The four lists do the same on a first visit, and
  // the form can open with a value from before the event (DQ-107).
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

  it("failed refresh: a Clone opens from the last catalog when the retries end", async () => {
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
    const lastTry = heldAnswer();
    const answers: Handler[] = [() => FAILED, () => lastTry.promise];
    modelsAnswer = inOrder(...answers);
    const before = fake?.sent("GET", "/api/models").length ?? 0;
    queryClient.setDefaultOptions({ queries: { retry: 1, retryDelay: 1 } });
    await cloneAgain(router);
    await waitFor(() => {
      expect(fake?.sent("GET", "/api/models")).toHaveLength(before + 2);
    });
    expect(screen.queryByText("Cloning Source")).toBeNull();
    await lastTry.answer(FAILED);
    await cloneBanner();
    expect(personaStepText()).toContain("The new persona.");
  });

  it("another request: a Clone waits for the skill list of this visit, and shows a skill in Trash at once", async () => {
    const held = heldAnswer();
    let skillsAnswer: Handler = () => ({ body: [OLD, NEW] });
    const { router } = await start(
      inOrder(
        () => ({ body: CHANGED }),
        () => ({ body: CHANGED }),
      ),
      { "GET /api/skills": (...args) => skillsAnswer(...args) },
    );
    await cloneBanner();
    await leave(router);
    skillsAnswer = () => held.promise;
    await cloneAgain(router);
    await waitForReads(2);
    expect(screen.queryByText("Cloning Source")).toBeNull();
    await held.answer({ body: [OLD] });
    await cloneBanner();
    expect(
      within(screen.getByRole("list", { name: "Steps" })).getByRole("button", {
        name: /Skills, has an error/,
      }),
    ).toBeTruthy();
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
