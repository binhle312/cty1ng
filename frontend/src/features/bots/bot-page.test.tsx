import { focusManager, type QueryClient } from "@tanstack/react-query";
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
import { listBotsQueryKey } from "../../lib/api/generated/@tanstack/react-query.gen.ts";

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
// `routes` add to or replace the default fake routes.
function open(
  state: { bots: Bot[] },
  { routes = {}, path = "/bots/ba" }: { routes?: Routes; path?: string } = {},
) {
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
    ...routes,
  });
  return renderApp(path);
}

const click = (element: HTMLElement) => {
  act(() => {
    fireEvent.click(element);
  });
};

const type = ({ label, text }: { label: string; text: string }) => {
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

// The `row_version` of BA in the bot list cache.
const cachedRowVersion = (queryClient: QueryClient) =>
  queryClient.getQueryData<Bot[]>(listBotsQueryKey())?.[0]?.row_version;

const heading = () => screen.findByRole("heading", { name: "BA", level: 1 }, { timeout: 5000 });

// jsdom has no canvas: a 2D context that draws nothing, and a blob for each crop. It returns
// the function that puts the jsdom methods back.
function fakeCanvas(): () => void {
  const proto = HTMLCanvasElement.prototype;
  const names = ["getContext", "toBlob"] as const;
  const saved = names.map((name) => [name, Object.getOwnPropertyDescriptor(proto, name)] as const);
  Object.defineProperty(proto, "getContext", {
    configurable: true,
    value: () => ({ drawImage: () => undefined }),
  });
  Object.defineProperty(proto, "toBlob", {
    configurable: true,
    value: (done: BlobCallback) => {
      done(new Blob(["image"], { type: "image/png" }));
    },
  });
  return () => {
    for (const [name, descriptor] of saved) {
      if (descriptor !== undefined) Object.defineProperty(proto, name, descriptor);
    }
  };
}

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
    await open({ bots: [makeBot(1, "BA")] }, { path: "/bots/ba?tab=model" });
    await heading();
    expect(screen.getByRole("tab", { name: /Model/ }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByLabelText("Model requests per run")).toBeTruthy();
  });

  it("says when no live bot has the slug", async () => {
    await open({ bots: [makeBot(1, "BA")] }, { path: "/bots/gone" });
    expect(
      await screen.findByText("The app could not find this bot. It may be in Trash.", undefined, {
        timeout: 5000,
      }),
    ).toBeTruthy();
  });

  // State table audit: the bot leaves the list (Trash, another tab) while the owner edits it.
  it("says it could not find the bot when it leaves the list during an edit", async () => {
    const state = { bots: [makeBot(1, "BA"), makeBot(2, "Designer")] };
    await open(state);
    await heading();
    type({ label: "Description", text: "Mine." });
    state.bots = [makeBot(2, "Designer")];
    refocus();
    expect(await screen.findByText(/The app could not find this bot/)).toBeTruthy();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("waits for a list refresh on its way before it says it could not find the bot", async () => {
    // The first list has no Designer; the refresh brings it (as after a Create, when a live
    // event can end the wait for the list early: skill-page.test.tsx).
    const held = heldAnswer();
    const state = { bots: [makeBot(1, "BA")] };
    let hold = false;
    await open(state, {
      routes: { "GET /api/bots": () => (hold ? held.promise : { body: state.bots }) },
      path: "/bots/designer",
    });
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

  it("says the list did not load, not that it could not find the bot, when a refresh fails", async () => {
    // The cached list has no Designer (as just after a Create), and the refresh fails.
    const state = { bots: [makeBot(1, "BA")] };
    let fail = false;
    await open(state, {
      routes: {
        "GET /api/bots": () =>
          fail
            ? { status: 500, body: { error: { code: "internal_error", message: "Failed." } } }
            : { body: state.bots },
      },
      path: "/bots/designer",
    });
    await screen.findByText("The app could not find this bot. It may be in Trash.", undefined, {
      timeout: 5000,
    });
    fail = true;
    refocus();
    expect(await screen.findByText("The app could not load the bots.")).toBeTruthy();
    expect(screen.queryByText("The app could not find this bot. It may be in Trash.")).toBeNull();
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
    type({ label: "Description", text: "Writes user stories." });
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
    type({ label: "Description", text: "First." });
    click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("No changes. Edits apply from the next run.");
    type({ label: "Description", text: "Second." });
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
    type({ label: "Name", text: "Analyst" });
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
        routes: {
          [`PATCH /api/bots/${BA_ID}`]: () => ({
            status: 409,
            body: { error: { code: "name_taken", message: "Taken.", field: "name" } },
          }),
        },
      },
    );
    await heading();
    type({ label: "Name", text: "Writer" });
    click(screen.getByRole("button", { name: "Save" }));
    expect(
      await screen.findByText(
        "Writer is taken by another bot, maybe one in Trash. Pick another name.",
      ),
    ).toBeTruthy();
    expect(valueOf("Name")).toBe("Writer");
  });

  it("drops a late name error when the owner changed the name while Save waited", async () => {
    const held = heldAnswer();
    await open(
      { bots: [makeBot(1, "BA")] },
      {
        routes: {
          [`PATCH /api/bots/${BA_ID}`]: async () => {
            const answer = await held.promise;
            return answer;
          },
        },
      },
    );
    await heading();
    type({ label: "Name", text: "Writer" });
    click(screen.getByRole("button", { name: "Save" }));
    type({ label: "Name", text: "Author" });
    await held.answer({
      status: 409,
      body: { error: { code: "name_taken", message: "Taken.", field: "name" } },
    });
    await waitFor(() => {
      expect(within(saveBar()).getByText("1 change not saved")).toBeTruthy();
    });
    expect(screen.queryByText(/is taken by another bot/)).toBeNull();
    expect(screen.getByRole("button", { name: "Save" }).getAttribute("aria-disabled")).not.toBe(
      "true",
    );
  });

  it("shows a toast and keeps the text when the save fails", async () => {
    await open(
      { bots: [makeBot(1, "BA")] },
      {
        routes: {
          [`PATCH /api/bots/${BA_ID}`]: () => ({
            status: 500,
            body: { error: { code: "internal_error", message: "Something failed." } },
          }),
        },
      },
    );
    await heading();
    type({ label: "Description", text: "Writes user stories." });
    click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Could not save BA. Try again.")).toBeTruthy();
    expect(within(saveBar()).getByText("1 change not saved")).toBeTruthy();
  });

  it("says Fix 1 field and keeps Save off for an empty name", async () => {
    await open({ bots: [makeBot(1, "BA")] });
    await heading();
    type({ label: "Name", text: "" });
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
      routes: {
        [`PATCH /api/bots/${BA_ID}`]: () => {
          // Another tab saved first.
          state.bots = [{ ...makeBot(1, "BA"), row_version: 2, description: "From another tab." }];
          return {
            status: 409,
            body: { error: { code: "stale_write", message: "The bot changed." } },
          };
        },
      },
    });
    await heading();
    type({ label: "Description", text: "Mine." });
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

  it("keeps a stale save's conflict and Save off when the refresh after it fails", async () => {
    const state = { bots: [makeBot(1, "BA")] };
    let fail = false;
    await open(state, {
      routes: {
        "GET /api/bots": () =>
          fail
            ? { status: 500, body: { error: { code: "internal_error", message: "Failed." } } }
            : { body: state.bots },
        [`PATCH /api/bots/${BA_ID}`]: () => {
          // Another tab saved first, and the refresh after the answer fails.
          fail = true;
          return {
            status: 409,
            body: { error: { code: "stale_write", message: "The bot changed." } },
          };
        },
      },
    });
    await heading();
    type({ label: "Description", text: "Mine." });
    const loads = fake?.sent("GET", "/api/bots").length ?? 0;
    click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(fake?.sent("GET", "/api/bots").length).toBeGreaterThan(loads);
    });
    expect(
      await screen.findByText(
        "BA changed in another place. Your changes are kept here. Copy what you need, then Discard to load the new values.",
      ),
    ).toBeTruthy();
    expect(valueOf("Description")).toBe("Mine.");
    expect(screen.getByRole("button", { name: "Save" }).getAttribute("aria-disabled")).toBe("true");
    // Discard ends the conflict and tries to load the newest values again.
    const beforeDiscard = fake?.sent("GET", "/api/bots").length ?? 0;
    click(screen.getByRole("button", { name: "Discard" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Leave without saving? 👀" });
    click(within(dialog).getByRole("button", { name: "Let them go" }));
    await waitFor(() => {
      expect(fake?.sent("GET", "/api/bots").length).toBeGreaterThan(beforeDiscard);
    });
    expect(valueOf("Description")).toBe("BA does its job.");
    expect(screen.getByText("No changes. Edits apply from the next run.")).toBeTruthy();
  });

  it("shows the conflict when a newer row_version arrives while the tab has changes", async () => {
    const state = { bots: [makeBot(1, "BA")] };
    await open(state);
    await heading();
    type({ label: "Description", text: "Mine." });
    state.bots = [{ ...makeBot(1, "BA"), row_version: 2, persona_md: "Changed elsewhere." }];
    refocus();
    expect(
      await screen.findByText(/BA changed in another place\. Your changes are kept here\./),
    ).toBeTruthy();
  });

  it("takes the newest values when the owner types a conflicted tab back to its saved text", async () => {
    const state = { bots: [makeBot(1, "BA")] };
    await open(state);
    await heading();
    type({ label: "Description", text: "Mine." });
    state.bots = [{ ...makeBot(1, "BA"), row_version: 2, persona_md: "Changed elsewhere." }];
    refocus();
    await screen.findByText(/BA changed in another place\. Your changes are kept here\./);
    // Back to the text it had: the tab has no changes now, so it shows the newest values.
    type({ label: "Description", text: "BA does its job." });
    await waitFor(() => {
      // A saved persona shows in Preview (PF4).
      expect(screen.getByText("Changed elsewhere.")).toBeTruthy();
    });
    expect(within(saveBar()).getByText("No changes. Edits apply from the next run.")).toBeTruthy();
  });

  it("keeps text typed back while Save waits, also when the save's event comes first", async () => {
    const held = heldAnswer();
    const state = { bots: [makeBot(1, "BA")] };
    const { queryClient } = await open(state, {
      routes: {
        [`PATCH /api/bots/${BA_ID}`]: async () => {
          const answer = await held.promise;
          return answer;
        },
      },
    });
    await heading();
    type({ label: "Description", text: "Changed." });
    click(screen.getByRole("button", { name: "Save" }));
    // Back to the saved text while the save waits; then the event of the save comes first.
    type({ label: "Description", text: "BA does its job." });
    state.bots = [{ ...makeBot(1, "BA"), row_version: 2, description: "Changed." }];
    refocus();
    await waitFor(() => {
      expect(cachedRowVersion(queryClient)).toBe(2);
    });
    expect(valueOf("Description")).toBe("BA does its job.");
    await held.answer({ body: { ...makeBot(1, "BA"), row_version: 2, description: "Changed." } });
    await waitFor(() => {
      expect(within(saveBar()).getByText("1 change not saved")).toBeTruthy();
    });
    expect(valueOf("Description")).toBe("BA does its job.");
  });

  it("keeps a newer list when the answer of its own save comes after it", async () => {
    const held = heldAnswer();
    const state = { bots: [makeBot(1, "BA")] };
    let fail = false;
    await open(state, {
      routes: {
        "GET /api/bots": () =>
          fail
            ? { status: 500, body: { error: { code: "internal_error", message: "Failed." } } }
            : { body: state.bots },
        [`PATCH /api/bots/${BA_ID}`]: async () => {
          const answer = await held.promise;
          return answer;
        },
      },
    });
    await heading();
    type({ label: "Description", text: "Mine." });
    click(screen.getByRole("button", { name: "Save" }));
    // The save made v2, then another tab made v3; the refresh brings v3 before the v2 answer.
    state.bots = [
      { ...makeBot(1, "BA"), row_version: 3, description: "Mine.", persona_md: "Later." },
    ];
    const loads = fake?.sent("GET", "/api/bots").length ?? 0;
    refocus();
    await waitFor(() => {
      expect(fake?.sent("GET", "/api/bots").length).toBeGreaterThan(loads);
    });
    await act(() => Promise.resolve());
    // Owner, 2026-11-03 (Q1): while the tab's own Save waits, the answer decides.
    expect(screen.queryByText(/changed in another place/)).toBeNull();
    // The refresh after the answer fails, so only the answer could change the list.
    fail = true;
    await held.answer({ body: { ...makeBot(1, "BA"), row_version: 2, description: "Mine." } });
    await waitFor(() => {
      // A saved persona shows in Preview (PF4).
      expect(screen.getByText("Later.")).toBeTruthy();
    });
    expect(within(saveBar()).getByText("No changes. Edits apply from the next run.")).toBeTruthy();
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
    type({ label: "Description", text: "Mine." });
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
      routes: {
        [`PATCH /api/bots/${BA_ID}`]: async () => {
          const answer = await held.promise;
          return answer;
        },
      },
    });
    await heading();
    type({ label: "Description", text: "First." });
    click(screen.getByRole("button", { name: "Save" }));
    // The owner types while the save is on its way (bot-page.md §4.1).
    const field = screen.getByLabelText("Description", { exact: true });
    expect(field.hasAttribute("readonly")).toBe(false);
    type({ label: "Description", text: "Second." });
    await held.answer({ body: { ...makeBot(1, "BA"), row_version: 2, description: "First." } });
    await waitFor(() => {
      expect(within(saveBar()).getByText("1 change not saved")).toBeTruthy();
    });
    expect(valueOf("Description")).toBe("Second.");
    expect(fake?.sent("PATCH", `/api/bots/${BA_ID}`).map((r) => r.body)).toEqual([
      { row_version: 1, description: "First." },
    ]);
  });

  it("shows the saved values, with no change, when the owner discards while Save waits", async () => {
    const held = heldAnswer();
    const state = { bots: [makeBot(1, "BA")] };
    await open(state, {
      routes: {
        [`PATCH /api/bots/${BA_ID}`]: async () => {
          const answer = await held.promise;
          return answer;
        },
      },
    });
    await heading();
    type({ label: "Description", text: "First." });
    click(screen.getByRole("button", { name: "Save" }));
    type({ label: "Description", text: "Second." });
    click(screen.getByRole("button", { name: "Discard" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Leave without saving? 👀" });
    click(within(dialog).getByRole("button", { name: "Let them go" }));
    // The save went through: the server has "First.", and Discard dropped only "Second.".
    const saved = { ...makeBot(1, "BA"), row_version: 2, description: "First." };
    state.bots = [saved];
    await held.answer({ body: saved });
    await waitFor(() => {
      expect(valueOf("Description")).toBe("First.");
    });
    expect(within(saveBar()).getByText("No changes. Edits apply from the next run.")).toBeTruthy();
  });

  it("keeps newer values from another tab when Save answers after a Discard loaded them", async () => {
    const held = heldAnswer();
    const state = { bots: [makeBot(1, "BA")] };
    await open(state, {
      routes: {
        [`PATCH /api/bots/${BA_ID}`]: async () => {
          const answer = await held.promise;
          return answer;
        },
      },
    });
    await heading();
    type({ label: "Description", text: "First." });
    click(screen.getByRole("button", { name: "Save" }));
    // The save made v2; then another tab made v3, and the page loaded it before the answer.
    const newer = { ...makeBot(1, "BA"), row_version: 3, description: "From another tab." };
    state.bots = [newer];
    const before = fake?.sent("GET", "/api/bots").length ?? 0;
    refocus();
    await waitFor(() => {
      expect(fake?.sent("GET", "/api/bots").length).toBeGreaterThan(before);
    });
    await act(() => Promise.resolve());
    click(screen.getByRole("button", { name: "Discard" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Leave without saving? 👀" });
    click(within(dialog).getByRole("button", { name: "Let them go" }));
    await waitFor(() => {
      expect(valueOf("Description")).toBe("From another tab.");
    });
    const loads = fake?.sent("GET", "/api/bots").length ?? 0;
    await held.answer({ body: { ...makeBot(1, "BA"), row_version: 2, description: "First." } });
    // The answer was handled: a successful save refreshes the list.
    await waitFor(() => {
      expect(fake?.sent("GET", "/api/bots").length).toBeGreaterThan(loads);
    });
    expect(valueOf("Description")).toBe("From another tab.");
    expect(within(saveBar()).getByText("No changes. Edits apply from the next run.")).toBeTruthy();
  });

  it("keeps text typed after a Discard while Save waits, with no conflict for its own save", async () => {
    const held = heldAnswer();
    const state = { bots: [makeBot(1, "BA")] };
    let saves = 0;
    await open(state, {
      routes: {
        [`PATCH /api/bots/${BA_ID}`]: async () => {
          saves += 1;
          if (saves > 1) {
            return {
              body: { ...makeBot(1, "BA"), row_version: 3, name: "Analyst", description: "First." },
            };
          }
          const answer = await held.promise;
          return answer;
        },
      },
    });
    await heading();
    type({ label: "Description", text: "First." });
    click(screen.getByRole("button", { name: "Save" }));
    type({ label: "Description", text: "Second." });
    click(screen.getByRole("button", { name: "Discard" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Leave without saving? 👀" });
    click(within(dialog).getByRole("button", { name: "Let them go" }));
    // The owner types again before the answer comes.
    type({ label: "Name", text: "Analyst" });
    const saved = { ...makeBot(1, "BA"), row_version: 2, description: "First." };
    state.bots = [saved];
    await held.answer({ body: saved });
    await waitFor(() => {
      expect(valueOf("Description")).toBe("First.");
    });
    expect(valueOf("Name")).toBe("Analyst");
    expect(screen.queryByText(/BA changed in another place/)).toBeNull();
    expect(within(saveBar()).getByText("1 change not saved")).toBeTruthy();
    click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(fake?.sent("PATCH", `/api/bots/${BA_ID}`)).toHaveLength(2);
    });
    expect(fake?.sent("PATCH", `/api/bots/${BA_ID}`)[1]?.body).toEqual({
      row_version: 2,
      name: "Analyst",
    });
  });

  // PR #59 review of 340ca02: Save on the other tab looked on, but a click sent nothing.
  // Fresh review of the audit: the event of a Profile save showed a conflict on the Model tab.
  it("shows no conflict on the other tab when the event of a Save comes before its answer", async () => {
    const held = heldAnswer();
    const state = { bots: [makeBot(1, "BA")] };
    await open(state, {
      routes: {
        [`PATCH /api/bots/${BA_ID}`]: async () => {
          const answer = await held.promise;
          return answer;
        },
      },
    });
    await heading();
    type({ label: "Description", text: "Mine." });
    click(screen.getByRole("button", { name: "Save" }));
    click(screen.getByRole("tab", { name: /Model/ }));
    const leave = await screen.findByRole("alertdialog", { name: "Leave without saving? 👀" });
    click(within(leave).getByRole("button", { name: "Let them go" }));
    await waitFor(() => {
      expect(screen.getByLabelText("Model requests per run", { exact: true })).toBeTruthy();
    });
    type({ label: "Model requests per run", text: "20" });
    // The save's own event: the server has v2 before the page has the answer.
    const saved = { ...makeBot(1, "BA"), row_version: 2, description: "Mine." };
    state.bots = [saved];
    const loads = fake?.sent("GET", "/api/bots").length ?? 0;
    refocus();
    await waitFor(() => {
      expect(fake?.sent("GET", "/api/bots").length).toBeGreaterThan(loads);
    });
    await act(() => Promise.resolve());
    expect(screen.queryByText(/changed in another place/)).toBeNull();
    await held.answer({ body: saved });
    await waitFor(() => {
      expect(
        within(saveBar()).getByRole("button", { name: "Save" }).getAttribute("aria-disabled"),
      ).toBe("false");
    });
    expect(within(saveBar()).getByText("1 change not saved")).toBeTruthy();
    expect(screen.queryByText(/changed in another place/)).toBeNull();
  });

  it("shows the conflict after a Save answers when another place changed the bot meanwhile", async () => {
    const held = heldAnswer();
    const state = { bots: [makeBot(1, "BA")] };
    await open(state, {
      routes: {
        [`PATCH /api/bots/${BA_ID}`]: async () => {
          const answer = await held.promise;
          return answer;
        },
      },
    });
    await heading();
    type({ label: "Description", text: "Mine." });
    click(screen.getByRole("button", { name: "Save" }));
    click(screen.getByRole("tab", { name: /Model/ }));
    const leave = await screen.findByRole("alertdialog", { name: "Leave without saving? 👀" });
    click(within(leave).getByRole("button", { name: "Let them go" }));
    await waitFor(() => {
      expect(screen.getByLabelText("Model requests per run", { exact: true })).toBeTruthy();
    });
    type({ label: "Model requests per run", text: "20" });
    // The save made v2; another tab then made v3.
    state.bots = [{ ...makeBot(1, "BA"), row_version: 3, description: "Mine.", request_limit: 5 }];
    refocus();
    await held.answer({ body: { ...makeBot(1, "BA"), row_version: 2, description: "Mine." } });
    expect(await screen.findByText(/BA changed in another place/)).toBeTruthy();
  });

  it("turns Save off on the other tab while a Save is on its way, then saves it after", async () => {
    const held = heldAnswer();
    const state = { bots: [makeBot(1, "BA")] };
    await open(state, {
      routes: {
        [`PATCH /api/bots/${BA_ID}`]: async () => {
          if (fake?.sent("PATCH", `/api/bots/${BA_ID}`).length === 1) {
            const answer = await held.promise;
            return answer;
          }
          return {
            body: { ...makeBot(1, "BA"), row_version: 3, description: "Mine.", request_limit: 20 },
          };
        },
      },
    });
    await heading();
    type({ label: "Description", text: "Mine." });
    click(screen.getByRole("button", { name: "Save" }));
    // The owner lets the Profile edit go to change tabs; its Save is still on its way.
    click(screen.getByRole("tab", { name: /Model/ }));
    const leave = await screen.findByRole("alertdialog", { name: "Leave without saving? 👀" });
    click(within(leave).getByRole("button", { name: "Let them go" }));
    await waitFor(() => {
      expect(screen.getByLabelText("Model requests per run", { exact: true })).toBeTruthy();
    });
    type({ label: "Model requests per run", text: "20" });
    const modelSave = () => within(saveBar()).getByRole("button", { name: "Save" });
    expect(within(saveBar()).getByText("1 change not saved")).toBeTruthy();
    expect(modelSave().getAttribute("aria-disabled")).toBe("true");
    act(() => {
      fireEvent.focus(modelSave());
    });
    expect(await screen.findByText("Wait until the Profile tab is saved.")).toBeTruthy();
    click(modelSave());
    expect(fake?.sent("PATCH", `/api/bots/${BA_ID}`)).toHaveLength(1);
    const saved = { ...makeBot(1, "BA"), row_version: 2, description: "Mine." };
    state.bots = [saved];
    await held.answer({ body: saved });
    await waitFor(() => {
      expect(modelSave().getAttribute("aria-disabled")).toBe("false");
    });
    click(modelSave());
    await waitFor(() => {
      expect(fake?.sent("PATCH", `/api/bots/${BA_ID}`)).toHaveLength(2);
    });
    expect(fake?.sent("PATCH", `/api/bots/${BA_ID}`)[1]?.body).toEqual({
      row_version: 2,
      request_limit: 20,
    });
  });

  // State table audit (D1): a Save that fails after its tab was let go said nothing.
  it("says in a toast when a Save fails after the owner let its tab go", async () => {
    const held = heldAnswer();
    const state = { bots: [makeBot(1, "BA")] };
    await open(state, {
      routes: {
        [`PATCH /api/bots/${BA_ID}`]: async () => {
          const answer = await held.promise;
          return answer;
        },
      },
    });
    await heading();
    type({ label: "Name", text: "Analyst" });
    click(screen.getByRole("button", { name: "Save" }));
    click(screen.getByRole("button", { name: "Discard" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Leave without saving? 👀" });
    click(within(dialog).getByRole("button", { name: "Let them go" }));
    await held.answer({
      status: 409,
      body: {
        error: { code: "name_taken", message: "This name or slug is taken.", field: "name" },
      },
    });
    expect(
      await screen.findByText(
        "Could not save BA: Analyst is taken by another bot, maybe one in Trash.",
      ),
    ).toBeTruthy();
    expect(valueOf("Name")).toBe("BA");
  });

  it("says in a toast when a Save fails as stale after the owner left for another bot", async () => {
    const held = heldAnswer();
    const state = { bots: [makeBot(1, "BA"), makeBot(2, "Designer")] };
    await open(state, {
      routes: {
        [`PATCH /api/bots/${BA_ID}`]: async () => {
          const answer = await held.promise;
          return answer;
        },
      },
    });
    await heading();
    type({ label: "Description", text: "Mine." });
    click(screen.getByRole("button", { name: "Save" }));
    click(
      within(screen.getByRole("navigation", { name: "Bots" })).getByRole("link", {
        name: "Designer",
      }),
    );
    const dialog = await screen.findByRole("alertdialog", { name: "Leave without saving? 👀" });
    click(within(dialog).getByRole("button", { name: "Let them go" }));
    await screen.findByRole("heading", { name: "Designer", level: 1 });
    await held.answer({
      status: 409,
      body: { error: { code: "stale_write", message: "The bot changed.", current: null } },
    });
    expect(
      await screen.findByText("BA changed in another place, so the app did not save your change."),
    ).toBeTruthy();
  });

  // State table audit (D3): the leave question said "You changed ." after its Save answered.
  it("leaves at once when the Save answers while the leave question is open", async () => {
    const held = heldAnswer();
    const state = { bots: [makeBot(1, "BA"), makeBot(2, "Designer")] };
    const { router } = await open(state, {
      routes: {
        [`PATCH /api/bots/${BA_ID}`]: async () => {
          const answer = await held.promise;
          return answer;
        },
      },
    });
    await heading();
    type({ label: "Description", text: "Mine." });
    click(screen.getByRole("button", { name: "Save" }));
    click(
      within(screen.getByRole("navigation", { name: "Bots" })).getByRole("link", {
        name: "Designer",
      }),
    );
    await screen.findByRole("alertdialog", { name: "Leave without saving? 👀" });
    // Nothing is unsaved after the answer: the question has no reason any more.
    await held.answer({ body: { ...makeBot(1, "BA"), row_version: 2, description: "Mine." } });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/bots/designer");
    });
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("keeps the leave question, with its words, when text typed during the Save is still unsaved", async () => {
    const held = heldAnswer();
    const state = { bots: [makeBot(1, "BA"), makeBot(2, "Designer")] };
    await open(state, {
      routes: {
        [`PATCH /api/bots/${BA_ID}`]: async () => {
          const answer = await held.promise;
          return answer;
        },
      },
    });
    await heading();
    type({ label: "Description", text: "Mine." });
    click(screen.getByRole("button", { name: "Save" }));
    type({ label: "Description", text: "Mine, later." });
    click(
      within(screen.getByRole("navigation", { name: "Bots" })).getByRole("link", {
        name: "Designer",
      }),
    );
    await screen.findByRole("alertdialog", { name: "Leave without saving? 👀" });
    await held.answer({ body: { ...makeBot(1, "BA"), row_version: 2, description: "Mine." } });
    await waitFor(() => {
      expect(fake?.sent("GET", "/api/bots").length).toBeGreaterThan(1);
    });
    expect(
      screen.getByRole("alertdialog", { name: "Leave without saving? 👀" }).textContent,
    ).toContain("You changed the description.");
  });

  // PR #59 review: the upload answer wrote the whole form from the render that started it.
  it("keeps a newer name when an avatar upload answers after it", async () => {
    const upload = heldAnswer();
    const state = { bots: [makeBot(1, "BA")] };
    await open(state, {
      routes: {
        "GET /api/avatars/limits": () => ({
          body: { accepted_types: ["image/png"], max_bytes: 2_000_000 },
        }),
        "POST /api/avatars": async () => {
          const answer = await upload.promise;
          return answer;
        },
      },
    });
    await heading();
    const restoreCanvas = fakeCanvas();
    try {
      act(() => {
        fireEvent.change(screen.getByLabelText("Upload image", { selector: "input" }), {
          target: { files: [new File(["image"], "image.png", { type: "image/png" })] },
        });
      });
      const crop = await screen.findByRole("dialog", { name: "Crop the image" });
      const image = crop.querySelector("img");
      if (image === null) throw new Error("no image");
      Object.defineProperties(image, {
        naturalWidth: { value: 100 },
        naturalHeight: { value: 100 },
      });
      act(() => {
        fireEvent.load(image);
      });
      click(within(crop).getByRole("button", { name: "Use" }));
      await waitFor(() => {
        expect(fake?.sent("POST", "/api/avatars")).toHaveLength(1);
      });
      // Another tab renames the bot while the upload is on its way; the tab has no changes.
      state.bots = [{ ...makeBot(1, "BA"), row_version: 2, name: "New BA" }];
      refocus();
      await waitFor(() => {
        expect(valueOf("Name")).toBe("New BA");
      });
      const avatarId = "a".repeat(64);
      await upload.answer({ body: { avatar_id: avatarId, url: `/api/avatars/${avatarId}.webp` } });
      await waitFor(() => {
        expect(screen.queryByRole("dialog", { name: "Crop the image" })).toBeNull();
      });
      expect(valueOf("Name")).toBe("New BA");
      click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => {
        expect(fake?.sent("PATCH", `/api/bots/${BA_ID}`)).toHaveLength(1);
      });
      expect(fake?.sent("PATCH", `/api/bots/${BA_ID}`)[0]?.body).toEqual({
        row_version: 2,
        avatar_style: "upload",
        avatar_id: avatarId,
      });
    } finally {
      restoreCanvas();
    }
  });

  // PR #59 review: changes counted only against the values from before the Save.
  it("asks before leaving when text typed back while Save waits differs from what it sent", async () => {
    const held = heldAnswer();
    const state = { bots: [makeBot(1, "BA"), makeBot(2, "Designer")] };
    await open(state, {
      routes: {
        [`PATCH /api/bots/${BA_ID}`]: async () => {
          const answer = await held.promise;
          return answer;
        },
      },
    });
    await heading();
    type({ label: "Name", text: "Analyst" });
    click(screen.getByRole("button", { name: "Save" }));
    // Back to the old name while the save of "Analyst" waits: it is a change after the save.
    type({ label: "Name", text: "BA" });
    expect(within(saveBar()).getByText("1 change not saved")).toBeTruthy();
    click(
      within(screen.getByRole("navigation", { name: "Bots" })).getByRole("link", {
        name: "Designer",
      }),
    );
    const dialog = await screen.findByRole("alertdialog", { name: "Leave without saving? 👀" });
    expect(dialog.textContent).toContain("You changed the name.");
    click(within(dialog).getByRole("button", { name: "Stay on this page" }));
    await held.answer({ body: { ...makeBot(1, "BA"), row_version: 2, name: "Analyst" } });
    await waitFor(() => {
      expect(fake?.sent("GET", "/api/bots").length).toBeGreaterThan(1);
    });
    expect(valueOf("Name")).toBe("BA");
    expect(within(saveBar()).getByText("1 change not saved")).toBeTruthy();
  });

  it("leaves at once after a Discard while Save waits: nothing of the owner's is unsaved", async () => {
    const held = heldAnswer();
    const state = { bots: [makeBot(1, "BA"), makeBot(2, "Designer")] };
    const { router } = await open(state, {
      routes: {
        [`PATCH /api/bots/${BA_ID}`]: async () => {
          const answer = await held.promise;
          return answer;
        },
      },
    });
    await heading();
    type({ label: "Name", text: "Analyst" });
    click(screen.getByRole("button", { name: "Save" }));
    type({ label: "Name", text: "BA" });
    click(screen.getByRole("button", { name: "Discard" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Leave without saving? 👀" });
    click(within(dialog).getByRole("button", { name: "Let them go" }));
    click(
      within(screen.getByRole("navigation", { name: "Bots" })).getByRole("link", {
        name: "Designer",
      }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/bots/designer");
    });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    await held.answer({ body: { ...makeBot(1, "BA"), row_version: 2, name: "Analyst" } });
  });
});

describe("the side list (bot-page.md E2, pin.md §2)", () => {
  const pinned = [
    makeBot(1, "BA", [], { pinned_position: 1 }),
    makeBot(2, "QA", [], { pinned_position: 2 }),
    makeBot(3, "UX"),
  ];
  const pinsRoute = { "PUT /api/bots/pins": () => ({ body: { pinned_bot_ids: [] } }) };
  const sideLink = (name: string) =>
    within(screen.getByRole("navigation", { name: "Bots" })).getByRole("link", { name });

  it("moves a focused pinned bot one place with Alt+←, and saves at once", async () => {
    await open({ bots: pinned }, { routes: pinsRoute });
    await heading();
    act(() => {
      sideLink("QA").focus();
      fireEvent.keyDown(sideLink("QA"), { key: "ArrowLeft", altKey: true });
    });
    await waitFor(() => {
      expect(fake?.sent("PUT", "/api/bots/pins").map((r) => r.body)).toEqual([
        {
          bot_ids: [pinned[1]?.id, pinned[0]?.id],
          expected_bot_ids: [pinned[0]?.id, pinned[1]?.id],
        },
      ]);
    });
  });

  it("does not move a pinned bot while a search is on", async () => {
    await open({ bots: pinned }, { routes: pinsRoute });
    await heading();
    act(() => {
      fireEvent.change(screen.getByRole("searchbox", { name: "Search bots" }), {
        target: { value: "A" },
      });
    });
    act(() => {
      fireEvent.keyDown(sideLink("BA"), { key: "ArrowRight", altKey: true });
    });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Unpin QA" }));
    });
    // The unpin is the only request: the move sent nothing.
    await waitFor(() => {
      expect(fake?.sent("PUT", "/api/bots/pins").map((r) => r.body)).toEqual([
        { bot_ids: [pinned[0]?.id], expected_bot_ids: [pinned[0]?.id, pinned[1]?.id] },
      ]);
    });
  });

  // State table audit (D2): a refresh before the answer showed the bot pinned again.
  it("keeps an unpin on its way when a refresh lands before its answer", async () => {
    const held = heldAnswer();
    const state = { bots: [makeBot(1, "BA", [], { pinned_position: 1 }), makeBot(2, "QA")] };
    await open(state, {
      routes: {
        "PUT /api/bots/pins": async () => {
          const answer = await held.promise;
          return answer;
        },
      },
    });
    await heading();
    click(screen.getByRole("button", { name: "Unpin BA" }));
    await waitFor(() => {
      expect(fake?.sent("PUT", "/api/bots/pins")).toHaveLength(1);
    });
    // Another refresh (focus, an event) brings the server's list from before the unpin.
    const loads = fake?.sent("GET", "/api/bots").length ?? 0;
    refocus();
    await waitFor(() => {
      expect(fake?.sent("GET", "/api/bots").length).toBeGreaterThan(loads);
    });
    await act(() => Promise.resolve());
    expect(screen.queryAllByRole("button", { name: "Unpin BA" })).toHaveLength(0);
    state.bots = [makeBot(1, "BA"), makeBot(2, "QA")];
    await held.answer({ body: { pinned_bot_ids: [] } });
    await waitFor(() => {
      expect(fake?.sent("GET", "/api/bots").length).toBeGreaterThan(loads + 1);
    });
    expect(screen.queryAllByRole("button", { name: "Unpin BA" })).toHaveLength(0);
  });

  it("keeps a newer unpin when a late Profile answer comes after it", async () => {
    const held = heldAnswer();
    const state = { bots: [makeBot(1, "BA", [], { pinned_position: 1 }), makeBot(2, "QA")] };
    let fail = false;
    await open(state, {
      routes: {
        "GET /api/bots": () =>
          fail
            ? { status: 500, body: { error: { code: "internal_error", message: "Failed." } } }
            : { body: state.bots },
        [`PATCH /api/bots/${BA_ID}`]: async () => {
          const answer = await held.promise;
          return answer;
        },
        "PUT /api/bots/pins": () => ({ body: { pinned_bot_ids: [] } }),
      },
    });
    await heading();
    type({ label: "Description", text: "Mine." });
    click(screen.getByRole("button", { name: "Save" }));
    // Every refresh fails, so only the answers could change the list.
    fail = true;
    const loadsBefore = fake?.sent("GET", "/api/bots").length ?? 0;
    click(screen.getByRole("button", { name: "Unpin BA" }));
    await waitFor(() => {
      expect(fake?.sent("GET", "/api/bots").length).toBeGreaterThan(loadsBefore);
    });
    expect(screen.queryByRole("button", { name: "Unpin BA" })).toBeNull();
    // The Profile save got to the server before the unpin: its answer has the old position.
    const loads = fake?.sent("GET", "/api/bots").length ?? 0;
    await held.answer({
      body: {
        ...makeBot(1, "BA", [], { pinned_position: 1 }),
        row_version: 2,
        description: "Mine.",
      },
    });
    await waitFor(() => {
      // The answer was handled: a successful save refreshes the list.
      expect(fake?.sent("GET", "/api/bots").length).toBeGreaterThan(loads);
    });
    expect(screen.queryByRole("button", { name: "Unpin BA" })).toBeNull();
  });
});

describe("leaving the bot page with changes (bot-page.md §4.1)", () => {
  it("asks before another tab, names the changed fields, and Stay keeps them", async () => {
    await open({ bots: [makeBot(1, "BA")] });
    await heading();
    type({ label: "Name", text: "Analyst" });
    // A saved persona opens in Preview (PF4).
    click(screen.getByRole("tab", { name: "Write" }));
    type({ label: "Persona", text: "You are the analyst." });
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
    type({ label: "Name", text: "Analyst" });
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
    type({ label: "Name", text: "Analyst" });
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
    await open({ bots: [ba] }, { path: "/bots/ba?tab=model" });
    await heading();
    expect(screen.queryByRole("combobox", { name: "Model" })).toBeNull();
    type({ label: "Model requests per run", text: "20" });
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
    await open({ bots: [ba] }, { path: "/bots/ba?tab=model" });
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
      { path: "/bots/ba?tab=skills" },
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
    await open(state, {
      routes: {
        [`GET /api/skills/${SKILL_ID}/versions`]: () => ({ body: makeVersions(3) }),
        [`GET /api/skills/${SKILL_ID}/diff`]: () => ({
          body: { body: [{ op: "add", text: "New line." }], description: null },
        }),
        [`PUT /api/bots/${BA_ID}/skills/${SKILL_ID}`]: () => ({
          body: makeBot(1, "BA", [makePin()]),
        }),
      },
      path: "/bots/ba?tab=skills",
    });
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

  it("moves a skill to an older version from Change version (UI-6.4)", async () => {
    await open(
      { bots: [makeBot(1, "BA", pins.slice(0, 1))] },
      {
        routes: {
          [`GET /api/skills/${SKILL_ID}/versions`]: () => ({ body: makeVersions(3) }),
          [`GET /api/skills/${SKILL_ID}/diff`]: () => ({
            body: { body: [{ op: "del", text: "New line." }], description: null },
          }),
          [`PUT /api/bots/${BA_ID}/skills/${SKILL_ID}`]: () => ({
            body: makeBot(1, "BA", [makePin()]),
          }),
        },
        path: "/bots/ba?tab=skills",
      },
    );
    await heading();
    click(screen.getByRole("button", { name: "Actions for Zeta" }));
    click(await screen.findByRole("menuitem", { name: "Change version" }));
    const versions = await screen.findByRole("list", { name: "Versions" });
    const older = within(versions)
      .getAllByRole("button")
      .find((button) => button.textContent.includes("v1"));
    if (older === undefined) throw new Error("no v1");
    click(older);
    const dialog = await screen.findByRole("dialog", { name: "Move Zeta to v1?" });
    click(await within(dialog).findByRole("button", { name: "Use v1" }));
    await waitFor(() => {
      expect(fake?.sent("PUT", `/api/bots/${BA_ID}/skills/${SKILL_ID}`)).toHaveLength(1);
    });
    expect(fake?.sent("PUT", `/api/bots/${BA_ID}/skills/${SKILL_ID}`)[0]?.body).toEqual({
      skill_version_id: versionId(1),
      always_load: false,
      expected: { skill_version_id: versionId(2), always_load: false },
    });
  });

  it("closes a stale version move and says so in a toast (bot-page.md §7)", async () => {
    await open(
      { bots: [makeBot(1, "BA", pins.slice(0, 1))] },
      {
        routes: {
          [`GET /api/skills/${SKILL_ID}/versions`]: () => ({ body: makeVersions(3) }),
          [`GET /api/skills/${SKILL_ID}/diff`]: () => ({
            body: { body: [{ op: "del", text: "New line." }], description: null },
          }),
          [`PUT /api/bots/${BA_ID}/skills/${SKILL_ID}`]: () => ({
            status: 409,
            body: { error: { code: "stale_write", message: "Changed.", current: null } },
          }),
        },
        path: "/bots/ba?tab=skills",
      },
    );
    await heading();
    click(screen.getByRole("button", { name: "Actions for Zeta" }));
    click(await screen.findByRole("menuitem", { name: "Change version" }));
    const versions = await screen.findByRole("list", { name: "Versions" });
    const older = within(versions)
      .getAllByRole("button")
      .find((button) => button.textContent.includes("v1"));
    if (older === undefined) throw new Error("no v1");
    click(older);
    const dialog = await screen.findByRole("dialog", { name: "Move Zeta to v1?" });
    click(await within(dialog).findByRole("button", { name: "Use v1" }));
    expect(
      await screen.findByText("Zeta changed in another place. Check it and try again."),
    ).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Move Zeta to v1?" })).toBeNull();
    });
  });

  it("keeps a newer bot when a late Always load answer comes after it", async () => {
    const held = heldAnswer();
    const state = { bots: [makeBot(1, "BA", pins.slice(0, 1))] };
    let fail = false;
    const { queryClient } = await open(state, {
      routes: {
        "GET /api/bots": () =>
          fail
            ? { status: 500, body: { error: { code: "internal_error", message: "Failed." } } }
            : { body: state.bots },
        [`PUT /api/bots/${BA_ID}/skills/${SKILL_ID}`]: async () => {
          const answer = await held.promise;
          return answer;
        },
      },
      path: "/bots/ba?tab=skills",
    });
    await heading();
    click(screen.getByRole("switch", { name: "Always load Zeta" }));
    // A Profile save in another tab makes v2 while the toggle waits.
    state.bots = [{ ...makeBot(1, "BA", pins.slice(0, 1)), row_version: 2, description: "Newer." }];
    refocus();
    await waitFor(() => {
      expect(cachedRowVersion(queryClient)).toBe(2);
    });
    // The refresh after the answer fails, so only the answer could change the list.
    fail = true;
    const toggled = pins.slice(0, 1).map((pin) => ({ ...pin, always_load: true }));
    await held.answer({ body: makeBot(1, "BA", toggled) });
    await waitFor(() => {
      expect(
        screen.getByRole("switch", { name: "Always load Zeta" }).hasAttribute("data-disabled"),
      ).toBe(false);
    });
    expect(cachedRowVersion(queryClient)).toBe(2);
  });

  it("keeps a newer pin of another skill when a late Always load answer comes after it", async () => {
    const held = heldAnswer();
    const [zeta, alpha] = pins;
    if (zeta === undefined || alpha === undefined) throw new Error("no pins");
    const zetaV3 = makePin({ skill_name: "Zeta", skill_slug: "zeta" });
    const alphaOff = { ...alpha, always_load: false };
    let fail = false;
    await open(
      { bots: [makeBot(1, "BA", pins)] },
      {
        routes: {
          "GET /api/bots": () =>
            fail
              ? { status: 500, body: { error: { code: "internal_error", message: "Failed." } } }
              : { body: [makeBot(1, "BA", pins)] },
          [`GET /api/skills/${SKILL_ID}/versions`]: () => ({ body: makeVersions(3) }),
          [`GET /api/skills/${SKILL_ID}/diff`]: () => ({
            body: { body: [{ op: "add", text: "New line." }], description: null },
          }),
          [`PUT /api/bots/${BA_ID}/skills/${alpha.skill_id}`]: async () => {
            const answer = await held.promise;
            return answer;
          },
          // The toggle got to the server first, so this answer has both changes.
          [`PUT /api/bots/${BA_ID}/skills/${SKILL_ID}`]: () => ({
            body: makeBot(1, "BA", [zetaV3, alphaOff]),
          }),
        },
        path: "/bots/ba?tab=skills",
      },
    );
    await heading();
    // Every refresh fails, so only the answers could change the list.
    fail = true;
    click(screen.getByRole("switch", { name: "Always load Alpha" }));
    click(screen.getByRole("button", { name: "v3 available" }));
    const dialog = await screen.findByRole("dialog", { name: "Upgrade Zeta to v3?" });
    click(await within(dialog).findByRole("button", { name: "Upgrade to v3" }));
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "v3 available" })).toBeNull();
    });
    // The toggle's answer comes last, with Zeta still on v2.
    await held.answer({ body: makeBot(1, "BA", [zeta, alphaOff]) });
    await waitFor(() => {
      expect(
        screen.getByRole("switch", { name: "Always load Alpha" }).hasAttribute("data-disabled"),
      ).toBe(false);
    });
    expect(screen.queryByRole("button", { name: "v3 available" })).toBeNull();
  });

  it("keeps a newer version of the same skill when a late Always load answer comes after it", async () => {
    const held = heldAnswer();
    const [zeta] = pins;
    if (zeta === undefined) throw new Error("no pins");
    const state = { bots: [makeBot(1, "BA", [zeta])] };
    let fail = false;
    await open(state, {
      routes: {
        "GET /api/bots": () =>
          fail
            ? { status: 500, body: { error: { code: "internal_error", message: "Failed." } } }
            : { body: state.bots },
        [`PUT /api/bots/${BA_ID}/skills/${SKILL_ID}`]: async () => {
          const answer = await held.promise;
          return answer;
        },
      },
      path: "/bots/ba?tab=skills",
    });
    await heading();
    click(screen.getByRole("switch", { name: "Always load Zeta" }));
    // The toggle got to the server first; then another tab moved Zeta to v3, and the page
    // loaded that before the toggle's answer came.
    state.bots = [
      makeBot(1, "BA", [makePin({ skill_name: "Zeta", skill_slug: "zeta", always_load: true })]),
    ];
    refocus();
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "v3 available" })).toBeNull();
    });
    // The refresh after the answer fails, so only the answer could change the list.
    fail = true;
    await held.answer({ body: makeBot(1, "BA", [{ ...zeta, always_load: true }]) });
    await waitFor(() => {
      expect(
        screen.getByRole("switch", { name: "Always load Zeta" }).hasAttribute("data-disabled"),
      ).toBe(false);
    });
    expect(screen.queryByRole("button", { name: "v3 available" })).toBeNull();
  });

  it("keeps a newer opposite toggle from another tab when the late Always load answer comes after it", async () => {
    const held = heldAnswer();
    const [zeta] = pins;
    if (zeta === undefined) throw new Error("no pins");
    const state = { bots: [makeBot(1, "BA", [zeta])] };
    let fail = false;
    const { queryClient } = await open(state, {
      routes: {
        "GET /api/bots": () =>
          fail
            ? { status: 500, body: { error: { code: "internal_error", message: "Failed." } } }
            : { body: state.bots },
        [`PUT /api/bots/${BA_ID}/skills/${SKILL_ID}`]: async () => {
          const answer = await held.promise;
          return answer;
        },
      },
      path: "/bots/ba?tab=skills",
    });
    await heading();
    click(screen.getByRole("switch", { name: "Always load Zeta" }));
    // The toggle got to the server first (on); then another tab turned it off again, and the
    // page loaded that (off, the same value the toggle expected) before the toggle's answer came.
    const loadsBefore = queryClient.getQueryState(listBotsQueryKey())?.dataUpdateCount ?? 0;
    refocus();
    await waitFor(() => {
      expect(queryClient.getQueryState(listBotsQueryKey())?.dataUpdateCount).toBeGreaterThan(
        loadsBefore,
      );
    });
    // The refresh after the answer fails, so only the answer could change the list.
    fail = true;
    await held.answer({ body: makeBot(1, "BA", [{ ...zeta, always_load: true }]) });
    await waitFor(() => {
      expect(
        screen.getByRole("switch", { name: "Always load Zeta" }).hasAttribute("data-disabled"),
      ).toBe(false);
    });
    const cached = queryClient.getQueryData<Bot[]>(listBotsQueryKey())?.[0]?.pins[0];
    expect(cached?.always_load).toBe(false);
    expect(
      screen.getByRole("switch", { name: "Always load Zeta" }).getAttribute("aria-checked"),
    ).toBe("false");
  });

  // PR #59 review: the tab's load counter stopped when the tab closed, but its request went on.
  it("keeps a newer opposite toggle when the late Always load answer comes after the owner left the tab", async () => {
    const held = heldAnswer();
    const [zeta] = pins;
    if (zeta === undefined) throw new Error("no pins");
    const state = { bots: [makeBot(1, "BA", [zeta])] };
    let fail = false;
    const { queryClient, router } = await open(state, {
      routes: {
        "GET /api/bots": () =>
          fail
            ? { status: 500, body: { error: { code: "internal_error", message: "Failed." } } }
            : { body: state.bots },
        [`PUT /api/bots/${BA_ID}/skills/${SKILL_ID}`]: async () => {
          const answer = await held.promise;
          return answer;
        },
      },
      path: "/bots/ba?tab=skills",
    });
    await heading();
    click(screen.getByRole("switch", { name: "Always load Zeta" }));
    await waitFor(() => {
      expect(fake?.sent("PUT", `/api/bots/${BA_ID}/skills/${SKILL_ID}`)).toHaveLength(1);
    });
    await act(() => router.navigate({ to: "/bots/$slug", params: { slug: "ba" }, search: {} }));
    // The toggle got to the server first (on); then another tab turned it off again, and the
    // page loaded that (off, the same value the toggle expected) before the toggle's answer came.
    const loadsBefore = queryClient.getQueryState(listBotsQueryKey())?.dataUpdateCount ?? 0;
    refocus();
    await waitFor(() => {
      expect(queryClient.getQueryState(listBotsQueryKey())?.dataUpdateCount).toBeGreaterThan(
        loadsBefore,
      );
    });
    // The refresh after the answer fails, so only the answer could change the list.
    fail = true;
    const loads = fake?.sent("GET", "/api/bots").length ?? 0;
    await held.answer({ body: makeBot(1, "BA", [{ ...zeta, always_load: true }]) });
    await waitFor(() => {
      expect(fake?.sent("GET", "/api/bots").length).toBeGreaterThan(loads);
    });
    expect(queryClient.getQueryData<Bot[]>(listBotsQueryKey())?.[0]?.pins[0]?.always_load).toBe(
      false,
    );
  });

  it("keeps a newer Always load toggle when a late Profile answer comes after it (UI-6.3)", async () => {
    const held = heldAnswer();
    const [zeta] = pins;
    if (zeta === undefined) throw new Error("no pins");
    const state = { bots: [makeBot(1, "BA", [zeta])] };
    let fail = false;
    await open(state, {
      routes: {
        "GET /api/bots": () =>
          fail
            ? { status: 500, body: { error: { code: "internal_error", message: "Failed." } } }
            : { body: state.bots },
        [`PATCH /api/bots/${BA_ID}`]: async () => {
          const answer = await held.promise;
          return answer;
        },
        [`PUT /api/bots/${BA_ID}/skills/${SKILL_ID}`]: () => ({
          body: { ...makeBot(1, "BA", [{ ...zeta, always_load: true }]), row_version: 2 },
        }),
      },
    });
    await heading();
    type({ label: "Description", text: "Mine." });
    click(screen.getByRole("button", { name: "Save" }));
    // The owner goes to Skills while Save waits, and lets the edit go.
    click(screen.getByRole("tab", { name: /Skills/ }));
    const dialog = await screen.findByRole("alertdialog", { name: "Leave without saving? 👀" });
    click(within(dialog).getByRole("button", { name: "Let them go" }));
    const toggle = await screen.findByRole("switch", { name: "Always load Zeta" });
    // Every refresh fails, so only the answers could change the list.
    fail = true;
    const loadsBefore = fake?.sent("GET", "/api/bots").length ?? 0;
    click(toggle);
    // The toggle's answer came, and the refresh after it failed.
    await waitFor(() => {
      expect(fake?.sent("GET", "/api/bots").length).toBeGreaterThan(loadsBefore);
    });
    await waitFor(() => {
      expect(
        screen.getByRole("switch", { name: "Always load Zeta" }).getAttribute("aria-checked"),
      ).toBe("true");
    });
    // The Profile save got to the server before the toggle: its answer has the pin as it was.
    const loads = fake?.sent("GET", "/api/bots").length ?? 0;
    await held.answer({
      body: { ...makeBot(1, "BA", [zeta]), row_version: 2, description: "Mine." },
    });
    await waitFor(() => {
      // The answer was handled: a successful save refreshes the list.
      expect(fake?.sent("GET", "/api/bots").length).toBeGreaterThan(loads);
    });
    expect(
      screen.getByRole("switch", { name: "Always load Zeta" }).getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("keeps a newer health when a late Profile answer comes after it", async () => {
    const held = heldAnswer();
    const [zeta] = pins;
    if (zeta === undefined) throw new Error("no pins");
    const deprecated = { ...zeta, deprecated: true };
    const attention = { level: "needs_attention", reason: "deprecated_skill" } as const;
    const state: { bots: Bot[] } = {
      bots: [{ ...makeBot(1, "BA", [deprecated]), health: attention }],
    };
    let fail = false;
    const { queryClient } = await open(state, {
      routes: {
        "GET /api/bots": () =>
          fail
            ? { status: 500, body: { error: { code: "internal_error", message: "Failed." } } }
            : { body: state.bots },
        [`PATCH /api/bots/${BA_ID}`]: async () => {
          const answer = await held.promise;
          return answer;
        },
      },
    });
    await heading();
    type({ label: "Description", text: "Mine." });
    click(screen.getByRole("button", { name: "Save" }));
    // The deprecated pin leaves the bot in another place while Save waits: no row_version.
    state.bots = [makeBot(1, "BA")];
    refocus();
    await waitFor(() => {
      expect(queryClient.getQueryData<Bot[]>(listBotsQueryKey())?.[0]?.health).toBeNull();
    });
    // Every refresh fails, so only the answer could change the list.
    fail = true;
    const loads = fake?.sent("GET", "/api/bots").length ?? 0;
    // The Profile save got to the server first: its answer has the old pin and health.
    await held.answer({
      body: {
        ...makeBot(1, "BA", [deprecated]),
        health: attention,
        row_version: 2,
        description: "Mine.",
      },
    });
    await waitFor(() => {
      expect(fake?.sent("GET", "/api/bots").length).toBeGreaterThan(loads);
    });
    const cached = queryClient.getQueryData<Bot[]>(listBotsQueryKey())?.[0];
    expect(cached?.row_version).toBe(2);
    expect(cached?.health).toBeNull();
  });

  it("shows an Upgrade that fails after the skill left the bot in another place as a toast", async () => {
    const held = heldAnswer();
    const state = { bots: [makeBot(1, "BA", pins.slice(0, 1))] };
    await open(state, {
      routes: {
        [`GET /api/skills/${SKILL_ID}/versions`]: () => ({ body: makeVersions(3) }),
        [`GET /api/skills/${SKILL_ID}/diff`]: () => ({
          body: { body: [{ op: "add", text: "New line." }], description: null },
        }),
        [`PUT /api/bots/${BA_ID}/skills/${SKILL_ID}`]: async () => {
          const answer = await held.promise;
          return answer;
        },
      },
      path: "/bots/ba?tab=skills",
    });
    await heading();
    click(screen.getByRole("button", { name: "v3 available" }));
    const dialog = await screen.findByRole("dialog", { name: "Upgrade Zeta to v3?" });
    click(await within(dialog).findByRole("button", { name: "Upgrade to v3" }));
    // Another tab removes Zeta while the Upgrade waits; the page loads that.
    state.bots = [makeBot(1, "BA", [])];
    refocus();
    await screen.findByText("BA has no skills yet.");
    await held.answer({
      status: 500,
      body: { error: { code: "internal_error", message: "The app could not save it." } },
    });
    expect(await screen.findByText("The app could not save it.")).toBeTruthy();
  });

  it("shows a version move that fails after the owner left the page as a toast", async () => {
    const held = heldAnswer();
    const { router } = await open(
      { bots: [makeBot(1, "BA", pins.slice(0, 1))] },
      {
        routes: {
          [`GET /api/skills/${SKILL_ID}/versions`]: () => ({ body: makeVersions(3) }),
          [`GET /api/skills/${SKILL_ID}/diff`]: () => ({
            body: { body: [{ op: "add", text: "New line." }], description: null },
          }),
          [`PUT /api/bots/${BA_ID}/skills/${SKILL_ID}`]: async () => {
            const answer = await held.promise;
            return answer;
          },
        },
        path: "/bots/ba?tab=skills",
      },
    );
    await heading();
    click(screen.getByRole("button", { name: "v3 available" }));
    const dialog = await screen.findByRole("dialog", { name: "Upgrade Zeta to v3?" });
    click(await within(dialog).findByRole("button", { name: "Upgrade to v3" }));
    await act(() => router.navigate({ to: "/" }));
    await held.answer({
      status: 500,
      body: { error: { code: "internal_error", message: "The app could not save it." } },
    });
    expect(await screen.findByText("The app could not save it.")).toBeTruthy();
  });

  it("+ Add shows the stale toast for a skill added in another place, and closes", async () => {
    await open(
      { bots: [makeBot(1, "BA", [makePin()])] },
      {
        routes: {
          "GET /api/skills": () => ({ body: [makeSkill(), writing] }),
          [`GET /api/skills/${writing.id}/versions`]: () => ({
            body: makeVersions(2).map((v) => ({ ...v, skill_id: writing.id })),
          }),
          [`PUT /api/bots/${BA_ID}/skills/${writing.id}`]: () => ({
            status: 409,
            body: { error: { code: "stale_write", message: "Changed.", current: null } },
          }),
        },
        path: "/bots/ba?tab=skills",
      },
    );
    await heading();
    click(screen.getByRole("button", { name: "Add" }));
    const dialog = await screen.findByRole("dialog", { name: "Add skills to BA" });
    const list = await within(dialog).findByRole("list", { name: "Skills to add" });
    click(await within(list).findByRole("checkbox"));
    click(within(dialog).getByRole("button", { name: "Add 1" }));
    expect(
      await screen.findByText("Writing changed in another place. Check it and try again."),
    ).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Add skills to BA" })).toBeNull();
    });
  });

  it("says when a pin changed in another place, and loads the newest pins", async () => {
    await open(
      { bots: [makeBot(1, "BA", pins.slice(0, 1))] },
      {
        routes: {
          [`PUT /api/bots/${BA_ID}/skills/${SKILL_ID}`]: () => ({
            status: 409,
            body: { error: { code: "stale_write", message: "Changed.", current: null } },
          }),
        },
        path: "/bots/ba?tab=skills",
      },
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
        routes: {
          "GET /api/skills": () => ({ body: [makeSkill(), writing, deprecated] }),
          [`GET /api/skills/${writing.id}/versions`]: () => ({
            body: makeVersions(2).map((v) => ({ ...v, skill_id: writing.id })),
          }),
          [`PUT /api/bots/${BA_ID}/skills/${writing.id}`]: () => ({
            body: makeBot(1, "BA", [makePin()]),
          }),
        },
        path: "/bots/ba?tab=skills",
      },
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

  it("+ Add says it is loading, not that the bot has every skill, before the list comes", async () => {
    const held = heldAnswer();
    await open(
      { bots: [makeBot(1, "BA", [makePin()])] },
      { routes: { "GET /api/skills": async () => held.promise }, path: "/bots/ba?tab=skills" },
    );
    await heading();
    click(screen.getByRole("button", { name: "Add" }));
    const dialog = await screen.findByRole("dialog", { name: "Add skills to BA" });
    expect(within(dialog).getByText("Loading the skills.")).toBeTruthy();
    expect(within(dialog).queryByText(/The bot has every active skill/)).toBeNull();
    await held.answer({ body: [makeSkill(), writing] });
    const list = await within(dialog).findByRole("list", { name: "Skills to add" });
    await waitFor(() => {
      expect(within(list).getAllByRole("checkbox")).toHaveLength(1);
    });
    expect(within(dialog).queryByText("Loading the skills.")).toBeNull();
  });

  // Fresh review of the audit: the switch forgot its change on its way when the tab came back.
  it("keeps the Always load value on its way when the owner leaves the tab and comes back", async () => {
    const held = heldAnswer();
    const [zeta] = pins;
    if (zeta === undefined) throw new Error("no pins");
    const state = { bots: [makeBot(1, "BA", [zeta])] };
    const { router } = await open(state, {
      routes: {
        [`PUT /api/bots/${BA_ID}/skills/${SKILL_ID}`]: async () => {
          const answer = await held.promise;
          return answer;
        },
      },
      path: "/bots/ba?tab=skills",
    });
    await heading();
    click(screen.getByRole("switch", { name: "Always load Zeta" }));
    await waitFor(() => {
      expect(fake?.sent("PUT", `/api/bots/${BA_ID}/skills/${SKILL_ID}`)).toHaveLength(1);
    });
    await act(() => router.navigate({ to: "/bots/$slug", params: { slug: "ba" }, search: {} }));
    await act(() =>
      router.navigate({ to: "/bots/$slug", params: { slug: "ba" }, search: { tab: "skills" } }),
    );
    const back = await screen.findByRole("switch", { name: "Always load Zeta" });
    expect(back.getAttribute("aria-checked")).toBe("true");
    expect(back.hasAttribute("data-disabled")).toBe(true);
    state.bots = [makeBot(1, "BA", [{ ...zeta, always_load: true }])];
    await held.answer({ body: makeBot(1, "BA", [{ ...zeta, always_load: true }]) });
    await waitFor(() => {
      expect(
        screen.getByRole("switch", { name: "Always load Zeta" }).hasAttribute("data-disabled"),
      ).toBe(false);
    });
    expect(
      screen.getByRole("switch", { name: "Always load Zeta" }).getAttribute("aria-checked"),
    ).toBe("true");
  });

  // Owner, 2026-11-03 (Q2): the row goes at once, and comes back with a toast if Remove fails.
  it("takes a removed skill's row away at once, also over a refresh before the answer", async () => {
    const held = heldAnswer();
    const state = { bots: [makeBot(1, "BA", [makePin()])] };
    await open(state, {
      routes: {
        [`DELETE /api/bots/${BA_ID}/skills/${SKILL_ID}`]: async () => {
          const answer = await held.promise;
          return answer;
        },
      },
      path: "/bots/ba?tab=skills",
    });
    await heading();
    click(screen.getByRole("button", { name: /Actions for/ }));
    click(await screen.findByRole("menuitem", { name: "Remove" }));
    await waitFor(() => {
      expect(screen.queryByRole("switch", { name: /Always load/ })).toBeNull();
    });
    const loads = fake?.sent("GET", "/api/bots").length ?? 0;
    refocus();
    await waitFor(() => {
      expect(fake?.sent("GET", "/api/bots").length).toBeGreaterThan(loads);
    });
    await act(() => Promise.resolve());
    expect(screen.queryByRole("switch", { name: /Always load/ })).toBeNull();
    state.bots = [makeBot(1, "BA")];
    await held.answer({ status: 204 });
    expect(await screen.findByText("BA has no skills yet.")).toBeTruthy();
  });

  // Second fresh review: a skill added back while its Remove waited stayed hidden.
  it("shows a skill the owner adds back while its Remove is on its way", async () => {
    const held = heldAnswer();
    const pin = makePin();
    const state = { bots: [makeBot(1, "BA", [pin])] };
    await open(state, {
      routes: {
        "GET /api/skills": () => ({ body: [makeSkill()] }),
        [`GET /api/skills/${SKILL_ID}/versions`]: () => ({ body: makeVersions(3) }),
        [`DELETE /api/bots/${BA_ID}/skills/${SKILL_ID}`]: async () => {
          state.bots = [makeBot(1, "BA")];
          const answer = await held.promise;
          return answer;
        },
        [`PUT /api/bots/${BA_ID}/skills/${SKILL_ID}`]: () => {
          state.bots = [makeBot(1, "BA", [pin])];
          return { body: makeBot(1, "BA", [pin]) };
        },
      },
      path: "/bots/ba?tab=skills",
    });
    await heading();
    click(screen.getByRole("button", { name: /Actions for/ }));
    click(await screen.findByRole("menuitem", { name: "Remove" }));
    await screen.findByText("BA has no skills yet.");
    await waitFor(() => {
      expect(fake?.sent("DELETE", `/api/bots/${BA_ID}/skills/${SKILL_ID}`)).toHaveLength(1);
    });
    click(screen.getByRole("button", { name: "Add" }));
    const dialog = await screen.findByRole("dialog", { name: "Add skills to BA" });
    const list = await within(dialog).findByRole("list", { name: "Skills to add" });
    click(await within(list).findByRole("checkbox"));
    click(within(dialog).getByRole("button", { name: "Add 1" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Add skills to BA" })).toBeNull();
    });
    expect(await screen.findByRole("switch", { name: /Always load/ })).toBeTruthy();
    await held.answer({ status: 204 });
  });

  it("brings a removed skill's row back with a toast when Remove fails", async () => {
    const held = heldAnswer();
    const state = { bots: [makeBot(1, "BA", [makePin()])] };
    await open(state, {
      routes: {
        [`DELETE /api/bots/${BA_ID}/skills/${SKILL_ID}`]: async () => {
          const answer = await held.promise;
          return answer;
        },
      },
      path: "/bots/ba?tab=skills",
    });
    await heading();
    click(screen.getByRole("button", { name: /Actions for/ }));
    click(await screen.findByRole("menuitem", { name: "Remove" }));
    await waitFor(() => {
      expect(screen.queryByRole("switch", { name: /Always load/ })).toBeNull();
    });
    await held.answer({
      status: 500,
      body: { error: { code: "internal_error", message: "Something failed." } },
    });
    expect(await screen.findByText("Something failed.")).toBeTruthy();
    expect(await screen.findByRole("switch", { name: /Always load/ })).toBeTruthy();
  });

  it("removes a skill without asking", async () => {
    await open(
      { bots: [makeBot(1, "BA", [makePin()])] },
      {
        routes: { [`DELETE /api/bots/${BA_ID}/skills/${SKILL_ID}`]: () => ({ status: 204 }) },
        path: "/bots/ba?tab=skills",
      },
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
      { path: "/bots/ba?tab=skills" },
    );
    await heading();
    expect(screen.getByText("Deprecated")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /available/ })).toBeNull();
  });
});
