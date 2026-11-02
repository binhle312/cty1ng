import { focusManager } from "@tanstack/react-query";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { fakeApi, heldAnswer } from "../../../test/fake-api.ts";
import {
  BOT_SETTINGS,
  type Bot,
  FAKE_SCRIPTED,
  makeBot,
  makePin,
  makeSkill,
  makeTool,
  makeVersions,
  SKILL_ID,
  typeId,
  versionId,
} from "../../../test/fixtures.ts";
import { renderApp } from "../../../test/render-app.tsx";

// The bot page (bot-page.md, UI-6): the edit layout, the Profile and Model save bars with their
// conflicts and the leave question, and the Skills tab.
const BA_ID = typeId("bot", 1);

let fake: ReturnType<typeof fakeApi> | null = null;
afterEach(() => {
  fake?.restore();
  fake = null;
  act(() => {
    focusManager.setFocused(undefined);
  });
});

type Routes = Parameters<typeof fakeApi>[0];

// `bots` is read on every request, so a test can change the server's bots between two loads.
function open(state: { bots: Bot[] }, extra: Routes = {}, path = "/bots/ba") {
  fake = fakeApi({
    "GET /api/settings": () => ({ body: BOT_SETTINGS }),
    "GET /api/models": () => ({ body: [FAKE_SCRIPTED] }),
    "GET /api/tools": () => ({
      body: [makeTool("read_file", { label: "Read files" })],
    }),
    "GET /api/bots": () => ({ body: state.bots }),
    [`PATCH /api/bots/${BA_ID}`]: (request) => {
      const ba = state.bots[0];
      if (ba === undefined) return { status: 404 };
      // The fake server takes the sent fields as they are; the page's checks come first.
      const saved = Object.assign(structuredClone(ba), request.body, {
        row_version: ba.row_version + 1,
      });
      state.bots = [saved, ...state.bots.slice(1)];
      return { body: saved };
    },
    ...extra,
  });
  return renderApp(path);
}

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

// A refetch of every query, as when the window gets focus back (a `bot.updated` event does the
// same through the realtime reducer).
const refocus = () => {
  act(() => {
    focusManager.setFocused(false);
  });
  act(() => {
    focusManager.setFocused(true);
  });
};

// The text in a field, read without a type assertion.
const valueOf = (label: string): string => {
  const field = screen.getByLabelText(label, { exact: true });
  if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) {
    throw new Error(`${label} is not a text field`);
  }
  return field.value;
};

const saveBar = () => {
  const save = screen.getAllByRole("button", { name: "Save" }).at(-1);
  if (save === undefined) throw new Error("no Save");
  return save.closest("div") ?? save;
};

const heading = () => screen.findByRole("heading", { name: "BA", level: 1 }, { timeout: 5000 });

describe("the bot page", () => {
  it("opens the bot of the slug in the edit layout, with M2's empty tabs (UI-6.1)", async () => {
    await open({ bots: [makeBot(1, "BA"), makeBot(2, "Designer")] });
    await heading();
    expect(screen.getByText("ba")).toBeTruthy();
    expect(screen.getByText("Fake scripted")).toBeTruthy();
    // The list on the left, with the open bot marked.
    const list = screen.getByRole("navigation", { name: "Bots" });
    expect(within(list).getByRole("link", { name: "BA" }).getAttribute("aria-current")).toBe(
      "page",
    );
    expect(within(list).getByRole("link", { name: "Designer" })).toBeTruthy();
    // M2: no Message (bot-page.md §2), no Memory tab.
    expect(screen.queryByRole("button", { name: "Message" })).toBeNull();
    expect(screen.queryByRole("tab", { name: /Memory/ })).toBeNull();
    expect(screen.getByText("No changes. Edits apply from the next run.")).toBeTruthy();
    click(screen.getByRole("tab", { name: /Activity/ }));
    expect(await screen.findByText("BA is in no conversations yet.")).toBeTruthy();
    click(screen.getByRole("tab", { name: /Usage/ }));
    expect(
      await screen.findByText("No runs yet. Usage shows here after BA replies in a conversation."),
    ).toBeTruthy();
  });

  it("opens the tab of the URL", async () => {
    await open({ bots: [makeBot(1, "BA")] }, {}, "/bots/ba?tab=model");
    await heading();
    expect(screen.getByRole("tab", { name: /Model/ }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByLabelText("Model requests per run")).toBeTruthy();
  });

  it("says when no live bot has the slug", async () => {
    await open({ bots: [makeBot(1, "BA")] }, {}, "/bots/gone");
    expect(
      await screen.findByText("The app could not find this bot. It may be in Trash.", undefined, {
        timeout: 5000,
      }),
    ).toBeTruthy();
  });

  it("waits for a list refresh on its way before it says it could not find the bot", async () => {
    // The first list has no Designer; the refresh brings it (as after a Create, when a live
    // event can end the wait for the list early: skill-page.test.tsx).
    const held = heldAnswer();
    const state = { bots: [makeBot(1, "BA")] };
    let hold = false;
    await open(
      state,
      { "GET /api/bots": () => (hold ? held.promise : { body: state.bots }) },
      "/bots/designer",
    );
    await screen.findByText("The app could not find this bot. It may be in Trash.", undefined, {
      timeout: 5000,
    });
    hold = true;
    refocus();
    await waitFor(() => {
      expect(screen.queryByText("The app could not find this bot. It may be in Trash.")).toBeNull();
    });
    await held.answer({ body: [makeBot(1, "BA"), makeBot(2, "Designer")] });
    expect(
      await screen.findByRole("heading", { name: "Designer", level: 1 }, { timeout: 5000 }),
    ).toBeTruthy();
  });

  it("shows a bot that cannot run with its reason and Clone (UI-6.2)", async () => {
    const ba = makeBot(1, "BA", [], {
      available: false,
      unavailable_reason: "no_api_key",
      health: { level: "cannot_run", reason: "no_api_key" },
    });
    const { router } = await open({ bots: [ba] });
    await heading();
    const banner = screen.getByText("Cannot run: no API key").closest("[role='status']");
    if (!(banner instanceof HTMLElement)) throw new Error("no banner");
    click(within(banner).getByRole("button", { name: "Clone" }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/bots/new");
    });
    expect(router.state.location.search).toEqual({ from: BA_ID });
  });
});

describe("the Profile save bar (bot-page.md §4.1)", () => {
  it("saves only the changed fields with the row_version the edit started from", async () => {
    const state = { bots: [makeBot(1, "BA", [], { row_version: 3 })] };
    await open(state);
    await heading();
    type("Description", "Writes user stories.");
    expect(within(saveBar()).getByText("1 change not saved")).toBeTruthy();
    click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(screen.getByText("No changes. Edits apply from the next run.")).toBeTruthy();
    });
    expect(fake?.sent("PATCH", `/api/bots/${BA_ID}`).map((r) => r.body)).toEqual([
      { row_version: 3, description: "Writes user stories." },
    ]);
  });

  it("saves twice in a row: the second save sends the new row_version", async () => {
    const state = { bots: [makeBot(1, "BA")] };
    await open(state);
    await heading();
    type("Description", "First.");
    click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("No changes. Edits apply from the next run.");
    type("Description", "Second.");
    click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(fake?.sent("PATCH", `/api/bots/${BA_ID}`)).toHaveLength(2);
    });
    expect(fake?.sent("PATCH", `/api/bots/${BA_ID}`)[1]?.body).toEqual({
      row_version: 2,
      description: "Second.",
    });
  });

  it("saves with Ctrl+S", async () => {
    await open({ bots: [makeBot(1, "BA")] });
    await heading();
    type("Name", "Analyst");
    act(() => {
      fireEvent.keyDown(window, { key: "s", ctrlKey: true });
    });
    await waitFor(() => {
      expect(fake?.sent("PATCH", `/api/bots/${BA_ID}`)).toHaveLength(1);
    });
  });

  it("keeps the text when the server refuses the name as taken, and says so under Name", async () => {
    await open(
      { bots: [makeBot(1, "BA")] },
      {
        [`PATCH /api/bots/${BA_ID}`]: () => ({
          status: 409,
          body: { error: { code: "name_taken", message: "Taken.", field: "name" } },
        }),
      },
    );
    await heading();
    type("Name", "Writer");
    click(screen.getByRole("button", { name: "Save" }));
    expect(
      await screen.findByText(
        "Writer is taken by another bot, maybe one in Trash. Pick another name.",
      ),
    ).toBeTruthy();
    expect(valueOf("Name")).toBe("Writer");
  });

  it("shows a toast and keeps the text when the save fails", async () => {
    await open(
      { bots: [makeBot(1, "BA")] },
      {
        [`PATCH /api/bots/${BA_ID}`]: () => ({
          status: 500,
          body: { error: { code: "internal_error", message: "Something failed." } },
        }),
      },
    );
    await heading();
    type("Description", "Writes user stories.");
    click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Could not save BA. Try again.")).toBeTruthy();
    expect(within(saveBar()).getByText("1 change not saved")).toBeTruthy();
  });

  it("says Fix 1 field and keeps Save off for an empty name", async () => {
    await open({ bots: [makeBot(1, "BA")] });
    await heading();
    type("Name", "");
    act(() => {
      fireEvent.blur(screen.getByLabelText("Name", { exact: true }));
    });
    expect(await screen.findByText("Required")).toBeTruthy();
    expect(within(saveBar()).getByText("Fix 1 field to save.")).toBeTruthy();
    click(screen.getByRole("button", { name: "Save" }));
    expect(fake?.sent("PATCH", `/api/bots/${BA_ID}`)).toHaveLength(0);
  });

  it("shows an avatar change on the page top before Save: band, Not saved, the bar's line", async () => {
    const ba = makeBot(1, "BA");
    await open({ bots: [ba] });
    await heading();
    expect(screen.queryByText("Not saved")).toBeNull();
    click(screen.getByRole("button", { name: "Colour 2" }));
    expect(screen.getByText("Not saved")).toBeTruthy();
    expect(
      screen.getByText("The header and conversations still show the old avatar until you save."),
    ).toBeTruthy();
    const band = document.querySelector("header [data-band]");
    expect(band?.getAttribute("data-band")).not.toBe(ba.avatar_colour);
  });

  it("keeps the edit on a stale save, says so, and Discard loads the new values", async () => {
    const state = { bots: [makeBot(1, "BA")] };
    await open(state, {
      [`PATCH /api/bots/${BA_ID}`]: () => {
        // Another tab saved first.
        state.bots = [{ ...makeBot(1, "BA"), row_version: 2, description: "From another tab." }];
        return {
          status: 409,
          body: { error: { code: "stale_write", message: "The bot changed." } },
        };
      },
    });
    await heading();
    type("Description", "Mine.");
    click(screen.getByRole("button", { name: "Save" }));
    expect(
      await screen.findByText(
        "BA changed in another place. Your changes are kept here. Copy what you need, then Discard to load the new values.",
      ),
    ).toBeTruthy();
    expect(valueOf("Description")).toBe("Mine.");
    expect(screen.getByRole("button", { name: "Save" }).getAttribute("aria-disabled")).toBe("true");
    click(screen.getByRole("button", { name: "Discard" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Leave without saving? 👀" });
    click(within(dialog).getByRole("button", { name: "Let them go" }));
    await waitFor(() => {
      expect(valueOf("Description")).toBe("From another tab.");
    });
    expect(screen.getByText("No changes. Edits apply from the next run.")).toBeTruthy();
  });

  it("shows the conflict when a newer row_version arrives while the tab has changes", async () => {
    const state = { bots: [makeBot(1, "BA")] };
    await open(state);
    await heading();
    type("Description", "Mine.");
    state.bots = [{ ...makeBot(1, "BA"), row_version: 2, persona_md: "Changed elsewhere." }];
    refocus();
    expect(
      await screen.findByText(/BA changed in another place\. Your changes are kept here\./),
    ).toBeTruthy();
  });

  it("takes newer values at once on a tab with no changes", async () => {
    const state = { bots: [makeBot(1, "BA")] };
    await open(state);
    await heading();
    state.bots = [{ ...makeBot(1, "BA"), row_version: 2, description: "Newer." }];
    refocus();
    await waitFor(() => {
      expect(valueOf("Description")).toBe("Newer.");
    });
    expect(screen.queryByText(/changed in another place/)).toBeNull();
  });

  it("does not block an edit when only a pin changed (same row_version)", async () => {
    const state = { bots: [makeBot(1, "BA")] };
    await open(state);
    await heading();
    type("Description", "Mine.");
    state.bots = [makeBot(1, "BA", [makePin()])];
    refocus();
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /Skills/ }).textContent).toContain("1");
    });
    expect(screen.queryByText(/changed in another place/)).toBeNull();
    expect(within(saveBar()).getByText("1 change not saved")).toBeTruthy();
  });

  it("keeps text typed while a save is pending as a change after it", async () => {
    const held = heldAnswer();
    const state = { bots: [makeBot(1, "BA")] };
    await open(state, {
      [`PATCH /api/bots/${BA_ID}`]: async () => {
        const answer = await held.promise;
        return answer;
      },
    });
    await heading();
    type("Description", "First.");
    click(screen.getByRole("button", { name: "Save" }));
    // The fields are read-only while the save is on its way; the persona is on the same tab, so
    // the owner types after the answer here.
    await held.answer({ body: { ...makeBot(1, "BA"), row_version: 2, description: "First." } });
    await screen.findByText("No changes. Edits apply from the next run.");
    type("Description", "Second.");
    expect(within(saveBar()).getByText("1 change not saved")).toBeTruthy();
  });
});

describe("leaving the bot page with changes (bot-page.md §4.1)", () => {
  it("asks before another tab, names the changed fields, and Stay keeps them", async () => {
    await open({ bots: [makeBot(1, "BA")] });
    await heading();
    type("Name", "Analyst");
    // A saved persona opens in Preview (PF4).
    click(screen.getByRole("tab", { name: "Write" }));
    type("Persona", "You are the analyst.");
    click(screen.getByRole("tab", { name: /Skills/ }));
    const dialog = await screen.findByRole("alertdialog", { name: "Leave without saving? 👀" });
    expect(dialog.textContent).toContain(
      "You changed the name and the persona. The app has not saved them yet. Stay and save, or let them go.",
    );
    click(within(dialog).getByRole("button", { name: "Stay on this page" }));
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).toBeNull();
    });
    expect(valueOf("Name")).toBe("Analyst");
  });

  it("Let them go drops the changes and opens the other bot", async () => {
    const { router } = await open({ bots: [makeBot(1, "BA"), makeBot(2, "Designer")] });
    await heading();
    type("Name", "Analyst");
    const list = screen.getByRole("navigation", { name: "Bots" });
    click(within(list).getByRole("link", { name: "Designer" }));
    const dialog = await screen.findByRole("alertdialog");
    click(within(dialog).getByRole("button", { name: "Let them go" }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/bots/designer");
    });
    expect(await screen.findByRole("heading", { name: "Designer", level: 1 })).toBeTruthy();
  });

  it("asks on Esc in a changed field", async () => {
    await open({ bots: [makeBot(1, "BA")] });
    await heading();
    type("Name", "Analyst");
    act(() => {
      fireEvent.keyDown(screen.getByLabelText("Name", { exact: true }), { key: "Escape" });
    });
    expect(
      await screen.findByRole("alertdialog", { name: "Leave without saving? 👀" }),
    ).toBeTruthy();
  });

  it("moves between tabs without asking when nothing changed", async () => {
    const { router } = await open({ bots: [makeBot(1, "BA")] });
    await heading();
    click(screen.getByRole("tab", { name: /Model/ }));
    await waitFor(() => {
      expect(router.state.location.search).toEqual({ tab: "model" });
    });
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});

describe("the Model tab (bot-page.md §6)", () => {
  it("saves an Advanced value and a tool switch, with no model field", async () => {
    const ba = makeBot(1, "BA", [], { tool_settings: { read_file: true } });
    await open({ bots: [ba] }, {}, "/bots/ba?tab=model");
    await heading();
    expect(screen.queryByRole("combobox", { name: "Model" })).toBeNull();
    type("Model requests per run", "20");
    click(screen.getByRole("switch", { name: /Read files/ }));
    expect(within(saveBar()).getByText("2 changes not saved")).toBeTruthy();
    click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(fake?.sent("PATCH", `/api/bots/${BA_ID}`)).toHaveLength(1);
    });
    expect(fake?.sent("PATCH", `/api/bots/${BA_ID}`)[0]?.body).toEqual({
      row_version: 1,
      tool_settings: { read_file: false },
      request_limit: 20,
    });
  });

  it("locks the tools of a bot whose model left the catalog", async () => {
    const ba = makeBot(1, "BA", [], {
      model_id: "anthropic:old-model",
      model_label: null,
      available: false,
      unavailable_reason: "model_removed",
    });
    await open({ bots: [ba] }, {}, "/bots/ba?tab=model");
    await heading();
    expect(
      screen.getByText(
        "anthropic:old-model is no longer offered, so the tools cannot change. Clone the bot to use another model.",
      ),
    ).toBeTruthy();
  });
});

describe("the Skills tab (bot-page.md §7)", () => {
  const writing = makeSkill({ id: typeId("skill", 2), slug: "writing", name: "Writing" });
  const pins = [
    makePin({ skill_name: "Zeta", skill_slug: "zeta", version: 2, skill_version_id: versionId(2) }),
    makePin({
      skill_id: typeId("skill", 3),
      skill_name: "Alpha",
      skill_slug: "alpha",
      always_load: true,
      latest_version: 1,
      version: 1,
      skill_version_id: typeId("skillv", 31),
    }),
  ];

  it("lists Always load first, then by name, with the upgrade link and the version", async () => {
    await open(
      {
        bots: [
          makeBot(1, "BA", pins, {
            counts: { skills: 2, skill_updates: 1, projects: 0, conversations: 0 },
          }),
        ],
      },
      {},
      "/bots/ba?tab=skills",
    );
    await heading();
    expect(screen.getByRole("tab", { name: /Skills/ }).textContent).toContain("↑1");
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows.map((row) => row.getAttribute("data-skill"))).toEqual(["alpha", "zeta"]);
    expect(
      within(rows.at(1) ?? document.body).getByRole("button", { name: "v3 available" }),
    ).toBeTruthy();
  });

  it("upgrades from the link after showing the changes, sending the pin as it showed it", async () => {
    const state = { bots: [makeBot(1, "BA", pins.slice(0, 1))] };
    await open(
      state,
      {
        [`GET /api/skills/${SKILL_ID}/versions`]: () => ({ body: makeVersions(3) }),
        [`GET /api/skills/${SKILL_ID}/diff`]: () => ({
          body: { body: [{ op: "add", text: "New line." }], description: null },
        }),
        [`PUT /api/bots/${BA_ID}/skills/${SKILL_ID}`]: () => ({
          body: makeBot(1, "BA", [makePin()]),
        }),
      },
      "/bots/ba?tab=skills",
    );
    await heading();
    click(screen.getByRole("button", { name: "v3 available" }));
    const dialog = await screen.findByRole("dialog", { name: "Upgrade Zeta to v3?" });
    click(await within(dialog).findByRole("button", { name: "Upgrade to v3" }));
    await waitFor(() => {
      expect(fake?.sent("PUT", `/api/bots/${BA_ID}/skills/${SKILL_ID}`)).toHaveLength(1);
    });
    expect(fake?.sent("PUT", `/api/bots/${BA_ID}/skills/${SKILL_ID}`)[0]?.body).toEqual({
      skill_version_id: versionId(3),
      always_load: false,
      expected: { skill_version_id: versionId(2), always_load: false },
    });
  });

  it("says when a pin changed in another place, and loads the newest pins", async () => {
    await open(
      { bots: [makeBot(1, "BA", pins.slice(0, 1))] },
      {
        [`PUT /api/bots/${BA_ID}/skills/${SKILL_ID}`]: () => ({
          status: 409,
          body: { error: { code: "stale_write", message: "Changed.", current: null } },
        }),
      },
      "/bots/ba?tab=skills",
    );
    await heading();
    click(screen.getByRole("switch", { name: "Always load Zeta" }));
    expect(
      await screen.findByText("Zeta changed in another place. Check it and try again."),
    ).toBeTruthy();
  });

  it("+ Add lists active skills the bot does not have and gives them the latest version", async () => {
    const deprecated = makeSkill({ id: typeId("skill", 4), name: "Old", deprecated: true });
    await open(
      { bots: [makeBot(1, "BA", [makePin()])] },
      {
        "GET /api/skills": () => ({ body: [makeSkill(), writing, deprecated] }),
        [`GET /api/skills/${writing.id}/versions`]: () => ({
          body: makeVersions(2).map((v) => ({ ...v, skill_id: writing.id })),
        }),
        [`PUT /api/bots/${BA_ID}/skills/${writing.id}`]: () => ({
          body: makeBot(1, "BA", [makePin()]),
        }),
      },
      "/bots/ba?tab=skills",
    );
    await heading();
    click(screen.getByRole("button", { name: "Add" }));
    const dialog = await screen.findByRole("dialog", { name: "Add skills to BA" });
    const list = await within(dialog).findByRole("list", { name: "Skills to add" });
    expect(within(list).getAllByRole("checkbox")).toHaveLength(1);
    click(within(list).getByRole("checkbox"));
    click(within(dialog).getByRole("button", { name: "Add 1" }));
    await waitFor(() => {
      expect(fake?.sent("PUT", `/api/bots/${BA_ID}/skills/${writing.id}`)).toHaveLength(1);
    });
    expect(fake?.sent("PUT", `/api/bots/${BA_ID}/skills/${writing.id}`)[0]?.body).toEqual({
      skill_version_id: versionId(2),
      always_load: false,
      expected: null,
    });
  });

  it("removes a skill without asking", async () => {
    await open(
      { bots: [makeBot(1, "BA", [makePin()])] },
      { [`DELETE /api/bots/${BA_ID}/skills/${SKILL_ID}`]: () => ({ status: 204 }) },
      "/bots/ba?tab=skills",
    );
    await heading();
    click(screen.getByRole("button", { name: /Actions for/ }));
    click(await screen.findByRole("menuitem", { name: "Remove" }));
    await waitFor(() => {
      expect(fake?.sent("DELETE", `/api/bots/${BA_ID}/skills/${SKILL_ID}`)).toHaveLength(1);
    });
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("marks a deprecated skill with its tooltip and no upgrade link (UI-6.5)", async () => {
    await open(
      { bots: [makeBot(1, "BA", [makePin({ deprecated: true, version: 2 })])] },
      {},
      "/bots/ba?tab=skills",
    );
    await heading();
    expect(screen.getByText("Deprecated")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /available/ })).toBeNull();
  });
});
