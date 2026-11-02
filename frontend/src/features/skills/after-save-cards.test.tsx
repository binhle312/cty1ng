import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { fakeApi, heldAnswer } from "../../../test/fake-api.ts";
import {
  BOT_SETTINGS,
  makeBot,
  makePin,
  makeSkill,
  makeVersions,
  SKILL_ID,
  versionId,
} from "../../../test/fixtures.ts";
import { renderApp } from "../../../test/render-app.tsx";

// The bot cards after a save (skills-page.md §7): C4 after "Save as vN", C4b after Create. When
// no bot fits, only the toast shows.
let api: ReturnType<typeof fakeApi> | null = null;
afterEach(() => {
  api?.restore();
  api = null;
});

const click = (element: HTMLElement) => {
  act(() => {
    fireEvent.click(element);
  });
};

const type = (label: string, text: string) => {
  act(() => {
    fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value: text } });
  });
};

// BA uses v3; the save makes v4.
const ba = makeBot(1, "BA", [makePin({ always_load: true })]);
const v4 = makeSkill({
  latest_version: { ...makeSkill().latest_version, version: 4 },
  row_version: 2,
});

async function saveV4(candidates: unknown[]) {
  api = fakeApi({
    "GET /api/settings": () => ({ body: BOT_SETTINGS }),
    "GET /api/skills": () => ({ body: [makeSkill()] }),
    [`GET /api/skills/${SKILL_ID}`]: () => ({ body: makeSkill() }),
    [`GET /api/skills/${SKILL_ID}/versions`]: () => ({ body: makeVersions(4) }),
    "GET /api/bots": () => ({ body: [ba] }),
    [`POST /api/skills/${SKILL_ID}/versions`]: () => ({ status: 201, body: v4 }),
    [`GET /api/skills/${SKILL_ID}/upgrade-candidates`]: () => ({ body: candidates }),
    [`POST /api/skills/${SKILL_ID}/bots`]: () => ({ body: [] }),
  });
  await renderApp("/skills/write-user-stories");
  await screen.findByRole("heading", { name: "Write user stories" }, { timeout: 5000 });
  click(screen.getByRole("tab", { name: "Write" }));
  type("Body", "## Steps\n1. Read the brief.\n2. Ask.");
  click(screen.getByRole("button", { name: "Save as v4" }));
}

describe("the upgrade card after a save (C4, UI-7.4)", () => {
  it("offers v4 to the bots on an older version, every box ticked, and upgrades them", async () => {
    await saveV4([
      { bot_id: ba.id, skill_version_id: versionId(3), version: 3, always_load: true },
    ]);
    const card = await screen.findByRole("dialog", {
      name: "Saved v4 ✨ Also upgrade these bots to v4?",
    });
    const box = within(card).getByRole("checkbox", { name: /BA/ });
    expect(box.getAttribute("aria-checked")).toBe("true");
    click(within(card).getByRole("button", { name: "Upgrade" }));
    await waitFor(() => {
      expect(api?.sent("POST", `/api/skills/${SKILL_ID}/bots`)).toHaveLength(1);
    });
    expect(api?.sent("POST", `/api/skills/${SKILL_ID}/bots`)[0]?.body).toEqual({
      skill_version_id: versionId(4),
      bots: [{ bot_id: ba.id, expected_skill_version_id: versionId(3), always_load: true }],
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /Also upgrade/ })).toBeNull();
    });
  });

  it("keeps the bots' version on Skip, and Upgrade is off with no box ticked", async () => {
    await saveV4([
      { bot_id: ba.id, skill_version_id: versionId(3), version: 3, always_load: true },
    ]);
    const card = await screen.findByRole("dialog");
    click(within(card).getByRole("checkbox", { name: /BA/ }));
    const upgrade = within(card).getByRole("button", { name: "Upgrade" });
    expect(upgrade.getAttribute("aria-disabled")).toBe("true");
    click(within(card).getByRole("button", { name: "Skip" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /Also upgrade/ })).toBeNull();
    });
    expect(api?.sent("POST", `/api/skills/${SKILL_ID}/bots`)).toHaveLength(0);
  });

  it("shows only the toast when no bot uses an older version", async () => {
    await saveV4([]);
    expect(await screen.findByText("Saved v4 ✨")).toBeTruthy();
    // The toast is a dialog too; the card is not there.
    expect(screen.queryByRole("dialog", { name: /Also upgrade/ })).toBeNull();
  });
});

describe("the assign card after Create (C4b)", () => {
  const created = makeSkill({
    latest_version: { ...makeSkill().latest_version, version: 1 },
  });

  async function create(bots: unknown[], held?: ReturnType<typeof heldAnswer>) {
    api = fakeApi({
      "GET /api/settings": () => ({ body: BOT_SETTINGS }),
      "GET /api/skills": () => ({ body: [created] }),
      [`GET /api/skills/${SKILL_ID}`]: () => ({ body: created }),
      [`GET /api/skills/${SKILL_ID}/versions`]: () => ({ body: makeVersions(1) }),
      "GET /api/bots": () => ({ body: bots }),
      "POST /api/skills": () => held?.promise ?? { status: 201, body: created },
      [`POST /api/skills/${SKILL_ID}/bots`]: () => ({ body: [] }),
    });
    const view = await renderApp("/skills/new");
    await screen.findByLabelText("Name", { exact: true }, { timeout: 5000 });
    type("Name", "Write user stories");
    type("Description", "Use this skill when the owner asks for user stories.");
    type("Body", "## Steps");
    click(screen.getByRole("button", { name: "Create" }));
    return view;
  }

  it("offers the new skill to the bots with no box ticked, Skip first, and assigns v1", async () => {
    await create([ba]);
    const card = await screen.findByRole("dialog", {
      name: "Created ✨ Add Write user stories to bots?",
    });
    // Skip is the default button: it has the focus.
    await waitFor(() => {
      expect(document.activeElement?.textContent).toBe("Skip");
    });
    const assign = within(card).getByRole("button", { name: "Assign" });
    expect(assign.getAttribute("aria-disabled")).toBe("true");
    click(within(card).getByRole("checkbox", { name: /BA/ }));
    click(within(card).getByRole("button", { name: "Assign" }));
    await waitFor(() => {
      expect(api?.sent("POST", `/api/skills/${SKILL_ID}/bots`)).toHaveLength(1);
    });
    expect(api?.sent("POST", `/api/skills/${SKILL_ID}/bots`)[0]?.body).toEqual({
      skill_version_id: versionId(1),
      bots: [{ bot_id: ba.id, expected_skill_version_id: null }],
    });
  });

  it("shows only the toast when no bot exists", async () => {
    await create([]);
    expect(await screen.findByText("Created Write user stories ✨")).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: /to bots\?/ })).toBeNull();
  });

  it("shows the toast in place of the card when the owner left the Skills page meanwhile", async () => {
    const held = heldAnswer();
    const { router } = await create([ba], held);
    // The navigation waits for the leave question, so it is not awaited here.
    act(() => {
      void router.navigate({ to: "/" });
    });
    click(await screen.findByRole("button", { name: "Let them go" }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/");
    });
    await held.answer({ status: 201, body: created });
    expect(await screen.findByText("Created Write user stories ✨")).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: /to bots\?/ })).toBeNull();
  });
});
