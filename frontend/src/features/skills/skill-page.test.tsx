import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeApi, heldAnswer } from "../../../test/fake-api.ts";
import {
  BOT_SETTINGS,
  makeBot,
  makePin,
  makeSkill,
  makeVersions,
  SKILL_ID,
  typeId,
} from "../../../test/fixtures.ts";
import { renderApp } from "../../../test/render-app.tsx";
import { SKILL_OR_BOT_QUERIES } from "../../lib/api/operation-queries.ts";

// A failed request is not a missing skill (requirements/README.md: every view has an error
// state): the page says the load failed and offers Try again, never Page not found.
describe("the skill page when the skill list does not load", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the error state with Try again, not Page not found", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ error: { code: "internal_error", message: "Something failed." } }),
            { status: 500, headers: { "content-type": "application/json" } },
          ),
        ),
      ),
    );
    await renderApp("/skills/write-user-stories");
    const alert = await screen.findByRole("alert", {}, { timeout: 5000 });
    expect(alert.textContent).toContain("The app could not load the skills.");
    expect(within(alert).getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.queryByText("Page not found")).toBeNull();
  });
});

// A cached list without the skill and a refresh that fails: the load failed, so the page says
// that, never Page not found (bot-page.md has the same rule for the bot page).
describe("the skill page when a refresh of the list fails", () => {
  let api: ReturnType<typeof fakeApi> | null = null;
  afterEach(() => {
    api?.restore();
    api = null;
  });

  it("shows the error state, not Page not found", async () => {
    let fail = false;
    api = fakeApi({
      "GET /api/settings": () => ({ body: BOT_SETTINGS }),
      "GET /api/skills": () =>
        fail
          ? { status: 500, body: { error: { code: "internal_error", message: "Failed." } } }
          : { body: [] },
      "GET /api/bots": () => ({ body: [] }),
    });
    const { router, queryClient } = await renderApp("/skills");
    await waitFor(() => {
      expect(api?.sent("GET", "/api/skills").length).toBeGreaterThan(0);
    });
    fail = true;
    act(() => {
      void queryClient.invalidateQueries({ predicate: SKILL_OR_BOT_QUERIES });
      void router.navigate({ to: "/skills/$slug", params: { slug: "write-user-stories" } });
    });
    const alert = await screen.findByRole("alert", {}, { timeout: 5000 });
    expect(alert.textContent).toContain("The app could not load the skills.");
    expect(screen.queryByText("Page not found")).toBeNull();
  });
});

// A Create moves to the new skill when the newest list came (frontend-conventions.md §5; owner,
// 2026-11-12). A live event in that time cuts the refresh and starts a newer load, and the wait
// follows it. Before TanStack Query 5.105.2 the wait ended at the second cut, on the old list.
describe("the skill page after Create while live events refresh the list", () => {
  let api: ReturnType<typeof fakeApi> | null = null;
  afterEach(() => {
    api?.restore();
    api = null;
  });

  it("stays on the Create page until the newest list comes", async () => {
    const created = makeSkill({ latest_version: { ...makeSkill().latest_version, version: 1 } });
    const held: ReturnType<typeof heldAnswer>[] = [];
    api = fakeApi({
      "GET /api/settings": () => ({ body: BOT_SETTINGS }),
      // The first list has no skill; each refresh after Create waits.
      "GET /api/skills": () => {
        if (api?.sent("GET", "/api/skills").length === 1) return { body: [] };
        const answer = heldAnswer();
        held.push(answer);
        return answer.promise;
      },
      [`GET /api/skills/${SKILL_ID}`]: () => ({ body: created }),
      [`GET /api/skills/${SKILL_ID}/versions`]: () => ({ body: makeVersions(1) }),
      "GET /api/bots": () => ({ body: [] }),
      "POST /api/skills": () => ({ status: 201, body: created }),
    });
    const { router, queryClient } = await renderApp("/skills/new");
    await screen.findByLabelText("Name", { exact: true }, { timeout: 5000 });
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
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Create" }));
    });
    await waitFor(() => {
      expect(held).toHaveLength(1);
    });
    // Two live events while the refresh waits.
    for (const count of [2, 3]) {
      act(() => {
        void queryClient.invalidateQueries({ predicate: SKILL_OR_BOT_QUERIES });
      });
      await waitFor(() => {
        expect(held).toHaveLength(count);
      });
    }
    // The move comes in the same step as the end of the wait, so one timer step shows it.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(router.state.location.pathname, "before the newest list").toBe("/skills/new");
    expect(screen.queryByText("Page not found")).toBeNull();
    // Only the newest load gets an answer: the two cut loads never do.
    await held.at(-1)?.answer({ body: [created] });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/skills/write-user-stories");
    });
    expect(
      await screen.findByRole("heading", { name: "Write user stories" }, { timeout: 5000 }),
    ).toBeTruthy();
    expect(screen.queryByText("Page not found")).toBeNull();
  });
});

// A move to a skill that the list in the cache does not have, while a newer list loads: the
// newer list can have the skill, so Page not found waits for it.
describe("the skill page while a newer list loads", () => {
  let api: ReturnType<typeof fakeApi> | null = null;
  afterEach(() => {
    api?.restore();
    api = null;
  });

  it("shows no Page not found while a newer list loads", async () => {
    const skill = makeSkill({ latest_version: { ...makeSkill().latest_version, version: 1 } });
    const held: ReturnType<typeof heldAnswer>[] = [];
    api = fakeApi({
      "GET /api/settings": () => ({ body: BOT_SETTINGS }),
      // The first list has no skill; the next load waits.
      "GET /api/skills": () => {
        if (api?.sent("GET", "/api/skills").length === 1) return { body: [] };
        const answer = heldAnswer();
        held.push(answer);
        return answer.promise;
      },
      [`GET /api/skills/${SKILL_ID}`]: () => ({ body: skill }),
      [`GET /api/skills/${SKILL_ID}/versions`]: () => ({ body: makeVersions(1) }),
      "GET /api/bots": () => ({ body: [] }),
    });
    const { router, queryClient } = await renderApp("/skills");
    await waitFor(() => {
      expect(api?.sent("GET", "/api/skills").length).toBeGreaterThan(0);
    });
    act(() => {
      void queryClient.invalidateQueries({ predicate: SKILL_OR_BOT_QUERIES });
      void router.navigate({ to: "/skills/$slug", params: { slug: "write-user-stories" } });
    });
    await waitFor(() => {
      expect(held).toHaveLength(1);
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/skills/write-user-stories");
    });
    expect(screen.queryByText("Page not found"), "while the list loads").toBeNull();
    expect(screen.getByRole("status", { name: "Loading the skill" })).toBeTruthy();
    await held[0]?.answer({ body: [skill] });
    expect(
      await screen.findByRole("heading", { name: "Write user stories" }, { timeout: 5000 }),
    ).toBeTruthy();
    expect(screen.queryByText("Page not found")).toBeNull();
  });
});

// Review of PR #57: the removals share one mutation hook, whose `isPending` follows only the
// last request, so the button came back while a removal was still on its way.
describe("Remove from bots on a deprecated skill", () => {
  let api: ReturnType<typeof fakeApi> | null = null;
  afterEach(() => {
    api?.restore();
    api = null;
  });

  it("stays pending until every removal has ended, so a second click sends nothing", async () => {
    const ba = makeBot(1, "BA", [makePin()]);
    const designer = makeBot(2, "Designer", [makePin()]);
    const skill = makeSkill({
      deprecated: true,
      deprecated_at: "2026-10-21T10:00:00.000Z",
      bots_using: 2,
    });
    const baRemoval = heldAnswer();
    const baPath = `/api/bots/${ba.id}/skills/${SKILL_ID}`;
    const designerPath = `/api/bots/${designer.id}/skills/${SKILL_ID}`;
    api = fakeApi({
      "GET /api/skills": () => ({ body: [skill] }),
      [`GET /api/skills/${SKILL_ID}`]: () => ({ body: skill }),
      [`GET /api/skills/${SKILL_ID}/versions`]: () => ({ body: makeVersions(3) }),
      "GET /api/bots": () => ({ body: [ba, designer] }),
      [`DELETE ${baPath}`]: () => baRemoval.promise,
      [`DELETE ${designerPath}`]: () => ({ status: 204 }),
    });
    await renderApp("/skills/write-user-stories");
    const click = (element: HTMLElement) => {
      act(() => {
        fireEvent.click(element);
      });
    };
    click(await screen.findByRole("button", { name: "Remove from bots" }, { timeout: 5000 }));
    const dialog = await screen.findByRole("dialog");
    const confirm = await within(dialog).findByRole("button", { name: "Remove from 2 bots" });
    click(confirm);
    await waitFor(() => {
      expect(api?.sent("DELETE", designerPath)).toHaveLength(1);
    });
    await act(async () => {
      await Promise.resolve();
    });
    // Designer's removal has ended; BA's has not, so the button is still off. (Query it again:
    // the button gets its tooltip while pending.)
    const pending = within(dialog).getByRole("button", { name: "Remove from 2 bots" });
    expect(pending.getAttribute("aria-disabled")).toBe("true");
    click(pending);
    expect(api.sent("DELETE", baPath)).toHaveLength(1);
    expect(api.sent("DELETE", designerPath)).toHaveLength(1);
    await baRemoval.answer({ status: 204 });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  // Review of PR #59: a row whose pin the page just changed turns on only when the list has come.
  it("keeps the rows of the removed bots off until the refresh after the removal", async () => {
    const ba = makeBot(1, "BA", [makePin()]);
    const skill = makeSkill({
      deprecated: true,
      deprecated_at: "2026-10-21T10:00:00.000Z",
      bots_using: 1,
    });
    const refreshed = heldAnswer();
    let holdList = false;
    const path = `/api/bots/${ba.id}/skills/${SKILL_ID}`;
    api = fakeApi({
      "GET /api/skills": () => ({ body: [skill] }),
      [`GET /api/skills/${SKILL_ID}`]: () => ({ body: skill }),
      [`GET /api/skills/${SKILL_ID}/versions`]: () => ({ body: makeVersions(3) }),
      "GET /api/bots": async () => (holdList ? refreshed.promise : { body: [ba] }),
      [`DELETE ${path}`]: () => {
        holdList = true;
        return { status: 204 };
      },
    });
    await renderApp("/skills/write-user-stories?tab=bots");
    const click = (element: HTMLElement) => {
      act(() => {
        fireEvent.click(element);
      });
    };
    click(await screen.findByRole("button", { name: "Remove from bots" }, { timeout: 5000 }));
    const dialog = await screen.findByRole("dialog");
    click(await within(dialog).findByRole("button", { name: "Remove from 1 bot" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    const actions = screen.getByRole("button", { name: "Actions for BA" });
    expect(actions.hasAttribute("data-disabled")).toBe(true);
    await refreshed.answer({ body: [makeBot(1, "BA", [])] });
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Actions for BA" })).toBeNull();
    });
  });

  // A removal that fails changed nothing on the server, so it must not end an older change of the
  // pin: that change still waits, and the row stays off with the value on its way.
  it("keeps an older Always load change on its way when the removal of its bot fails", async () => {
    const ba = makeBot(1, "BA", [makePin({ always_load: false })]);
    const skill = makeSkill({
      deprecated: true,
      deprecated_at: "2026-10-21T10:00:00.000Z",
      bots_using: 1,
    });
    const toggle = heldAnswer();
    const path = `/api/bots/${ba.id}/skills/${SKILL_ID}`;
    api = fakeApi({
      "GET /api/skills": () => ({ body: [skill] }),
      [`GET /api/skills/${SKILL_ID}`]: () => ({ body: skill }),
      [`GET /api/skills/${SKILL_ID}/versions`]: () => ({ body: makeVersions(3) }),
      "GET /api/bots": () => ({ body: [ba] }),
      [`PUT ${path}`]: () => toggle.promise,
      [`DELETE ${path}`]: () => ({
        status: 500,
        body: { error: { code: "internal_error", message: "Something failed." } },
      }),
    });
    await renderApp("/skills/write-user-stories?tab=bots");
    const click = (element: HTMLElement) => {
      act(() => {
        fireEvent.click(element);
      });
    };
    const load = () => screen.getByRole("switch", { name: "Always load for BA" });
    click(await screen.findByRole("switch", { name: "Always load for BA" }, { timeout: 5000 }));
    expect(load().getAttribute("aria-checked")).toBe("true");
    const loads = api.sent("GET", "/api/bots").length;
    click(screen.getByRole("button", { name: "Remove from bots" }));
    const dialog = await screen.findByRole("dialog");
    click(await within(dialog).findByRole("button", { name: "Remove from 1 bot" }));
    expect(await within(dialog).findByText(/could not remove/)).toBeTruthy();
    click(within(dialog).getByRole("button", { name: "Skip" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(api?.sent("GET", "/api/bots").length).toBeGreaterThan(loads);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    // The removal's refresh ended; the older change still waits.
    expect(load().getAttribute("aria-checked")).toBe("true");
    expect(load().hasAttribute("disabled") || load().hasAttribute("data-disabled")).toBe(true);
    await toggle.answer({ body: makeBot(1, "BA", [makePin({ always_load: true })]) });
    await waitFor(() => {
      expect(load().hasAttribute("disabled") || load().hasAttribute("data-disabled")).toBe(false);
    });
  });

  it("keeps the rows of the bots a Deprecate removes off until the refresh after it", async () => {
    const ba = makeBot(1, "BA", [makePin()]);
    const skill = makeSkill({ bots_using: 1 });
    const refreshed = heldAnswer();
    let holdList = false;
    api = fakeApi({
      "GET /api/skills": () => ({ body: [skill] }),
      [`GET /api/skills/${SKILL_ID}`]: () => ({ body: skill }),
      [`GET /api/skills/${SKILL_ID}/versions`]: () => ({ body: makeVersions(3) }),
      "GET /api/bots": async () => (holdList ? refreshed.promise : { body: [ba] }),
      [`POST /api/skills/${SKILL_ID}/deprecate`]: () => {
        holdList = true;
        return { body: skill };
      },
    });
    await renderApp("/skills/write-user-stories?tab=bots");
    const click = (element: HTMLElement) => {
      act(() => {
        fireEvent.click(element);
      });
    };
    click(await screen.findByRole("button", { name: "Skill actions" }, { timeout: 5000 }));
    click(await screen.findByRole("menuitem", { name: "Deprecate" }));
    const dialog = await screen.findByRole("alertdialog");
    await within(dialog).findByRole("checkbox", { name: /BA/ });
    click(within(dialog).getByRole("button", { name: "Deprecate and remove from 1 bot" }));
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).toBeNull();
    });
    const actions = screen.getByRole("button", { name: "Actions for BA" });
    expect(actions.hasAttribute("data-disabled")).toBe(true);
    await refreshed.answer({ body: [makeBot(1, "BA", [])] });
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Actions for BA" })).toBeNull();
    });
  });

  // A dialog request's failure had no place to show once the owner left the skill's page.
  it("shows a Deprecate that fails after the owner left the skill as a toast", async () => {
    const skill = makeSkill();
    const deprecation = heldAnswer();
    api = fakeApi({
      "GET /api/skills": () => ({ body: [skill] }),
      [`GET /api/skills/${SKILL_ID}`]: () => ({ body: skill }),
      [`GET /api/skills/${SKILL_ID}/versions`]: () => ({ body: makeVersions(3) }),
      "GET /api/bots": () => ({ body: [] }),
      [`POST /api/skills/${SKILL_ID}/deprecate`]: () => deprecation.promise,
    });
    const { router } = await renderApp("/skills/write-user-stories");
    const click = (element: HTMLElement) => {
      act(() => {
        fireEvent.click(element);
      });
    };
    click(await screen.findByRole("button", { name: "Skill actions" }, { timeout: 5000 }));
    click(await screen.findByRole("menuitem", { name: "Deprecate" }));
    const dialog = await screen.findByRole("alertdialog");
    click(await within(dialog).findByRole("button", { name: "Deprecate" }));
    await waitFor(() => {
      expect(api?.sent("POST", `/api/skills/${SKILL_ID}/deprecate`)).toHaveLength(1);
    });
    // The dialog is still open when the page goes (the browser's Back, say).
    await act(() => router.navigate({ to: "/bots" }));
    await deprecation.answer({
      status: 500,
      body: { error: { code: "internal_error", message: "Something failed." } },
    });
    expect(await screen.findByText("Something failed.")).toBeTruthy();
  });

  // Review of PR #57: a request that ended after its dialog closed wrote into the next dialog.
  it("shows a Deprecate that fails after its dialog closed as a toast, not in the next dialog", async () => {
    const skill = makeSkill();
    const deprecation = heldAnswer();
    api = fakeApi({
      "GET /api/skills": () => ({ body: [skill] }),
      [`GET /api/skills/${SKILL_ID}`]: () => ({ body: skill }),
      [`GET /api/skills/${SKILL_ID}/versions`]: () => ({ body: makeVersions(3) }),
      "GET /api/bots": () => ({ body: [] }),
      [`POST /api/skills/${SKILL_ID}/deprecate`]: () => deprecation.promise,
    });
    await renderApp("/skills/write-user-stories");
    const click = (element: HTMLElement) => {
      act(() => {
        fireEvent.click(element);
      });
    };
    const openDeprecate = async () => {
      click(await screen.findByRole("button", { name: "Skill actions" }, { timeout: 5000 }));
      click(await screen.findByRole("menuitem", { name: "Deprecate" }));
      return screen.findByRole("alertdialog");
    };
    const first = await openDeprecate();
    click(await within(first).findByRole("button", { name: "Deprecate" }));
    await waitFor(() => {
      expect(api?.sent("POST", `/api/skills/${SKILL_ID}/deprecate`)).toHaveLength(1);
    });
    click(within(first).getByRole("button", { name: "Cancel" }));
    const second = await openDeprecate();
    await deprecation.answer({
      status: 500,
      body: { error: { code: "internal_error", message: "Something failed." } },
    });
    expect(await screen.findByText("Something failed.")).toBeTruthy();
    expect(within(second).queryByText("Something failed.")).toBeNull();
    expect(screen.getByRole("alertdialog")).toBe(second);
  });
});

// State table audit (D3): the leave question stayed open, and named no change, after the Save
// it waited for answered.
describe("leaving the skill editor while its Save is on its way", () => {
  let api: ReturnType<typeof fakeApi> | null = null;
  afterEach(() => {
    api?.restore();
    api = null;
  });

  it("leaves at once when the Save answers while the leave question is open", async () => {
    const held = heldAnswer();
    const v4 = makeSkill({
      latest_version: { ...makeSkill().latest_version, version: 4 },
      row_version: 2,
      body_md: "## Steps\n1. Read the brief.\n2. Ask.",
    });
    let latest = makeSkill();
    api = fakeApi({
      "GET /api/settings": () => ({ body: BOT_SETTINGS }),
      "GET /api/skills": () => ({ body: [latest] }),
      [`GET /api/skills/${SKILL_ID}`]: () => ({ body: latest }),
      [`GET /api/skills/${SKILL_ID}/versions`]: () => ({ body: makeVersions(3) }),
      [`GET /api/skills/${SKILL_ID}/upgrade-candidates`]: () => ({ body: [] }),
      "GET /api/bots": () => ({ body: [] }),
      [`POST /api/skills/${SKILL_ID}/versions`]: async () => {
        const answer = await held.promise;
        latest = v4;
        return answer;
      },
    });
    const { router } = await renderApp("/skills/write-user-stories");
    await screen.findByRole("heading", { name: "Write user stories" }, { timeout: 5000 });
    act(() => {
      fireEvent.click(screen.getByRole("tab", { name: "Write" }));
    });
    act(() => {
      fireEvent.change(screen.getByLabelText("Body", { exact: true }), {
        target: { value: "## Steps\n1. Read the brief.\n2. Ask." },
      });
    });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Save as v4" }));
    });
    act(() => {
      void router.navigate({ to: "/bots" });
    });
    await screen.findByRole("alertdialog", { name: "Leave without saving? 👀" });
    await held.answer({ status: 201, body: v4 });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/bots");
    });
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});

// DQ-020: Clone reads the versions first. A read that answers after the owner left the page moves
// nothing (docs/delivery-quality.md).
describe("Clone while its read of the versions is on its way", () => {
  let api: ReturnType<typeof fakeApi> | null = null;
  afterEach(() => {
    api?.restore();
    api = null;
  });

  const OTHER_ID = typeId("skill", 2);

  async function clickClone() {
    const held = heldAnswer();
    const skill = makeSkill();
    const other = makeSkill({ id: OTHER_ID, slug: "other-skill", name: "Other skill" });
    api = fakeApi({
      "GET /api/settings": () => ({ body: BOT_SETTINGS }),
      "GET /api/skills": () => ({ body: [skill, other] }),
      [`GET /api/skills/${SKILL_ID}`]: () => ({ body: skill }),
      [`GET /api/skills/${OTHER_ID}`]: () => ({ body: other }),
      [`GET /api/skills/${SKILL_ID}/versions`]: () => held.promise,
      [`GET /api/skills/${OTHER_ID}/versions`]: () => ({ body: makeVersions(1) }),
      "GET /api/bots": () => ({ body: [] }),
    });
    const { router } = await renderApp("/skills/write-user-stories");
    const click = (element: HTMLElement) => {
      act(() => {
        fireEvent.click(element);
      });
    };
    click(await screen.findByRole("button", { name: "Skill actions" }, { timeout: 5000 }));
    click(await screen.findByRole("menuitem", { name: "Clone" }));
    await waitFor(() => {
      expect(api?.sent("GET", `/api/skills/${SKILL_ID}/versions`)).toHaveLength(1);
    });
    const answer = () => held.answer({ body: makeVersions(3) });
    return { router, answer };
  }

  // Time for a late move to happen, when a test expects none.
  const settle = () =>
    act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

  it("moves to the Clone page while the owner stays, and a leave after that is a normal leave", async () => {
    const { router, answer } = await clickClone();
    await answer();
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/skills/new");
    });
    await act(() => router.navigate({ to: "/bots" }));
    expect(router.state.location.pathname).toBe("/bots");
  });

  it("stays where the owner went when the read answers after the owner left", async () => {
    const { router, answer } = await clickClone();
    await act(() => router.navigate({ to: "/bots" }));
    await answer();
    await settle();
    expect(router.state.location.pathname).toBe("/bots");
  });

  it("stays on another skill when the read answers after the owner moved to it", async () => {
    const { router, answer } = await clickClone();
    await act(() => router.navigate({ to: "/skills/$slug", params: { slug: "other-skill" } }));
    await answer();
    await settle();
    expect(router.state.location.pathname).toBe("/skills/other-skill");
  });

  it("stays on the page when the owner left and came back before the read answered", async () => {
    const { router, answer } = await clickClone();
    await act(() => router.navigate({ to: "/bots" }));
    await act(() =>
      router.navigate({ to: "/skills/$slug", params: { slug: "write-user-stories" } }),
    );
    await screen.findByRole("heading", { name: "Write user stories" }, { timeout: 5000 });
    await answer();
    await settle();
    expect(router.state.location.pathname).toBe("/skills/write-user-stories");
  });
});

// The bot list of a Deprecate dialog that did not load: Try again reads it again
// (skills-page.md §2a pattern; P3 list item 61).
describe("the Deprecate dialog when the bots do not load", () => {
  let api: ReturnType<typeof fakeApi> | null = null;
  afterEach(() => {
    api?.restore();
    api = null;
  });

  const FAILED = { status: 500, body: { error: { code: "internal_error", message: "Failed." } } };
  const click = (element: HTMLElement) => {
    act(() => {
      fireEvent.click(element);
    });
  };

  async function openDeprecate() {
    const ba = makeBot(1, "BA", [makePin()]);
    const server: { bots: () => { status?: number; body?: unknown } } = { bots: () => FAILED };
    api = fakeApi({
      "GET /api/settings": () => ({ body: BOT_SETTINGS }),
      "GET /api/skills": () => ({ body: [makeSkill()] }),
      [`GET /api/skills/${SKILL_ID}`]: () => ({ body: makeSkill() }),
      [`GET /api/skills/${SKILL_ID}/versions`]: () => ({ body: makeVersions(3) }),
      "GET /api/bots": () => server.bots(),
    });
    const { queryClient } = await renderApp("/skills/write-user-stories");
    click(await screen.findByRole("button", { name: "Skill actions" }, { timeout: 5000 }));
    click(await screen.findByRole("menuitem", { name: "Deprecate" }));
    const dialog = await screen.findByRole("alertdialog");
    const alert = await within(dialog).findByRole("alert");
    return {
      queryClient,
      ba,
      server,
      dialog,
      tryAgain: within(alert).getByRole("button", { name: "Try again" }),
    };
  }

  it("shows the bots after Try again", async () => {
    const { ba, server, dialog, tryAgain } = await openDeprecate();
    server.bots = () => ({ body: [ba] });
    click(tryAgain);
    expect(await within(dialog).findByText("BA"), "the bots after Try again").toBeTruthy();
  });

  // An order case: a second failure keeps the way to try again. The old code had no button.
  it("keeps Try again when the bots fail again", async () => {
    const { dialog, queryClient, tryAgain } = await openDeprecate();
    click(tryAgain);
    await waitFor(() => {
      expect(api?.sent("GET", "/api/bots").length).toBeGreaterThan(1);
    });
    await waitFor(() => {
      expect(queryClient.isFetching()).toBe(0);
    });
    const tryAgainAfter = within(dialog).queryByRole("button", { name: "Try again" });
    expect(tryAgainAfter, "Try again after a second failure").not.toBeNull();
  });
});

// The dot of a list row with unsaved changes is an image with a name, so a screen reader reads
// its label: `aria-label` on an element with no role is not read (P3 list item 64).
describe("the unsaved changes dot of the skill list", () => {
  let api: ReturnType<typeof fakeApi> | null = null;
  afterEach(() => {
    api?.restore();
    api = null;
  });

  it("is an image named Unsaved changes", async () => {
    api = fakeApi({
      "GET /api/settings": () => ({ body: BOT_SETTINGS }),
      "GET /api/skills": () => ({ body: [makeSkill()] }),
      [`GET /api/skills/${SKILL_ID}`]: () => ({ body: makeSkill() }),
      [`GET /api/skills/${SKILL_ID}/versions`]: () => ({ body: makeVersions(3) }),
      "GET /api/bots": () => ({ body: [] }),
    });
    await renderApp("/skills/write-user-stories");
    await screen.findByRole("heading", { name: "Write user stories" }, { timeout: 5000 });
    act(() => {
      fireEvent.change(screen.getByLabelText("Name", { exact: true }), {
        target: { value: "Write better user stories" },
      });
    });
    expect(
      await screen.findByRole("img", { name: "Unsaved changes" }),
      "the dot is an image",
    ).toBeTruthy();
  });
});
