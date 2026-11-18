import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeApi, heldAnswer } from "../../../test/fake-api.ts";
import { BOT_SETTINGS, makeSkill, makeVersions, SKILL_ID, typeId } from "../../../test/fixtures.ts";
import { renderApp } from "../../../test/render-app.tsx";
import { SKILL_OR_BOT_QUERIES } from "../../lib/api/operation-queries.ts";
import { CONFLICT_TEXT } from "./save-error.ts";

// The audit of 2026-11-05, rows 1a, 3, 6 and 7, and the P3 "types an edit back during a conflict":
// the orders of a Save, a Delete, a Clone or an Import Apply with a live refresh or a leave.

type Handler = Parameters<typeof fakeApi>[0][string];

const OLD_BODY = "## Steps\n1. Read the brief.";
const NEW_BODY = "## Steps\n1. Read the brief.\n2. Ask.";
const VERSION_ROUTE = `POST /api/skills/${SKILL_ID}/versions`;
const RENAME_ROUTE = `PATCH /api/skills/${SKILL_ID}`;
const TRASH_ROUTE = `POST /api/skills/${SKILL_ID}/trash`;

const v4 = (body = NEW_BODY) =>
  makeSkill({
    latest_version: { ...makeSkill().latest_version, version: 4 },
    row_version: 2,
    body_md: body,
  });

const click = (element: HTMLElement) => {
  act(() => {
    fireEvent.click(element);
  });
};

const typeBody = (value: string) => {
  act(() => {
    fireEvent.change(screen.getByLabelText("Body", { exact: true }), { target: { value } });
  });
};

const bodyText = () => {
  const field = screen.getByLabelText("Body", { exact: true });
  if (!(field instanceof HTMLTextAreaElement)) throw new Error("Body is not a text area");
  return field.value;
};

// Time for a late move or a late change to happen, when a test expects none.
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

describe("the skill editor, a Save and a live refresh", () => {
  let api: ReturnType<typeof fakeApi> | null = null;
  afterEach(() => {
    api?.restore();
    api = null;
  });

  // Starts on a skill with v3, with the Write tab open. `server` is what the next read answers.
  async function openEditor() {
    const server = { skill: makeSkill(), reads: "good" };
    const held = heldAnswer();
    api = fakeApi({
      "GET /api/settings": () => ({ body: BOT_SETTINGS }),
      "GET /api/skills": () => ({ body: [server.skill] }),
      [`GET /api/skills/${SKILL_ID}`]: () =>
        server.reads === "good"
          ? { body: server.skill }
          : { status: 500, body: { error: { code: "internal_error", message: "Failed." } } },
      [`GET /api/skills/${SKILL_ID}/versions`]: () => ({ body: makeVersions(3) }),
      [`GET /api/skills/${SKILL_ID}/upgrade-candidates`]: () => ({ body: [] }),
      "GET /api/bots": () => ({ body: [] }),
      [VERSION_ROUTE]: () => held.promise,
    });
    const { queryClient, router } = await renderApp("/skills/write-user-stories");
    await screen.findByRole("heading", { name: "Write user stories" }, { timeout: 5000 });
    click(screen.getByRole("tab", { name: "Write" }));
    // A live event: every skill query reads again. Ends when the page shows the new version.
    const refresh = async (skill: ReturnType<typeof makeSkill>) => {
      server.skill = skill;
      await act(() => queryClient.invalidateQueries({ predicate: SKILL_OR_BOT_QUERIES }));
      await settle();
    };
    return { held, refresh, router, server, queryClient };
  }

  const sendSave = async () => {
    typeBody(NEW_BODY);
    click(screen.getByRole("button", { name: "Save as v4" }));
    await waitFor(() => {
      expect(api?.sent("POST", `/api/skills/${SKILL_ID}/versions`)).toHaveLength(1);
    });
  };

  it("row 1a: keeps text typed back during a Save when a refresh comes first", async () => {
    const { held, refresh } = await openEditor();
    typeBody(NEW_BODY);
    click(screen.getByRole("button", { name: "Save as v4" }));
    await waitFor(() => {
      expect(api?.sent("POST", `/api/skills/${SKILL_ID}/versions`)).toHaveLength(1);
    });
    // All fields are back at the last saved text, and the refresh brings the Save's own version.
    typeBody(OLD_BODY);
    await refresh(v4());
    expect(bodyText()).toBe(OLD_BODY);
    await held.answer({ status: 201, body: v4() });
    await settle();
    // The text the Save sent is saved, so the text typed back is a change, and the page says so.
    expect(bodyText()).toBe(OLD_BODY);
    expect(screen.getByText("1 change not saved")).toBeTruthy();
    expect(screen.queryByText("All changes are saved.")).toBeNull();
    expect(screen.queryByText(CONFLICT_TEXT)).toBeNull();
  });

  it("takes the new text when a Save fails after the text was typed back and a refresh came", async () => {
    const { held, refresh } = await openEditor();
    typeBody(NEW_BODY);
    click(screen.getByRole("button", { name: "Save as v4" }));
    await waitFor(() => {
      expect(api?.sent("POST", `/api/skills/${SKILL_ID}/versions`)).toHaveLength(1);
    });
    typeBody(OLD_BODY);
    const other = "Text from another place.";
    await refresh(v4(other));
    expect(bodyText()).toBe(OLD_BODY);
    await held.answer({
      status: 409,
      body: { error: { code: "stale_write", message: "Stale." } },
    });
    await waitFor(() => {
      expect(bodyText()).toBe(other);
    });
    expect(screen.getByText("All changes are saved.")).toBeTruthy();
  });

  it("P3: takes the new text when an edit is typed back during a conflict", async () => {
    const { refresh } = await openEditor();
    typeBody("My edit.");
    const other = "Text from another place.";
    await refresh(v4(other));
    expect(bodyText()).toBe("My edit.");
    expect(screen.getByText(CONFLICT_TEXT)).toBeTruthy();
    typeBody(OLD_BODY);
    await waitFor(() => {
      expect(bodyText()).toBe(other);
    });
    expect(screen.queryByText(CONFLICT_TEXT)).toBeNull();
    expect(screen.getByText("All changes are saved.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Skill actions" })).toBeTruthy();
  });

  it("shows no conflict when the Save's own event comes before its answer", async () => {
    const { held, refresh } = await openEditor();
    typeBody(NEW_BODY);
    click(screen.getByRole("button", { name: "Save as v4" }));
    await waitFor(() => {
      expect(api?.sent("POST", `/api/skills/${SKILL_ID}/versions`)).toHaveLength(1);
    });
    await refresh(v4());
    expect(screen.queryByText(CONFLICT_TEXT)).toBeNull();
    await held.answer({ status: 201, body: v4() });
    await settle();
    expect(screen.queryByText(CONFLICT_TEXT)).toBeNull();
    expect(screen.getByText("All changes are saved.")).toBeTruthy();
    expect(bodyText()).toBe(NEW_BODY);
  });

  it("drops the conflict text with the old edit when the editor takes the new text", async () => {
    const { held, refresh } = await openEditor();
    typeBody("Mine.");
    click(screen.getByRole("button", { name: "Save as v4" }));
    await waitFor(() => {
      expect(api?.sent("POST", `/api/skills/${SKILL_ID}/versions`)).toHaveLength(1);
    });
    await held.answer({
      status: 409,
      body: { error: { code: "stale_write", message: "Stale." } },
    });
    await refresh(v4("Text from another place."));
    expect(screen.getByText(CONFLICT_TEXT)).toBeTruthy();
    typeBody(OLD_BODY);
    await waitFor(() => {
      expect(bodyText()).toBe("Text from another place.");
    });
    typeBody("A new edit.");
    await settle();
    expect(screen.queryByText(CONFLICT_TEXT)).toBeNull();
    expect(screen.getByRole("button", { name: /^Save as/ })).toHaveProperty("disabled", false);
  });

  it("says when a Save fails after the text was typed back", async () => {
    const { held } = await openEditor();
    typeBody(NEW_BODY);
    click(screen.getByRole("button", { name: "Save as v4" }));
    await waitFor(() => {
      expect(api?.sent("POST", `/api/skills/${SKILL_ID}/versions`)).toHaveLength(1);
    });
    typeBody(OLD_BODY);
    await held.answer({
      status: 500,
      body: { error: { code: "internal_error", message: "Something failed." } },
    });
    expect(await screen.findByText("Could not save Write user stories. Try again.")).toBeTruthy();
    typeBody("A new edit.");
    await settle();
    expect(screen.queryByText("Something failed.")).toBeNull();
  });

  it("keeps Discard off while a Save waits", async () => {
    await openEditor();
    await sendSave();
    const discard = screen.getByRole("button", { name: "Discard" });
    click(discard);
    expect(bodyText(), "the text after a click on Discard while a Save waits").toBe(NEW_BODY);
    expect(discard.getAttribute("aria-disabled")).toBe("true");
  });

  it('says "1 change not saved" while a Save waits and the text is typed back', async () => {
    await openEditor();
    await sendSave();
    typeBody(OLD_BODY);
    const line = screen.queryByText("1 change not saved");
    expect(line, "the change of the Save on its way").toBeTruthy();
  });

  it("asks before leaving while a Save waits and the text is typed back", async () => {
    const { router } = await openEditor();
    await sendSave();
    typeBody(OLD_BODY);
    act(() => {
      void router.navigate({ to: "/bots" });
    });
    await settle();
    const question = screen.queryByRole("alertdialog", { name: "Leave without saving? 👀" });
    expect(question, "the leave question while a Save waits").toBeTruthy();
  });

  it("puts back the text of an answered Save on Discard while its refresh is slow", async () => {
    const { held } = await openEditor();
    await sendSave();
    await held.answer({ status: 201, body: v4() });
    await settle();
    typeBody("Another edit.");
    click(screen.getByRole("button", { name: "Discard" }));
    expect(bodyText(), "the text after Discard").toBe(NEW_BODY);
  });

  it("shows no conflict after Discard, an edit and the slow refresh of a Save", async () => {
    const { held, refresh } = await openEditor();
    await sendSave();
    await held.answer({ status: 201, body: v4() });
    await settle();
    typeBody("Another edit.");
    click(screen.getByRole("button", { name: "Discard" }));
    typeBody("A third edit.");
    await refresh(v4());
    expect(screen.queryByText(CONFLICT_TEXT), "the conflict after the slow refresh").toBeNull();
  });

  it("sends the base of the answered Save after Discard when the refresh fails", async () => {
    const { held, server, queryClient } = await openEditor();
    await sendSave();
    await held.answer({ status: 201, body: v4() });
    await settle();
    typeBody("Another edit.");
    click(screen.getByRole("button", { name: "Discard" }));
    server.reads = "failed";
    await act(() => queryClient.invalidateQueries({ predicate: SKILL_OR_BOT_QUERIES }));
    await settle();
    typeBody("A third edit.");
    click(screen.getByRole("button", { name: /^Save as/ }));
    await waitFor(() => {
      expect(api?.sent("POST", `/api/skills/${SKILL_ID}/versions`)).toHaveLength(2);
    });
    const second = api?.sent("POST", `/api/skills/${SKILL_ID}/versions`)[1];
    expect(second?.body, "the base of the second Save").toMatchObject({ base_version: 4 });
  });

  it("shows no conflict when the refresh after a Save has not come", async () => {
    const { held } = await openEditor();
    typeBody(NEW_BODY);
    click(screen.getByRole("button", { name: "Save as v4" }));
    await waitFor(() => {
      expect(api?.sent("POST", `/api/skills/${SKILL_ID}/versions`)).toHaveLength(1);
    });
    await held.answer({ status: 201, body: v4() });
    await settle();
    expect(screen.queryByText(CONFLICT_TEXT)).toBeNull();
    expect(bodyText()).toBe(NEW_BODY);
  });

  it("shows no conflict with text typed after the Save when the refresh has not come", async () => {
    const { held } = await openEditor();
    typeBody(NEW_BODY);
    click(screen.getByRole("button", { name: "Save as v4" }));
    await waitFor(() => {
      expect(api?.sent("POST", `/api/skills/${SKILL_ID}/versions`)).toHaveLength(1);
    });
    typeBody(`${NEW_BODY}\n3. More.`);
    await held.answer({ status: 201, body: v4() });
    await settle();
    expect(screen.getByText("1 change not saved")).toBeTruthy();
    expect(screen.queryByText(CONFLICT_TEXT)).toBeNull();
  });

  it("keeps text typed after the Save as a change, with no conflict", async () => {
    const { held, refresh } = await openEditor();
    typeBody(NEW_BODY);
    click(screen.getByRole("button", { name: "Save as v4" }));
    await waitFor(() => {
      expect(api?.sent("POST", `/api/skills/${SKILL_ID}/versions`)).toHaveLength(1);
    });
    typeBody(`${NEW_BODY}\n3. More.`);
    await refresh(v4());
    await held.answer({ status: 201, body: v4() });
    await settle();
    expect(bodyText()).toBe(`${NEW_BODY}\n3. More.`);
    expect(screen.getByText("1 change not saved")).toBeTruthy();
    expect(screen.queryByText(CONFLICT_TEXT)).toBeNull();
  });
});

describe("Delete of a deprecated skill", () => {
  let api: ReturnType<typeof fakeApi> | null = null;
  afterEach(() => {
    api?.restore();
    api = null;
  });

  const deprecated = makeSkill({ deprecated: true, deprecated_at: "2026-10-21T10:00:00.000Z" });
  const OTHER_ID = typeId("skill", 2);
  const other = makeSkill({ id: OTHER_ID, slug: "other-skill", name: "Other skill" });

  async function clickDelete({
    list,
    trash,
    others = [],
  }: {
    // The answer of each list read after the first.
    list: Handler;
    trash: Handler;
    others?: ReturnType<typeof makeSkill>[];
  }) {
    let reads = 0;
    api = fakeApi({
      "GET /api/settings": () => ({ body: BOT_SETTINGS }),
      "GET /api/skills": (request, search) => {
        reads += 1;
        return reads === 1 ? { body: [deprecated, ...others] } : list(request, search);
      },
      [`GET /api/skills/${SKILL_ID}`]: () => ({ body: deprecated }),
      [`GET /api/skills/${SKILL_ID}/versions`]: () => ({ body: makeVersions(3) }),
      [`GET /api/skills/${OTHER_ID}`]: () => ({ body: other }),
      [`GET /api/skills/${OTHER_ID}/versions`]: () => ({ body: makeVersions(1) }),
      "GET /api/bots": () => ({ body: [] }),
      [TRASH_ROUTE]: trash,
    });
    const app = await renderApp("/skills/write-user-stories");
    click(await screen.findByRole("button", { name: "Skill actions" }, { timeout: 5000 }));
    click(await screen.findByRole("menuitem", { name: "Delete skill" }));
    const dialog = await screen.findByRole("alertdialog");
    click(await within(dialog).findByRole("button", { name: "Delete skill" }));
    await waitFor(() => {
      expect(api?.sent("POST", `/api/skills/${SKILL_ID}/trash`)).toHaveLength(1);
    });
    return app;
  }

  it("row 3: shows the empty state and the toast when the list refresh is slow", async () => {
    const list = heldAnswer();
    await clickDelete({
      list: () => list.promise,
      trash: () => ({ status: 200, body: { skill_id: SKILL_ID, removed_bot_ids: [] } }),
    });
    expect(await screen.findByText("Write user stories is in Trash.")).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "No skills yet" })).toBeTruthy();
    expect(screen.queryByText("Page not found")).toBeNull();
    await list.answer({ body: [] });
    await settle();
    expect(screen.getByRole("heading", { name: "No skills yet" })).toBeTruthy();
    expect(screen.getByText("Write user stories is in Trash.")).toBeTruthy();
  });

  it("row 3: shows the empty state and the toast when the list refresh is fast", async () => {
    await clickDelete({
      list: () => ({ body: [] }),
      trash: () => ({ status: 200, body: { skill_id: SKILL_ID, removed_bot_ids: [] } }),
    });
    expect(await screen.findByText("Write user stories is in Trash.")).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "No skills yet" })).toBeTruthy();
    expect(screen.queryByText("Page not found")).toBeNull();
  });

  it("row 3: waits, with no Page not found, when a live event removes the skill before the answer", async () => {
    const trash = heldAnswer();
    const { queryClient } = await clickDelete({
      list: () => ({ body: [] }),
      trash: () => trash.promise,
    });
    await act(() => queryClient.invalidateQueries({ predicate: SKILL_OR_BOT_QUERIES }));
    await settle();
    expect(screen.queryByText("Page not found")).toBeNull();
    await trash.answer({ status: 200, body: { skill_id: SKILL_ID, removed_bot_ids: [] } });
    expect(await screen.findByText("Write user stories is in Trash.")).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "No skills yet" })).toBeTruthy();
    expect(screen.queryByText("Page not found")).toBeNull();
  });

  it("shows Page not found when the skill went in another place and this Delete fails", async () => {
    const trash = heldAnswer();
    const { queryClient } = await clickDelete({
      list: () => ({ body: [] }),
      trash: () => trash.promise,
    });
    await act(() => queryClient.invalidateQueries({ predicate: SKILL_OR_BOT_QUERIES }));
    await settle();
    await trash.answer({
      status: 404,
      body: { error: { code: "not_found", message: "This skill does not exist." } },
    });
    expect(await screen.findByText("Page not found")).toBeTruthy();
  });

  it("opens the next skill when another skill stays", async () => {
    const list = heldAnswer();
    const { router } = await clickDelete({
      list: () => list.promise,
      trash: () => ({ status: 200, body: { skill_id: SKILL_ID, removed_bot_ids: [] } }),
      others: [other],
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/skills/other-skill");
    });
    expect(await screen.findByText("Write user stories is in Trash.")).toBeTruthy();
    expect(screen.queryByText("Page not found")).toBeNull();
  });

  it("shows Page not found when the owner comes back to the deleted skill", async () => {
    const trash = heldAnswer();
    const { router } = await clickDelete({
      list: () => ({ body: [other] }),
      trash: () => trash.promise,
      others: [other],
    });
    click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancel" }));
    await act(() => router.navigate({ to: "/skills/$slug", params: { slug: "other-skill" } }));
    await screen.findByRole("heading", { name: "Other skill" });
    await trash.answer({ status: 200, body: { skill_id: SKILL_ID, removed_bot_ids: [] } });
    await screen.findByText("Write user stories is in Trash.");
    await settle();
    expect(router.state.location.pathname).toBe("/skills/other-skill");
    await act(async () => {
      router.history.back();
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(await screen.findByText("Page not found")).toBeTruthy();
  });

  it("keeps the wait and the toast after the owner left and came back", async () => {
    const trash = heldAnswer();
    const { queryClient, router } = await clickDelete({
      list: () => ({ body: [] }),
      trash: () => trash.promise,
    });
    await act(() => router.navigate({ to: "/bots" }));
    await settle();
    await act(() =>
      router.navigate({ to: "/skills/$slug", params: { slug: "write-user-stories" } }),
    );
    await act(() => queryClient.invalidateQueries({ predicate: SKILL_OR_BOT_QUERIES }));
    await settle();
    expect(screen.queryByText("Page not found")).toBeNull();
    await trash.answer({ status: 200, body: { skill_id: SKILL_ID, removed_bot_ids: [] } });
    expect(await screen.findByText("Write user stories is in Trash.")).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "No skills yet" })).toBeTruthy();
    expect(screen.queryByText("Page not found")).toBeNull();
  });

  // Sends a Delete, leaves and comes back while it waits, and opens the dialog of the return visit.
  async function returnVisitDialog() {
    const trash = heldAnswer();
    const server = { list: [deprecated] };
    const app = await clickDelete({
      list: () => ({ body: server.list }),
      trash: () => trash.promise,
    });
    await act(() => app.router.navigate({ to: "/bots" }));
    await settle();
    await act(() =>
      app.router.navigate({ to: "/skills/$slug", params: { slug: "write-user-stories" } }),
    );
    click(await screen.findByRole("button", { name: "Skill actions" }));
    click(await screen.findByRole("menuitem", { name: "Delete skill" }));
    const dialog = await screen.findByRole("alertdialog");
    return { ...app, trash, server, dialog };
  }

  it("sends no second Delete from the dialog of a return visit while the first waits", async () => {
    const { dialog } = await returnVisitDialog();
    click(within(dialog).getByRole("button", { name: "Delete skill" }));
    await settle();
    expect(api?.sent("POST", `/api/skills/${SKILL_ID}/trash`), "a second Delete").toHaveLength(1);
  });

  it("moves to /skills when the first Delete succeeds while the return visit's dialog is open", async () => {
    const { trash, server, router } = await returnVisitDialog();
    server.list = [];
    await trash.answer({ status: 200, body: { skill_id: SKILL_ID, removed_bot_ids: [] } });
    await settle();
    expect(router.state.location.pathname, "the page after the answer").toBe("/skills");
    expect(await screen.findByText("Write user stories is in Trash.")).toBeTruthy();
  });

  it("turns Delete skill on in the return visit's dialog when the first Delete fails", async () => {
    const { trash, dialog } = await returnVisitDialog();
    await trash.answer({
      status: 500,
      body: { error: { code: "internal_error", message: "Something failed." } },
    });
    await settle();
    click(within(dialog).getByRole("button", { name: "Delete skill" }));
    await settle();
    const sent = api?.sent("POST", `/api/skills/${SKILL_ID}/trash`);
    expect(sent, "the Delete after a failure").toHaveLength(2);
  });

  it("keeps the wait until the page has moved, and an older list load cannot bring the skill back", async () => {
    const trash = heldAnswer();
    const older = heldAnswer();
    let listReads = 0;
    const { queryClient, router } = await clickDelete({
      list: () => {
        listReads += 1;
        return listReads === 1 ? older.promise : { body: [] };
      },
      trash: () => trash.promise,
    });
    act(() => {
      void queryClient.invalidateQueries({ predicate: SKILL_OR_BOT_QUERIES });
    });
    await waitFor(() => {
      expect(listReads).toBe(1);
    });
    const realNavigate = router.navigate.bind(router);
    let releaseMove = () => {};
    const moveHeld = new Promise<void>((resolve) => {
      releaseMove = resolve;
    });
    const hold = vi
      .spyOn(router, "navigate")
      .mockImplementation((options) => moveHeld.then(() => realNavigate(options)));
    await trash.answer({ status: 200, body: { skill_id: SKILL_ID, removed_bot_ids: [] } });
    await older.answer({ body: [deprecated] });
    await settle();
    expect(screen.queryByText("Page not found")).toBeNull();
    await act(async () => {
      releaseMove();
      await moveHeld;
    });
    hold.mockRestore();
    expect(await screen.findByRole("heading", { name: "No skills yet" })).toBeTruthy();
    expect(screen.getByText("Write user stories is in Trash.")).toBeTruthy();
    expect(screen.queryByText("Page not found")).toBeNull();
  });

  it("shows Page not found for another missing skill while a Delete waits", async () => {
    const trash = heldAnswer();
    const { router } = await clickDelete({
      list: () => ({ body: [deprecated] }),
      trash: () => trash.promise,
    });
    await act(() => router.navigate({ to: "/skills/$slug", params: { slug: "no-such-skill" } }));
    expect(await screen.findByText("Page not found")).toBeTruthy();
  });

  it("asks no leave question when a Delete leaves text that another place made read-only", async () => {
    const server = { list: [makeSkill(), other], skill: makeSkill() };
    api = fakeApi({
      "GET /api/settings": () => ({ body: BOT_SETTINGS }),
      "GET /api/skills": () => ({ body: server.list }),
      [`GET /api/skills/${SKILL_ID}`]: () => ({ body: server.skill }),
      [`GET /api/skills/${SKILL_ID}/versions`]: () => ({ body: makeVersions(3) }),
      [`GET /api/skills/${SKILL_ID}/upgrade-candidates`]: () => ({ body: [] }),
      [`GET /api/skills/${OTHER_ID}`]: () => ({ body: other }),
      [`GET /api/skills/${OTHER_ID}/versions`]: () => ({ body: makeVersions(1) }),
      [`GET /api/skills/${OTHER_ID}/upgrade-candidates`]: () => ({ body: [] }),
      "GET /api/bots": () => ({ body: [] }),
      [TRASH_ROUTE]: () => {
        server.list = [other];
        return { status: 200, body: { skill_id: SKILL_ID, removed_bot_ids: [] } };
      },
    });
    const { queryClient, router } = await renderApp("/skills/write-user-stories");
    await screen.findByRole("heading", { name: "Write user stories" }, { timeout: 5000 });
    click(screen.getByRole("tab", { name: "Write" }));
    typeBody("Unsaved text.");
    server.skill = deprecated;
    server.list = [deprecated, other];
    await act(() => queryClient.invalidateQueries({ predicate: SKILL_OR_BOT_QUERIES }));
    await settle();
    click(screen.getByRole("button", { name: "Skill actions" }));
    click(await screen.findByRole("menuitem", { name: "Delete skill" }));
    const dialog = await screen.findByRole("alertdialog");
    click(await within(dialog).findByRole("button", { name: "Delete skill" }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/skills/other-skill");
    });
    await settle();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("stays where the owner went when the answer comes after the owner left", async () => {
    const trash = heldAnswer();
    const { router } = await clickDelete({
      list: () => ({ body: [] }),
      trash: () => trash.promise,
    });
    await act(() => router.navigate({ to: "/bots" }));
    await trash.answer({ status: 200, body: { skill_id: SKILL_ID, removed_bot_ids: [] } });
    expect(await screen.findByText("Write user stories is in Trash.")).toBeTruthy();
    await settle();
    expect(router.state.location.pathname).toBe("/bots");
  });
});

describe("a request that fails after the owner left", () => {
  let api: ReturnType<typeof fakeApi> | null = null;
  afterEach(() => {
    api?.restore();
    api = null;
  });

  // Sends a save or a rename, then leaves through the leave question. Ends on `/bots`.
  async function saveThenLeave({ route, edit }: { route: string; edit: () => void }) {
    const held = heldAnswer();
    const skill = makeSkill();
    api = fakeApi({
      "GET /api/settings": () => ({ body: BOT_SETTINGS }),
      "GET /api/skills": () => ({ body: [skill] }),
      [`GET /api/skills/${SKILL_ID}`]: () => ({ body: skill }),
      [`GET /api/skills/${SKILL_ID}/versions`]: () => ({ body: makeVersions(3) }),
      "GET /api/bots": () => ({ body: [] }),
      [route]: () => held.promise,
    });
    const { router } = await renderApp("/skills/write-user-stories");
    await screen.findByRole("heading", { name: "Write user stories" }, { timeout: 5000 });
    click(screen.getByRole("tab", { name: "Write" }));
    edit();
    const [method = "", path = ""] = route.split(" ");
    const button = screen.getByRole("button", { name: /^Save/ });
    click(button);
    await waitFor(() => {
      expect(api?.sent(method, path)).toHaveLength(1);
    });
    act(() => {
      void router.navigate({ to: "/bots" });
    });
    const question = await screen.findByRole("alertdialog", { name: "Leave without saving? 👀" });
    click(within(question).getByRole("button", { name: "Let them go" }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/bots");
    });
    return held;
  }

  const editBody = () => {
    typeBody(NEW_BODY);
  };
  const editName = () => {
    act(() => {
      fireEvent.change(screen.getByLabelText("Name", { exact: true }), {
        target: { value: "A new name" },
      });
    });
  };

  it("row 6: says when a Save fails", async () => {
    const held = await saveThenLeave({ route: VERSION_ROUTE, edit: editBody });
    await held.answer({
      status: 500,
      body: { error: { code: "internal_error", message: "Something failed." } },
    });
    expect(await screen.findByText("Could not save Write user stories. Try again.")).toBeTruthy();
  });

  it("row 6: says when a Save fails as stale", async () => {
    const held = await saveThenLeave({ route: VERSION_ROUTE, edit: editBody });
    await held.answer({
      status: 409,
      body: { error: { code: "stale_write", message: "Stale." } },
    });
    expect(
      await screen.findByText(
        "Write user stories changed in another place, so the app did not save your change.",
      ),
    ).toBeTruthy();
  });

  it("row 6: says which field a refused Save names", async () => {
    const held = await saveThenLeave({ route: VERSION_ROUTE, edit: editBody });
    await held.answer({
      status: 422,
      body: {
        error: { code: "sensitive_data", message: "Line 2 holds a password.", field: "body_md" },
      },
    });
    expect(
      await screen.findByText("Could not save Write user stories: Line 2 holds a password."),
    ).toBeTruthy();
  });

  it("row 6: gives the reason when a refused Save names the changelog", async () => {
    const held = await saveThenLeave({ route: VERSION_ROUTE, edit: editBody });
    await held.answer({
      status: 422,
      body: {
        error: { code: "sensitive_data", message: "The note holds a key.", field: "changelog" },
      },
    });
    expect(
      await screen.findByText("Could not save Write user stories: The note holds a key."),
    ).toBeTruthy();
  });

  it("row 6: says when a rename fails", async () => {
    const held = await saveThenLeave({ route: RENAME_ROUTE, edit: editName });
    await held.answer({
      status: 500,
      body: { error: { code: "internal_error", message: "Something failed." } },
    });
    expect(await screen.findByText("Could not save Write user stories. Try again.")).toBeTruthy();
  });

  it("shows a failed Save in the save bar, with no toast, while the owner stays", async () => {
    const held = heldAnswer();
    const skill = makeSkill();
    api = fakeApi({
      "GET /api/settings": () => ({ body: BOT_SETTINGS }),
      "GET /api/skills": () => ({ body: [skill] }),
      [`GET /api/skills/${SKILL_ID}`]: () => ({ body: skill }),
      [`GET /api/skills/${SKILL_ID}/versions`]: () => ({ body: makeVersions(3) }),
      "GET /api/bots": () => ({ body: [] }),
      [VERSION_ROUTE]: () => held.promise,
    });
    await renderApp("/skills/write-user-stories");
    await screen.findByRole("heading", { name: "Write user stories" }, { timeout: 5000 });
    click(screen.getByRole("tab", { name: "Write" }));
    typeBody(NEW_BODY);
    click(screen.getByRole("button", { name: "Save as v4" }));
    await waitFor(() => {
      expect(api?.sent("POST", `/api/skills/${SKILL_ID}/versions`)).toHaveLength(1);
    });
    await held.answer({
      status: 500,
      body: { error: { code: "internal_error", message: "Something failed." } },
    });
    expect(await screen.findByText("Something failed.")).toBeTruthy();
    expect(screen.queryByText("Could not save Write user stories. Try again.")).toBeNull();
  });

  // The development build mounts each page two times (`<StrictMode>` in `main.tsx`).
  it("shows a failed Save in the save bar in the development build's StrictMode", async () => {
    const held = heldAnswer();
    const skill = makeSkill();
    api = fakeApi({
      "GET /api/settings": () => ({ body: BOT_SETTINGS }),
      "GET /api/skills": () => ({ body: [skill] }),
      [`GET /api/skills/${SKILL_ID}`]: () => ({ body: skill }),
      [`GET /api/skills/${SKILL_ID}/versions`]: () => ({ body: makeVersions(3) }),
      "GET /api/bots": () => ({ body: [] }),
      [VERSION_ROUTE]: () => held.promise,
    });
    await renderApp("/skills/write-user-stories", { strict: true });
    await screen.findByRole("heading", { name: "Write user stories" }, { timeout: 5000 });
    click(screen.getByRole("tab", { name: "Write" }));
    typeBody(NEW_BODY);
    click(screen.getByRole("button", { name: "Save as v4" }));
    await waitFor(() => {
      expect(api?.sent("POST", `/api/skills/${SKILL_ID}/versions`)).toHaveLength(1);
    });
    await held.answer({
      status: 500,
      body: { error: { code: "internal_error", message: "Something failed." } },
    });
    expect(await screen.findByText("Something failed."), "the save bar in StrictMode").toBeTruthy();
    expect(screen.queryByText("Could not save Write user stories. Try again.")).toBeNull();
  });

  it("row 6: says when a Create fails", async () => {
    const held = heldAnswer();
    api = fakeApi({
      "GET /api/settings": () => ({ body: BOT_SETTINGS }),
      "GET /api/skills": () => ({ body: [] }),
      "GET /api/bots": () => ({ body: [] }),
      "POST /api/skills": () => held.promise,
    });
    const { router } = await renderApp("/skills/new");
    await screen.findByLabelText("Name", { exact: true }, { timeout: 5000 });
    click(screen.getByRole("tab", { name: "Write" }));
    for (const [label, text] of [
      ["Name", "Write user stories"],
      ["Description", "Use it."],
      ["Body", "## Steps"],
    ] as const) {
      act(() => {
        fireEvent.change(screen.getByLabelText(label, { exact: true }), {
          target: { value: text },
        });
      });
    }
    click(await screen.findByRole("button", { name: "Create" }));
    await waitFor(() => {
      expect(api?.sent("POST", "/api/skills")).toHaveLength(1);
    });
    act(() => {
      void router.navigate({ to: "/bots" });
    });
    const question = await screen.findByRole("alertdialog");
    click(within(question).getByRole("button", { name: "Let them go" }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/bots");
    });
    await held.answer({
      status: 500,
      body: { error: { code: "internal_error", message: "Something failed." } },
    });
    expect(await screen.findByText("Could not create Write user stories. Try again.")).toBeTruthy();
  });

  describe("Import Apply", () => {
    const preview = {
      preview_id: "preview-1",
      file: "skills.zip",
      rows: [
        {
          slug: "write-user-stories",
          name: "Write user stories",
          status: "new" as const,
          reason: null,
          from_version: null,
          to_version: 1,
          diff: null,
          skipped_files: [],
        },
      ],
    };

    async function applyThenLeave() {
      const held = heldAnswer();
      api = fakeApi({
        "GET /api/settings": () => ({ body: BOT_SETTINGS }),
        "GET /api/skills": () => ({ body: [] }),
        "GET /api/bots": () => ({ body: [] }),
        "POST /api/skills/import/preview": () => ({ body: preview }),
        "POST /api/skills/import/apply": () => held.promise,
      });
      const { router } = await renderApp("/skills");
      const input = await screen.findByLabelText("Choose a zip to import", {}, { timeout: 5000 });
      act(() => {
        fireEvent.change(input, {
          target: { files: [new File(["zip"], "skills.zip", { type: "application/zip" })] },
        });
      });
      click(await screen.findByRole("button", { name: "Apply 1 change" }));
      await waitFor(() => {
        expect(api?.sent("POST", "/api/skills/import/apply")).toHaveLength(1);
      });
      await act(() => router.navigate({ to: "/bots" }));
      return { held, router };
    }

    it("row 6: says when Apply fails as stale", async () => {
      const { held } = await applyThenLeave();
      await held.answer({
        status: 409,
        body: { error: { code: "stale_write", message: "Stale." } },
      });
      expect(
        await screen.findByText("A skill changed after the preview, so the app applied nothing."),
      ).toBeTruthy();
    });

    it("row 6: says when the preview is too old", async () => {
      const { held } = await applyThenLeave();
      await held.answer({
        status: 409,
        body: { error: { code: "preview_expired", message: "Too old." } },
      });
      expect(
        await screen.findByText("The preview is too old, so the app applied nothing."),
      ).toBeTruthy();
    });

    it("row 6: says when Apply fails for another reason", async () => {
      const { held } = await applyThenLeave();
      await held.answer({
        status: 500,
        body: { error: { code: "internal_error", message: "Something failed." } },
      });
      expect(await screen.findByText("Could not apply the import. Try again.")).toBeTruthy();
    });

    it("stays where the owner went when Apply succeeds after the owner left", async () => {
      const { held, router } = await applyThenLeave();
      await held.answer({ status: 200, body: { created: 1, new_versions: 0, skills: [] } });
      expect(await screen.findByText(/^Imported 1 change/)).toBeTruthy();
      await settle();
      expect(router.state.location.pathname).toBe("/bots");
    });

    // Applies the preview of file A, then picks file B while the Apply waits (DQ-070). Each
    // preview answer names its own file and id, so B's preview is a new preview.
    async function applyThenPickAnother() {
      const held = heldAnswer();
      let previews = 0;
      api = fakeApi({
        "GET /api/settings": () => ({ body: BOT_SETTINGS }),
        "GET /api/skills": () => ({ body: [] }),
        "GET /api/bots": () => ({ body: [] }),
        "POST /api/skills/import/preview": () => {
          previews += 1;
          const name = previews === 1 ? "a.zip" : "b.zip";
          return { body: { ...preview, preview_id: `preview-${String(previews)}`, file: name } };
        },
        "POST /api/skills/import/apply": () => held.promise,
      });
      await renderApp("/skills");
      const input = await screen.findByLabelText("Choose a zip to import", {}, { timeout: 5000 });
      const pick = (name: string) => {
        act(() => {
          fireEvent.change(input, {
            target: { files: [new File(["zip"], name, { type: "application/zip" })] },
          });
        });
      };
      pick("a.zip");
      click(await screen.findByRole("button", { name: "Apply 1 change" }));
      await waitFor(() => {
        expect(api?.sent("POST", "/api/skills/import/apply")).toHaveLength(1);
      });
      pick("b.zip");
      await screen.findByText(/^b\.zip · 1 folder/);
      return held;
    }

    it("keeps file B when the Apply of file A succeeds after B was picked", async () => {
      const held = await applyThenPickAnother();
      await held.answer({ status: 200, body: { created: 1, new_versions: 0, skills: [] } });
      expect(await screen.findByText(/^Imported 1 change/)).toBeTruthy();
      await settle();
      expect(screen.queryByText(/^b\.zip · 1 folder/), "the preview of file B").toBeTruthy();
    });

    it("keeps file B when the Apply of file A fails after B was picked", async () => {
      const held = await applyThenPickAnother();
      await held.answer({
        status: 500,
        body: { error: { code: "internal_error", message: "Something failed." } },
      });
      expect(await screen.findByText("Could not apply the import. Try again.")).toBeTruthy();
      await settle();
      expect(screen.queryByText(/^b\.zip · 1 folder/), "B's preview after A failed").toBeTruthy();
    });
  });
});

describe("Clone when its read of the versions fails", () => {
  let api: ReturnType<typeof fakeApi> | null = null;
  afterEach(() => {
    api?.restore();
    api = null;
  });

  const FAILED_TEXT = "The app could not load the skill to copy.";

  async function open(skill = makeSkill()) {
    const held = heldAnswer();
    api = fakeApi({
      "GET /api/settings": () => ({ body: BOT_SETTINGS }),
      "GET /api/skills": () => ({ body: [skill] }),
      [`GET /api/skills/${SKILL_ID}`]: () => ({ body: skill }),
      [`GET /api/skills/${SKILL_ID}/versions`]: () => held.promise,
      "GET /api/bots": () => ({ body: [] }),
    });
    const app = await renderApp("/skills/write-user-stories");
    await screen.findByRole("heading", { name: "Write user stories" }, { timeout: 5000 });
    return { ...app, held };
  }
  const failed = { status: 500, body: { error: { code: "internal_error", message: "Failed." } } };

  it("row 7: says so after Clone in the menu, and stays on the page", async () => {
    const { held, router } = await open();
    click(screen.getByRole("button", { name: "Skill actions" }));
    click(await screen.findByRole("menuitem", { name: "Clone" }));
    await held.answer(failed);
    expect(await screen.findByText(FAILED_TEXT)).toBeTruthy();
    expect(router.state.location.pathname).toBe("/skills/write-user-stories");
  });

  it("row 7: says so after Clone to edit", async () => {
    const { held, router } = await open(makeSkill({ is_author: false }));
    click(screen.getByRole("button", { name: "Clone to edit" }));
    await held.answer(failed);
    expect(await screen.findByText(FAILED_TEXT)).toBeTruthy();
    expect(router.state.location.pathname).toBe("/skills/write-user-stories");
  });

  it("says nothing when the owner left before the read failed", async () => {
    const { held, router } = await open();
    click(screen.getByRole("button", { name: "Skill actions" }));
    click(await screen.findByRole("menuitem", { name: "Clone" }));
    await act(() => router.navigate({ to: "/bots" }));
    await held.answer(failed);
    await settle();
    expect(screen.queryByText(FAILED_TEXT)).toBeNull();
  });
});

describe("a second Save after the refresh of the first came during an edit", () => {
  let api: ReturnType<typeof fakeApi> | null = null;
  afterEach(() => {
    api?.restore();
    api = null;
  });

  const at = ({
    version,
    row_version,
    body_md,
  }: {
    version: number;
    row_version: number;
    body_md: string;
  }) =>
    makeSkill({
      latest_version: { ...makeSkill().latest_version, version },
      row_version,
      body_md,
    });

  async function secondSaveAnswered() {
    const answers = [heldAnswer(), heldAnswer()];
    let saves = 0;
    const server = { skill: makeSkill(), reads: "good" };
    api = fakeApi({
      "GET /api/settings": () => ({ body: BOT_SETTINGS }),
      "GET /api/skills": () => ({ body: [server.skill] }),
      [`GET /api/skills/${SKILL_ID}`]: () =>
        server.reads === "good"
          ? { body: server.skill }
          : { status: 500, body: { error: { code: "internal_error", message: "Failed." } } },
      [`GET /api/skills/${SKILL_ID}/versions`]: () => ({ body: makeVersions(3) }),
      [`GET /api/skills/${SKILL_ID}/upgrade-candidates`]: () => ({ body: [] }),
      "GET /api/bots": () => ({ body: [] }),
      [VERSION_ROUTE]: () => answers[saves++]?.promise,
    });
    const { queryClient } = await renderApp("/skills/write-user-stories");
    await screen.findByRole("heading", { name: "Write user stories" }, { timeout: 5000 });
    click(screen.getByRole("tab", { name: "Write" }));
    typeBody("First.");
    click(screen.getByRole("button", { name: "Save as v4" }));
    await waitFor(() => {
      expect(api?.sent("POST", `/api/skills/${SKILL_ID}/versions`)).toHaveLength(1);
    });
    typeBody("Second.");
    await answers[0]?.answer({
      status: 201,
      body: at({ version: 4, row_version: 2, body_md: "First." }),
    });
    await settle();
    // The refresh of the first Save comes during the edit, and the edit stays.
    server.skill = at({ version: 4, row_version: 2, body_md: "First." });
    await act(() => queryClient.invalidateQueries({ predicate: SKILL_OR_BOT_QUERIES }));
    await settle();
    expect(bodyText()).toBe("Second.");
    click(screen.getByRole("button", { name: "Save as v5" }));
    await waitFor(() => {
      expect(api?.sent("POST", `/api/skills/${SKILL_ID}/versions`)).toHaveLength(2);
    });
    server.reads = "failed";
    await answers[1]?.answer({
      status: 201,
      body: at({ version: 5, row_version: 3, body_md: "Second." }),
    });
    await settle();
    return { answers, queryClient, server };
  }

  it("keeps its text before the refresh of the second Save", async () => {
    await secondSaveAnswered();
    expect(bodyText()).toBe("Second.");
    expect(screen.getByText("All changes are saved.")).toBeTruthy();
  });

  it("takes the text of the second Save when its refresh comes", async () => {
    const { queryClient, server } = await secondSaveAnswered();
    server.reads = "good";
    server.skill = at({ version: 5, row_version: 3, body_md: "Second, as the server keeps it." });
    await act(() => queryClient.invalidateQueries({ predicate: SKILL_OR_BOT_QUERIES }));
    await waitFor(() => {
      expect(bodyText()).toBe("Second, as the server keeps it.");
    });
  });

  it("sends the newest base when the refresh fails, and shows no conflict", async () => {
    const { queryClient } = await secondSaveAnswered();
    await act(() => queryClient.invalidateQueries({ predicate: SKILL_OR_BOT_QUERIES }));
    await settle();
    typeBody("Third.");
    await settle();
    expect(screen.queryByText(CONFLICT_TEXT)).toBeNull();
    click(screen.getByRole("button", { name: /^Save as/ }));
    await waitFor(() => {
      expect(api?.sent("POST", `/api/skills/${SKILL_ID}/versions`)).toHaveLength(3);
    });
    expect(api?.sent("POST", `/api/skills/${SKILL_ID}/versions`)[2]).toMatchObject({
      body: { base_version: 5 },
    });
  });
});

describe("a Restore whose answer comes late", () => {
  let api: ReturnType<typeof fakeApi> | null = null;
  afterEach(() => {
    api?.restore();
    api = null;
  });

  const RESTORE_PATH = `/api/skills/${SKILL_ID}/versions/1/restore`;
  const RESTORE_V2_PATH = `/api/skills/${SKILL_ID}/versions/2/restore`;
  const OTHER_ID = typeId("skill", 2);
  const other = makeSkill({ id: OTHER_ID, slug: "other-skill", name: "Other skill" });
  const restored = {
    status: 201,
    body: makeSkill({
      latest_version: { ...makeSkill().latest_version, version: 4 },
      row_version: 2,
    }),
  };

  // `server.reads` holds or fails the reads of the skill, as for a slow or failed refresh.
  async function restoreSent() {
    const held = heldAnswer();
    const heldRead = heldAnswer();
    const server: { skill: ReturnType<typeof makeSkill>; reads: "good" | "held" | "failed" } = {
      skill: makeSkill(),
      reads: "good",
    };
    api = fakeApi({
      "GET /api/settings": () => ({ body: BOT_SETTINGS }),
      "GET /api/skills": () => ({ body: [server.skill, other] }),
      [`GET /api/skills/${SKILL_ID}`]: () =>
        server.reads === "good"
          ? { body: server.skill }
          : server.reads === "held"
            ? heldRead.promise
            : { status: 500, body: { error: { code: "internal_error", message: "Failed." } } },
      [`GET /api/skills/${SKILL_ID}/versions`]: () => ({ body: makeVersions(3) }),
      [`GET /api/skills/${SKILL_ID}/upgrade-candidates`]: () => ({ body: [] }),
      [`GET /api/skills/${SKILL_ID}/diff`]: () => ({
        body: { description: null, body: [{ op: "same", text: "Text." }] },
      }),
      [`GET /api/skills/${OTHER_ID}`]: () => ({ body: other }),
      [`GET /api/skills/${OTHER_ID}/versions`]: () => ({ body: makeVersions(1) }),
      [`GET /api/skills/${OTHER_ID}/upgrade-candidates`]: () => ({ body: [] }),
      "GET /api/bots": () => ({ body: [] }),
      [`POST ${RESTORE_PATH}`]: () => held.promise,
      [`POST ${RESTORE_V2_PATH}`]: () => held.promise,
    });
    const app = await renderApp("/skills/write-user-stories?tab=history&from=1&to=3");
    click(await screen.findByRole("button", { name: "Restore v1" }, { timeout: 5000 }));
    await waitFor(() => {
      expect(api?.sent("POST", RESTORE_PATH)).toHaveLength(1);
    });
    return { ...app, held, server };
  }

  // A tab change and back: History opens with the default pair, v2 → v3.
  const tabsAndBack = async () => {
    click(screen.getByRole("tab", { name: "Skill" }));
    // The Skill tab is open, and the History panel is gone.
    await screen.findByRole("tab", { name: "Write" });
    expect(screen.queryByRole("list", { name: "Versions" })).toBeNull();
    click(screen.getByRole("tab", { name: /^History/ }));
    await screen.findByRole("list", { name: "Versions" });
    await settle();
  };

  it("sends no second Restore after a tab change and back while the first waits", async () => {
    await restoreSent();
    await tabsAndBack();
    const offer = screen.queryByRole("button", { name: /^Restore v/ });
    if (offer !== null) click(offer);
    await settle();
    expect(api?.sent("POST", RESTORE_V2_PATH), "a second Restore").toHaveLength(0);
  });

  it("sends no Restore after a tab change and back while the refresh after the answer is on its way", async () => {
    const { held, server } = await restoreSent();
    server.reads = "held";
    await held.answer(restored);
    await screen.findByText("Saved v4 ✨");
    await tabsAndBack();
    const offer = screen.queryByRole("button", { name: /^Restore v/ });
    if (offer !== null) click(offer);
    await settle();
    expect(api?.sent("POST", RESTORE_V2_PATH), "a Restore during the refresh").toHaveLength(0);
  });

  it("offers no Restore after a failed refresh, a leave and a return", async () => {
    const { held, server, router } = await restoreSent();
    server.reads = "failed";
    await held.answer(restored);
    await screen.findByText("Saved v4 ✨");
    await settle();
    await act(() => router.navigate({ to: "/bots" }));
    await act(() =>
      router.navigate({
        to: "/skills/$slug",
        params: { slug: "write-user-stories" },
        search: { tab: "history" },
      }),
    );
    await screen.findByRole("list", { name: "Versions" });
    await settle();
    const offer = screen.queryByRole("button", { name: /^Restore v/ });
    expect(offer, "the offer after a failed refresh").toBeNull();
  });

  it("keeps the pair the owner picked when a Restore answer comes", async () => {
    const { held, router } = await restoreSent();
    const versions = screen.getByRole("list", { name: "Versions" });
    // Newest first: v3, v2, v1.
    const v2 = within(versions).getAllByRole("button")[1];
    if (v2 === undefined) throw new Error("no v2 row");
    click(v2);
    await waitFor(() => {
      expect(router.state.location.search).toEqual({ tab: "history", from: 2, to: 3 });
    });
    await held.answer(restored);
    await screen.findByText("Saved v4 ✨");
    await settle();
    expect(router.state.location.search, "the pair after the answer").toEqual({
      tab: "history",
      from: 2,
      to: 3,
    });
  });

  it("offers no other Restore until the data shows the restored version", async () => {
    const { held, queryClient, server } = await restoreSent();
    await held.answer(restored);
    await screen.findByText("Saved v4 ✨");
    await settle();
    // The data here still says v3, so the default pair would offer v2 under the old diff.
    expect(screen.queryByRole("button", { name: /^Restore v/ })).toBeNull();
    server.skill = restored.body;
    await act(() => queryClient.invalidateQueries({ predicate: SKILL_OR_BOT_QUERIES }));
    expect(await screen.findByRole("button", { name: "Restore v3" })).toBeTruthy();
  });

  it("opens the newest version of History when the owner stays", async () => {
    const { held, router } = await restoreSent();
    await held.answer(restored);
    expect(await screen.findByText("Saved v4 ✨")).toBeTruthy();
    await waitFor(() => {
      expect(router.state.location.search).toEqual({ tab: "history" });
    });
  });

  it("does not move an owner who went to another page", async () => {
    const { held, router } = await restoreSent();
    await act(() => router.navigate({ to: "/bots" }));
    await held.answer(restored);
    expect(await screen.findByText("Saved v4 ✨")).toBeTruthy();
    await settle();
    expect(router.state.location.href).toBe("/bots");
  });

  it("does not move an owner who went to another skill", async () => {
    const { held, router } = await restoreSent();
    await act(() => router.navigate({ to: "/skills/$slug", params: { slug: "other-skill" } }));
    await screen.findByRole("heading", { name: "Other skill" });
    await held.answer(restored);
    expect(await screen.findByText("Saved v4 ✨")).toBeTruthy();
    await settle();
    expect(router.state.location.href).toBe("/skills/other-skill");
  });

  it("does not move an owner who went to another tab of the skill", async () => {
    const { held, router } = await restoreSent();
    click(screen.getByRole("tab", { name: "Skill" }));
    await waitFor(() => {
      expect(router.state.location.search).toEqual({});
    });
    await held.answer(restored);
    expect(await screen.findByText("Saved v4 ✨")).toBeTruthy();
    await settle();
    expect(router.state.location.search).toEqual({});
  });

  it("asks nothing of an owner who types in New skill", async () => {
    const { held, router } = await restoreSent();
    await act(() => router.navigate({ to: "/skills/new" }));
    const name = await screen.findByLabelText("Name", { exact: true }, { timeout: 5000 });
    act(() => {
      fireEvent.change(name, { target: { value: "Typed here" } });
    });
    await held.answer(restored);
    expect(await screen.findByText("Saved v4 ✨")).toBeTruthy();
    await settle();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(router.state.location.pathname).toBe("/skills/new");
  });
});

describe("orders that overlap two skill actions", () => {
  let api: ReturnType<typeof fakeApi> | null = null;
  afterEach(() => {
    api?.restore();
    api = null;
  });

  const DEPRECATED_AT = "2026-10-21T10:00:00.000Z";

  it("keeps the base when a late Make active answer is older than a Save", async () => {
    const active = heldAnswer();
    const save = heldAnswer();
    const v4Skill = makeSkill({
      latest_version: { ...makeSkill().latest_version, version: 4 },
      row_version: 4,
      body_md: "First.",
    });
    const server = {
      skill: makeSkill({ deprecated: true, deprecated_at: DEPRECATED_AT, row_version: 2 }),
    };
    api = fakeApi({
      "GET /api/settings": () => ({ body: BOT_SETTINGS }),
      "GET /api/skills": () => ({ body: [server.skill] }),
      [`GET /api/skills/${SKILL_ID}`]: () => ({ body: server.skill }),
      [`GET /api/skills/${SKILL_ID}/versions`]: () => ({ body: makeVersions(3) }),
      [`GET /api/skills/${SKILL_ID}/upgrade-candidates`]: () => ({ body: [] }),
      "GET /api/bots": () => ({ body: [] }),
      [`POST /api/skills/${SKILL_ID}/undeprecate`]: () => active.promise,
      [VERSION_ROUTE]: () => save.promise,
    });
    const { queryClient } = await renderApp("/skills/write-user-stories");
    const refresh = async () => {
      await act(() => queryClient.invalidateQueries({ predicate: SKILL_OR_BOT_QUERIES }));
      await settle();
    };
    click(await screen.findByRole("button", { name: "Make active again" }, { timeout: 5000 }));
    await waitFor(() => {
      expect(api?.sent("POST", `/api/skills/${SKILL_ID}/undeprecate`)).toHaveLength(1);
    });
    server.skill = makeSkill({ row_version: 3 });
    await refresh();
    click(screen.getByRole("tab", { name: "Write" }));
    typeBody("First.");
    click(screen.getByRole("button", { name: "Save as v4" }));
    await waitFor(() => {
      expect(api?.sent("POST", `/api/skills/${SKILL_ID}/versions`)).toHaveLength(1);
    });
    await save.answer({ status: 201, body: v4Skill });
    server.skill = v4Skill;
    await refresh();
    await active.answer({ status: 200, body: makeSkill({ row_version: 3 }) });
    await settle();
    typeBody("Next edit.");
    await settle();
    expect(screen.queryByText(CONFLICT_TEXT)).toBeNull();
  });

  it("keeps the Delete of a second skill waiting when the first Delete ends", async () => {
    const first = heldAnswer();
    const second = heldAnswer();
    const OTHER_ID = typeId("skill", 2);
    const firstSkill = makeSkill({ deprecated: true, deprecated_at: DEPRECATED_AT });
    const otherSkill = makeSkill({
      id: OTHER_ID,
      slug: "other-skill",
      name: "Other skill",
      deprecated: true,
      deprecated_at: DEPRECATED_AT,
    });
    const server = { list: [firstSkill, otherSkill] };
    api = fakeApi({
      "GET /api/settings": () => ({ body: BOT_SETTINGS }),
      "GET /api/skills": () => ({ body: server.list }),
      [`GET /api/skills/${SKILL_ID}`]: () => ({ body: firstSkill }),
      [`GET /api/skills/${SKILL_ID}/versions`]: () => ({ body: makeVersions(3) }),
      [`GET /api/skills/${OTHER_ID}`]: () => ({ body: otherSkill }),
      [`GET /api/skills/${OTHER_ID}/versions`]: () => ({ body: makeVersions(1) }),
      "GET /api/bots": () => ({ body: [] }),
      [TRASH_ROUTE]: () => first.promise,
      [`POST /api/skills/${OTHER_ID}/trash`]: () => second.promise,
    });
    const { queryClient, router } = await renderApp("/skills/write-user-stories");
    const sendDelete = async () => {
      click(await screen.findByRole("button", { name: "Skill actions" }, { timeout: 5000 }));
      click(await screen.findByRole("menuitem", { name: "Delete skill" }));
      const dialog = await screen.findByRole("alertdialog");
      click(await within(dialog).findByRole("button", { name: "Delete skill" }));
      return dialog;
    };
    const dialog = await sendDelete();
    await waitFor(() => {
      expect(api?.sent("POST", `/api/skills/${SKILL_ID}/trash`)).toHaveLength(1);
    });
    click(within(dialog).getByRole("button", { name: "Cancel" }));
    await act(() => router.navigate({ to: "/skills/$slug", params: { slug: "other-skill" } }));
    await screen.findByRole("heading", { name: "Other skill" });
    await sendDelete();
    await waitFor(() => {
      expect(api?.sent("POST", `/api/skills/${OTHER_ID}/trash`)).toHaveLength(1);
    });
    await first.answer({ status: 200, body: { skill_id: SKILL_ID, removed_bot_ids: [] } });
    await screen.findByText("Write user stories is in Trash.");
    server.list = [];
    await act(() => queryClient.invalidateQueries({ predicate: SKILL_OR_BOT_QUERIES }));
    await settle();
    expect(screen.queryByText("Page not found")).toBeNull();
    await second.answer({ status: 200, body: { skill_id: OTHER_ID, removed_bot_ids: [] } });
    expect(await screen.findByText("Other skill is in Trash.")).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "No skills yet" })).toBeTruthy();
  });
});

describe("Make active again and its refresh", () => {
  let api: ReturnType<typeof fakeApi> | null = null;
  afterEach(() => {
    api?.restore();
    api = null;
  });

  const ACTIVATE_PATH = `/api/skills/${SKILL_ID}/undeprecate`;
  const deprecated = (row_version: number) =>
    makeSkill({ deprecated: true, deprecated_at: "2026-10-21T10:00:00.000Z", row_version });

  // Opens a deprecated skill and sends Make active again. `server.reads` holds or fails the
  // reads of the skill after the answer.
  async function activateSent(extra: Record<string, Handler> = {}) {
    const held = heldAnswer();
    const heldRead = heldAnswer();
    const server: { skill: ReturnType<typeof makeSkill>; reads: "good" | "held" | "failed" } = {
      skill: deprecated(2),
      reads: "good",
    };
    api = fakeApi({
      "GET /api/settings": () => ({ body: BOT_SETTINGS }),
      "GET /api/skills": () => ({ body: [server.skill] }),
      [`GET /api/skills/${SKILL_ID}`]: () =>
        server.reads === "good"
          ? { body: server.skill }
          : server.reads === "held"
            ? heldRead.promise
            : { status: 500, body: { error: { code: "internal_error", message: "Failed." } } },
      [`GET /api/skills/${SKILL_ID}/versions`]: () => ({ body: makeVersions(3) }),
      [`GET /api/skills/${SKILL_ID}/upgrade-candidates`]: () => ({ body: [] }),
      "GET /api/bots": () => ({ body: [] }),
      [`POST ${ACTIVATE_PATH}`]: () => held.promise,
      ...extra,
    });
    const app = await renderApp("/skills/write-user-stories");
    click(await screen.findByRole("button", { name: "Make active again" }, { timeout: 5000 }));
    await waitFor(() => {
      expect(api?.sent("POST", ACTIVATE_PATH)).toHaveLength(1);
    });
    return { ...app, held, heldRead, server };
  }

  const clickActivate = async () => {
    click(screen.getByRole("button", { name: "Make active again" }));
    await settle();
  };

  it("sends no second Make active again after the owner leaves and comes back while it waits", async () => {
    const { router } = await activateSent();
    await act(() => router.navigate({ to: "/bots" }));
    await act(() =>
      router.navigate({ to: "/skills/$slug", params: { slug: "write-user-stories" } }),
    );
    await screen.findByRole("button", { name: "Make active again" });
    await clickActivate();
    expect(api?.sent("POST", ACTIVATE_PATH), "the requests after a return").toHaveLength(1);
  });

  it("sends no second Make active again while the refresh after its answer is on its way", async () => {
    const { held, server } = await activateSent();
    server.reads = "held";
    await held.answer({ status: 200, body: makeSkill({ row_version: 3 }) });
    await clickActivate();
    expect(api?.sent("POST", ACTIVATE_PATH), "the requests during the refresh").toHaveLength(1);
  });

  it("turns Make active again on when the refresh after its answer fails", async () => {
    const { held, server } = await activateSent();
    server.reads = "failed";
    await held.answer({ status: 200, body: makeSkill({ row_version: 3 }) });
    await settle();
    await clickActivate();
    expect(api?.sent("POST", ACTIVATE_PATH), "the requests after a failed refresh").toHaveLength(2);
  });

  it("turns Make active again on after a new Deprecate that comes after the refresh", async () => {
    const { held, server, queryClient } = await activateSent();
    server.skill = makeSkill({ row_version: 3 });
    await held.answer({ status: 200, body: server.skill });
    // The live event of the change.
    await act(() => queryClient.invalidateQueries({ predicate: SKILL_OR_BOT_QUERIES }));
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Make active again" })).toBeNull();
    });
    server.skill = deprecated(4);
    await act(() => queryClient.invalidateQueries({ predicate: SKILL_OR_BOT_QUERIES }));
    await screen.findByRole("button", { name: "Make active again" });
    await clickActivate();
    expect(api?.sent("POST", ACTIVATE_PATH), "the requests after a new Deprecate").toHaveLength(2);
  });

  it("shows no conflict when a Save answer comes after a Make active answer", async () => {
    const save = heldAnswer();
    const { held, server, queryClient } = await activateSent({
      [VERSION_ROUTE]: () => save.promise,
    });
    server.skill = makeSkill({ row_version: 3 });
    await act(() => queryClient.invalidateQueries({ predicate: SKILL_OR_BOT_QUERIES }));
    await settle();
    click(screen.getByRole("tab", { name: "Write" }));
    typeBody("First.");
    click(screen.getByRole("button", { name: "Save as v4" }));
    await waitFor(() => {
      expect(api?.sent("POST", `/api/skills/${SKILL_ID}/versions`)).toHaveLength(1);
    });
    await held.answer({ status: 200, body: makeSkill({ row_version: 3 }) });
    const v4Skill = makeSkill({
      latest_version: { ...makeSkill().latest_version, version: 4 },
      row_version: 4,
      body_md: "First.",
    });
    await save.answer({ status: 201, body: v4Skill });
    server.skill = v4Skill;
    await act(() => queryClient.invalidateQueries({ predicate: SKILL_OR_BOT_QUERIES }));
    await settle();
    typeBody("Next edit.");
    await settle();
    expect(screen.queryByText(CONFLICT_TEXT), "a conflict after both answers").toBeNull();
  });
});
