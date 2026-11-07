import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { fakeApi, heldAnswer, watchQueryClient } from "../../../test/fake-api.ts";
import {
  makeBot,
  makePin,
  makeSkill,
  makeVersions,
  SKILL_ID,
  versionId,
  type Bot,
} from "../../../test/fixtures.ts";
import { Toaster } from "../../components/ui/toast.tsx";
import { listBotsQueryKey } from "../../lib/api/generated/@tanstack/react-query.gen.ts";
import { TooltipProvider } from "../../components/ui/tooltip.tsx";
import { writeSaveAnswer } from "../bots/bot-list-store.ts";
import { SkillBotsTab } from "./skill-bots-tab.tsx";

let api: ReturnType<typeof fakeApi> | null = null;
afterEach(() => {
  api?.restore();
  api = null;
});

// The skill is at v3; BA uses v3 (latest), Designer uses v2, QA does not use it.
const ba = makeBot(1, "BA", [makePin({ always_load: true })], { effort: "high" });
const designer = makeBot(2, "Designer", [makePin({ version: 2, skill_version_id: versionId(2) })]);
const qa = makeBot(3, "QA");

function open(bots: Bot[], extra: Parameters<typeof fakeApi>[0] = {}) {
  api = fakeApi({
    "GET /api/bots": () => ({ body: bots }),
    [`GET /api/skills/${SKILL_ID}/versions`]: () => ({ body: makeVersions(3) }),
    ...extra,
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  watchQueryClient(queryClient);
  const page = (tab: boolean) => (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {tab && <SkillBotsTab skill={makeSkill()} />}
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
  const view = render(page(true));
  // The owner leaves the tab; the toasts stay.
  const leave = () => {
    view.rerender(page(false));
  };
  const back = () => {
    view.rerender(page(true));
  };
  return { queryClient, leave, back };
}

const FAILED = {
  status: 500,
  body: { error: { code: "internal_error", message: "Something failed." } },
};

// The versions fail once, then load.
function versionsFailOnce() {
  let calls = 0;
  return {
    [`GET /api/skills/${SKILL_ID}/versions`]: () => {
      calls += 1;
      return calls === 1 ? FAILED : { body: makeVersions(3) };
    },
  };
}

const STALE = {
  status: 409,
  body: { error: { code: "stale_write", message: "The pin changed.", current: null } },
};

const click = (element: HTMLElement) => {
  act(() => {
    fireEvent.click(element);
  });
};

// A control that is off: disabled, or marked so by its component.
const isOff = (element: HTMLElement) =>
  element.hasAttribute("disabled") ||
  element.hasAttribute("data-disabled") ||
  element.getAttribute("aria-disabled") === "true";

const focus = (element: HTMLElement) => {
  act(() => {
    fireEvent.focus(element);
  });
};

// skills-page.md §2a, UI-7.5a.
describe("the Bots tab of a skill", () => {
  it("shows a row for each bot that uses the skill: latest, or the upgrade link", async () => {
    open([ba, designer, qa]);
    const rows = await screen.findAllByRole("row");
    // The head row and one row for each bot that uses the skill; QA does not use it.
    expect(rows).toHaveLength(3);
    const [, baRow, designerRow] = rows;
    if (baRow === undefined || designerRow === undefined) throw new Error("missing rows");
    expect(within(baRow).getByText("BA")).toBeTruthy();
    expect(within(baRow).getByText("Fake scripted · High")).toBeTruthy();
    expect(within(baRow).getByText("v3")).toBeTruthy();
    expect(within(baRow).getByText("latest")).toBeTruthy();
    expect(within(baRow).queryByRole("button", { name: /Upgrade to/ })).toBeNull();
    expect(within(baRow).getByRole("switch", { name: "Always load for BA" })).toBeTruthy();
    expect(within(designerRow).getByText("v2")).toBeTruthy();
    expect(within(designerRow).getByRole("button", { name: "Upgrade to v3" })).toBeTruthy();
    expect(within(designerRow).queryByText("latest")).toBeNull();
    expect(
      within(baRow)
        .getByRole("switch", { name: "Always load for BA" })
        .getAttribute("aria-checked"),
    ).toBe("true");
    expect(
      within(designerRow)
        .getByRole("switch", { name: "Always load for Designer" })
        .getAttribute("aria-checked"),
    ).toBe("false");
  });

  it("lists in + Add only the bots that do not use the skill, with no box ticked", async () => {
    open([ba, designer, qa]);
    await screen.findByRole("row", { name: /BA/ });
    click(screen.getByRole("button", { name: "Add" }));
    const list = await screen.findByRole("list", { name: "Bots that do not use this skill" });
    // The bots that use the skill are not in the list, and no box starts ticked.
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(within(list).getByText("QA")).toBeTruthy();
    expect(within(list).queryByText("BA")).toBeNull();
    expect(within(list).queryByText("Designer")).toBeNull();
    expect(within(list).getByRole("checkbox").getAttribute("aria-checked")).toBe("false");
    // Add is at 40% until a box is ticked, and its tooltip says why (ui-rules B5).
    const add = within(screen.getByRole("dialog")).getByRole("button", { name: "Add" });
    expect(add.getAttribute("aria-disabled")).toBe("true");
    focus(add);
    expect(await screen.findByText("Tick a bot first.")).toBeTruthy();
  });

  it("gives the added bots the latest version and Always load off", async () => {
    open([qa], {
      [`POST /api/skills/${SKILL_ID}/bots`]: () => ({
        body: [makeBot(3, "QA", [makePin()])],
      }),
    });
    expect(await screen.findByText("No bot uses this skill yet.")).toBeTruthy();
    click(screen.getByRole("button", { name: "Add" }));
    const dialog = await screen.findByRole("dialog");
    // Add stays off until a box is ticked.
    expect(within(dialog).getByRole("button", { name: "Add" }).getAttribute("aria-disabled")).toBe(
      "true",
    );
    await waitFor(() => {
      expect(within(dialog).getByText(/They get v3, with Always load off/)).toBeTruthy();
    });
    click(within(dialog).getByRole("checkbox"));
    click(within(dialog).getByRole("button", { name: "Add 1" }));
    await waitFor(() => {
      expect(api?.sent("POST", `/api/skills/${SKILL_ID}/bots`)).toHaveLength(1);
    });
    expect(api?.sent("POST", `/api/skills/${SKILL_ID}/bots`)[0]?.body).toEqual({
      skill_version_id: versionId(3),
      bots: [{ bot_id: qa.id, expected_skill_version_id: null }],
    });
  });

  it("sends only the ticked bots that are still in the list (another place gave one the skill)", async () => {
    const dev = makeBot(4, "Dev");
    let bots = [qa, dev];
    const { queryClient } = open([], {
      "GET /api/bots": () => ({ body: bots }),
      [`POST /api/skills/${SKILL_ID}/bots`]: () => ({ body: [makeBot(4, "Dev", [makePin()])] }),
    });
    click(await screen.findByRole("button", { name: "Add" }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => {
      expect(within(dialog).getByText(/They get v3/)).toBeTruthy();
    });
    for (const box of within(dialog).getAllByRole("checkbox")) click(box);
    expect(within(dialog).getByRole("button", { name: "Add 2" })).toBeTruthy();
    // Another tab adds QA; its row leaves the card.
    bots = [makeBot(3, "QA", [makePin()]), dev];
    await act(() => queryClient.invalidateQueries());
    await waitFor(() => {
      expect(within(dialog).queryByText("QA")).toBeNull();
    });
    click(within(dialog).getByRole("button", { name: "Add 1" }));
    await waitFor(() => {
      expect(api?.sent("POST", `/api/skills/${SKILL_ID}/bots`)).toHaveLength(1);
    });
    expect(api?.sent("POST", `/api/skills/${SKILL_ID}/bots`)[0]?.body).toEqual({
      skill_version_id: versionId(3),
      bots: [{ bot_id: dev.id, expected_skill_version_id: null }],
    });
  });

  it("Change version says when the versions do not load, and Try again loads them", async () => {
    open([designer], versionsFailOnce());
    click(await screen.findByRole("button", { name: "Actions for Designer" }));
    click(await screen.findByRole("menuitem", { name: "Change version" }));
    const dialog = await screen.findByRole("dialog", { name: "Change version" });
    const alert = await within(dialog).findByRole("alert");
    expect(alert.textContent).toContain("The app could not load the versions.");
    expect(within(dialog).queryByRole("status", { name: "Loading the versions" })).toBeNull();
    click(within(alert).getByRole("button", { name: "Try again" }));
    expect(await within(dialog).findByRole("list", { name: "Versions" })).toBeTruthy();
  });

  it("Upgrade and + Add say when the versions do not load, and stay off", async () => {
    open([designer, qa], {
      [`GET /api/skills/${SKILL_ID}/versions`]: () => FAILED,
      [`GET /api/skills/${SKILL_ID}/diff`]: () => ({ body: { description: null, body: [] } }),
    });
    click(await screen.findByRole("button", { name: "Upgrade to v3" }));
    const upgrade = await screen.findByRole("dialog", {
      name: "Upgrade Write user stories to v3?",
    });
    expect((await within(upgrade).findByRole("alert")).textContent).toContain(
      "The app could not load the versions.",
    );
    expect(within(upgrade).queryByRole("status", { name: "Loading the versions" })).toBeNull();
    const confirm = within(upgrade).getByRole("button", { name: "Upgrade to v3" });
    expect(confirm.getAttribute("aria-disabled")).toBe("true");
    focus(confirm);
    expect(await screen.findByText("The versions did not load. Try again first.")).toBeTruthy();
    click(within(upgrade).getByRole("button", { name: "Cancel" }));
    click(screen.getByRole("button", { name: "Add" }));
    const add = await screen.findByRole("dialog", { name: "Add Write user stories to bots" });
    expect((await within(add).findByRole("alert")).textContent).toContain(
      "The app could not load the versions.",
    );
    click(within(add).getByRole("checkbox"));
    const addOne = within(add).getByRole("button", { name: "Add 1" });
    expect(addOne.getAttribute("aria-disabled")).toBe("true");
    focus(addOne);
    expect(await screen.findByText("The versions did not load. Try again first.")).toBeTruthy();
  });

  it("asks to create a bot first only when no bot exists", async () => {
    open([]);
    expect(await screen.findByText("No bot uses this skill yet.")).toBeTruthy();
    const add = screen.getByRole("button", { name: "Add" });
    expect(add.getAttribute("aria-disabled")).toBe("true");
    act(() => {
      fireEvent.focus(add);
    });
    expect(await screen.findByText("Create a bot first.")).toBeTruthy();
  });

  it("does not say Create a bot first when every bot already uses the skill", async () => {
    open([ba]);
    await screen.findByRole("row", { name: /BA/ });
    const add = screen.getByRole("button", { name: "Add" });
    expect(add.getAttribute("aria-disabled")).toBe("true");
    act(() => {
      fireEvent.focus(add);
    });
    expect(await screen.findByText("Every bot uses this skill.")).toBeTruthy();
    expect(screen.queryByText("Create a bot first.")).toBeNull();
  });

  it("sends the pin as it shows it when the owner turns Always load on", async () => {
    open([designer], {
      [`PUT /api/bots/${designer.id}/skills/${SKILL_ID}`]: () => ({
        body: makeBot(2, "Designer", [
          makePin({ version: 2, skill_version_id: versionId(2), always_load: true }),
        ]),
      }),
    });
    click(await screen.findByRole("switch", { name: "Always load for Designer" }));
    await waitFor(() => {
      expect(api?.sent("PUT", `/api/bots/${designer.id}/skills/${SKILL_ID}`)).toHaveLength(1);
    });
    expect(api?.sent("PUT", `/api/bots/${designer.id}/skills/${SKILL_ID}`)[0]?.body).toEqual({
      skill_version_id: versionId(2),
      always_load: true,
      expected: { skill_version_id: versionId(2), always_load: false },
    });
  });

  // PR #59 review of 340ca02: the switch showed the old value again before the refresh ended.
  it("keeps the switch on the value on its way until the refresh after the answer ends", async () => {
    const held = heldAnswer();
    const refresh = heldAnswer();
    const state = { answered: false, bots: [designer] };
    const { queryClient } = open([designer], {
      "GET /api/bots": async () => {
        if (!state.answered) return { body: state.bots };
        const answer = await refresh.promise;
        return answer;
      },
      [`PUT /api/bots/${designer.id}/skills/${SKILL_ID}`]: async () => {
        const answer = await held.promise;
        return answer;
      },
    });
    const toggle = await screen.findByRole("switch", { name: "Always load for Designer" });
    click(toggle);
    await waitFor(() => {
      expect(api?.sent("PUT", `/api/bots/${designer.id}/skills/${SKILL_ID}`)).toHaveLength(1);
    });
    // A list load while the PUT is on its way: the answer then writes no pin (bot-list-state.ts).
    await act(() => queryClient.refetchQueries({ queryKey: listBotsQueryKey() }));
    state.answered = true;
    const on = makeBot(2, "Designer", [
      makePin({ version: 2, skill_version_id: versionId(2), always_load: true }),
    ]);
    await held.answer({ body: on });
    const shown = () => screen.getByRole("switch", { name: "Always load for Designer" });
    // The refresh after the answer is on its way: the switch still shows the value it sent.
    expect(shown().getAttribute("aria-checked")).toBe("true");
    expect(shown().hasAttribute("data-disabled")).toBe(true);
    await refresh.answer({ body: [on] });
    await waitFor(() => {
      expect(shown().hasAttribute("data-disabled")).toBe(false);
    });
    expect(shown().getAttribute("aria-checked")).toBe("true");
  });

  // PR #59 review: a pin answer replaced the whole bot row, also the fields a pin does not own.
  it("keeps a newer Profile save when a late Always load answer comes after it", async () => {
    const held = heldAnswer();
    const state = { bots: [designer], fail: false };
    const { queryClient } = open([designer], {
      "GET /api/bots": () => (state.fail ? FAILED : { body: state.bots }),
      [`PUT /api/bots/${designer.id}/skills/${SKILL_ID}`]: async () => {
        const answer = await held.promise;
        return answer;
      },
    });
    click(await screen.findByRole("switch", { name: "Always load for Designer" }));
    await waitFor(() => {
      expect(api?.sent("PUT", `/api/bots/${designer.id}/skills/${SKILL_ID}`)).toHaveLength(1);
    });
    // The answer of a Profile save on the bot page comes first: a write, not a load. The bot
    // page writes it through the bot list store, as here.
    const key = listBotsQueryKey();
    act(() => {
      writeSaveAnswer(queryClient, { ...designer, row_version: 2, description: "Newer." });
    });
    state.fail = true;
    await held.answer({
      body: makeBot(2, "Designer", [
        makePin({ version: 2, skill_version_id: versionId(2), always_load: true }),
      ]),
    });
    await waitFor(() => {
      expect(
        screen
          .getByRole("switch", { name: "Always load for Designer" })
          .getAttribute("aria-checked"),
      ).toBe("true");
    });
    const cached = queryClient.getQueryData<Bot[]>(key)?.[0];
    expect(cached?.row_version).toBe(2);
    expect(cached?.description).toBe("Newer.");
  });

  // PR #59 review: an answer after the owner left the tab still wrote over a newer load.
  it("keeps a newer opposite toggle when a late Always load answer comes after the owner left", async () => {
    const held = heldAnswer();
    const state = { fail: false };
    const { queryClient, leave } = open([designer], {
      "GET /api/bots": () => (state.fail ? FAILED : { body: [designer] }),
      [`PUT /api/bots/${designer.id}/skills/${SKILL_ID}`]: async () => {
        const answer = await held.promise;
        return answer;
      },
    });
    click(await screen.findByRole("switch", { name: "Always load for Designer" }));
    await waitFor(() => {
      expect(api?.sent("PUT", `/api/bots/${designer.id}/skills/${SKILL_ID}`)).toHaveLength(1);
    });
    act(leave);
    // The toggle got to the server first (on); then another tab turned it off again, and the
    // app loaded that (off, the value the toggle expected) before the answer came.
    const key = listBotsQueryKey();
    await act(() => queryClient.refetchQueries({ queryKey: key }));
    state.fail = true;
    await held.answer({
      body: makeBot(2, "Designer", [
        makePin({ version: 2, skill_version_id: versionId(2), always_load: true }),
      ]),
    });
    await act(() => Promise.resolve());
    expect(queryClient.getQueryData<Bot[]>(key)?.[0]?.pins[0]?.always_load).toBe(false);
  });

  it("loads the newest pins when the server refuses a change as stale (409)", async () => {
    open([designer], {
      [`PUT /api/bots/${designer.id}/skills/${SKILL_ID}`]: () => ({
        status: 409,
        body: { error: { code: "stale_write", message: "The pin changed.", current: null } },
      }),
    });
    click(await screen.findByRole("switch", { name: "Always load for Designer" }));
    await waitFor(() => {
      expect(api?.sent("GET", "/api/bots")).toHaveLength(2);
    });
    // The switch goes back to what the server holds.
    await waitFor(() => {
      expect(
        screen
          .getByRole("switch", { name: "Always load for Designer" })
          .getAttribute("aria-checked"),
      ).toBe("false");
    });
  });

  it("opens the upgrade dialog from the link and moves the bot to the latest version", async () => {
    open([designer], {
      [`GET /api/skills/${SKILL_ID}/diff`]: () => ({ body: { description: null, body: [] } }),
      [`PUT /api/bots/${designer.id}/skills/${SKILL_ID}`]: () => ({
        body: makeBot(2, "Designer", [makePin()]),
      }),
    });
    click(await screen.findByRole("button", { name: "Upgrade to v3" }));
    const dialog = await screen.findByRole("dialog", { name: "Upgrade Write user stories to v3?" });
    expect(
      within(dialog).getByText(/Designer uses v2\. Designer gets v3 from its next run/),
    ).toBeTruthy();
    expect(within(dialog).getByText("Change 3")).toBeTruthy();
    click(within(dialog).getByRole("button", { name: "Upgrade to v3" }));
    await waitFor(() => {
      expect(api?.sent("PUT", `/api/bots/${designer.id}/skills/${SKILL_ID}`)).toHaveLength(1);
    });
    expect(api?.sent("PUT", `/api/bots/${designer.id}/skills/${SKILL_ID}`)[0]?.body).toEqual({
      skill_version_id: versionId(3),
      always_load: false,
      expected: { skill_version_id: versionId(2), always_load: false },
    });
  });

  // Q3 (bot-page.md §4.2, owner 2026-11-04): a second change of a row whose move waits would
  // send the old pin as `expected` and get the "changed in another place" toast.
  it("turns the row's actions off while its version move waits, also after the dialog closes", async () => {
    const held = heldAnswer();
    open([designer], {
      [`GET /api/skills/${SKILL_ID}/diff`]: () => ({ body: { description: null, body: [] } }),
      [`PUT /api/bots/${designer.id}/skills/${SKILL_ID}`]: async () => held.promise,
    });
    click(await screen.findByRole("button", { name: "Upgrade to v3" }));
    const dialog = await screen.findByRole("dialog", { name: "Upgrade Write user stories to v3?" });
    click(within(dialog).getByRole("button", { name: "Upgrade to v3" }));
    click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(isOff(screen.getByRole("button", { name: "Upgrade to v3" }))).toBe(true);
    expect(isOff(screen.getByRole("button", { name: "Actions for Designer" }))).toBe(true);
    expect(isOff(screen.getByRole("switch", { name: "Always load for Designer" }))).toBe(true);
    await held.answer({ body: makeBot(2, "Designer", [makePin()]) });
    await waitFor(() => {
      expect(isOff(screen.getByRole("button", { name: "Actions for Designer" }))).toBe(false);
    });
    expect(isOff(screen.getByRole("switch", { name: "Always load for Designer" }))).toBe(false);
  });

  // Review of PR #59: the same rule as on the bot page, for the skill's side of the row.
  it("keeps the row's actions off after a move's answer, until the refresh brings the new version", async () => {
    const held = heldAnswer();
    const refreshed = heldAnswer();
    const moved = makeBot(2, "Designer", [makePin()]);
    let holdList = false;
    const { queryClient } = open([designer], {
      [`GET /api/skills/${SKILL_ID}/diff`]: () => ({ body: { description: null, body: [] } }),
      [`PUT /api/bots/${designer.id}/skills/${SKILL_ID}`]: async () => held.promise,
      "GET /api/bots": async () => (holdList ? refreshed.promise : { body: [designer] }),
    });
    click(await screen.findByRole("button", { name: "Upgrade to v3" }));
    const dialog = await screen.findByRole("dialog", { name: "Upgrade Write user stories to v3?" });
    click(within(dialog).getByRole("button", { name: "Upgrade to v3" }));
    await waitFor(() => {
      expect(api?.sent("PUT", `/api/bots/${designer.id}/skills/${SKILL_ID}`)).toHaveLength(1);
    });
    // A list load lands while the move waits, so its answer writes no pin.
    await act(() => queryClient.refetchQueries({ queryKey: listBotsQueryKey() }));
    holdList = true;
    await held.answer({ body: moved });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(isOff(screen.getByRole("button", { name: "Upgrade to v3" }))).toBe(true);
    expect(isOff(screen.getByRole("button", { name: "Actions for Designer" }))).toBe(true);
    expect(isOff(screen.getByRole("switch", { name: "Always load for Designer" }))).toBe(true);
    await refreshed.answer({ body: [moved] });
    await waitFor(() => {
      expect(isOff(screen.getByRole("button", { name: "Actions for Designer" }))).toBe(false);
    });
    expect(screen.queryByRole("button", { name: "Upgrade to v3" })).toBeNull();
    expect(isOff(screen.getByRole("switch", { name: "Always load for Designer" }))).toBe(false);
  });

  it("keeps the row of a bot + Add added off until the refresh after its answer", async () => {
    const refreshed = heldAnswer();
    const added = makeBot(3, "QA", [makePin()]);
    let holdList = false;
    open([qa], {
      [`POST /api/skills/${SKILL_ID}/bots`]: () => {
        holdList = true;
        return { body: [added] };
      },
      "GET /api/bots": async () => (holdList ? refreshed.promise : { body: [qa] }),
    });
    click(await screen.findByRole("button", { name: "Add" }));
    const dialog = await screen.findByRole("dialog");
    click(await within(dialog).findByRole("checkbox", { name: /QA/ }));
    click(within(dialog).getByRole("button", { name: "Add 1" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(isOff(screen.getByRole("button", { name: "Actions for QA" }))).toBe(true);
    await refreshed.answer({ body: [added] });
    await waitFor(() => {
      expect(isOff(screen.getByRole("button", { name: "Actions for QA" }))).toBe(false);
    });
  });

  // Review of PR #57: one mutation hook served every row, so a second toggle dropped the first
  // one's callbacks and its failure went unseen.
  it("shows a version move that fails after the owner left the tab as a toast", async () => {
    const held = heldAnswer();
    const { leave } = open([designer], {
      [`GET /api/skills/${SKILL_ID}/diff`]: () => ({ body: { description: null, body: [] } }),
      [`PUT /api/bots/${designer.id}/skills/${SKILL_ID}`]: async () => {
        const answer = await held.promise;
        return answer;
      },
    });
    click(await screen.findByRole("button", { name: "Upgrade to v3" }));
    const dialog = await screen.findByRole("dialog", { name: "Upgrade Write user stories to v3?" });
    click(within(dialog).getByRole("button", { name: "Upgrade to v3" }));
    act(leave);
    await held.answer(FAILED);
    expect(await screen.findByText("Something failed.")).toBeTruthy();
  });

  it("reports a failed toggle of one bot after a toggle of another bot started", async () => {
    const baAnswer = heldAnswer();
    open([ba, designer], {
      [`PUT /api/bots/${ba.id}/skills/${SKILL_ID}`]: () => baAnswer.promise,
      [`PUT /api/bots/${designer.id}/skills/${SKILL_ID}`]: () => ({
        body: makeBot(2, "Designer", [
          makePin({ version: 2, skill_version_id: versionId(2), always_load: true }),
        ]),
      }),
    });
    const baSwitch = await screen.findByRole("switch", { name: "Always load for BA" });
    click(baSwitch);
    click(screen.getByRole("switch", { name: "Always load for Designer" }));
    await waitFor(() => {
      expect(api?.sent("PUT", `/api/bots/${designer.id}/skills/${SKILL_ID}`)).toHaveLength(1);
    });
    // BA's request is still on its way: its switch keeps the asked value and stays off.
    expect(baSwitch.getAttribute("aria-checked")).toBe("false");
    expect(baSwitch.hasAttribute("data-disabled")).toBe(true);
    await baAnswer.answer(STALE);
    expect(
      await screen.findByText("BA changed in another place. Check it and try again."),
    ).toBeTruthy();
    await waitFor(() => {
      expect(baSwitch.hasAttribute("data-disabled")).toBe(false);
    });
  });

  // Review of PR #57: a request that ended after its dialog closed closed the next dialog.
  it("keeps a newer dialog open when an Add from a closed dialog ends", async () => {
    const addAnswer = heldAnswer();
    open([designer, qa], {
      [`POST /api/skills/${SKILL_ID}/bots`]: () => addAnswer.promise,
      [`GET /api/skills/${SKILL_ID}/diff`]: () => ({ body: { description: null, body: [] } }),
    });
    await screen.findByRole("row", { name: /Designer/ });
    click(screen.getByRole("button", { name: "Add" }));
    const add = await screen.findByRole("dialog");
    await waitFor(() => {
      expect(within(add).getByText(/They get v3/)).toBeTruthy();
    });
    click(within(add).getByRole("checkbox"));
    click(within(add).getByRole("button", { name: "Add 1" }));
    await waitFor(() => {
      expect(api?.sent("POST", `/api/skills/${SKILL_ID}/bots`)).toHaveLength(1);
    });
    click(within(add).getByRole("button", { name: "Skip" }));
    click(await screen.findByRole("button", { name: "Upgrade to v3" }));
    const upgrade = await screen.findByRole("dialog", {
      name: "Upgrade Write user stories to v3?",
    });
    // The Add request is not the upgrade card's: its button is not pending.
    expect(
      within(upgrade).getByRole("button", { name: "Upgrade to v3" }).getAttribute("aria-disabled"),
    ).not.toBe("true");
    await addAnswer.answer({ body: [makeBot(3, "QA", [makePin()])] });
    await waitFor(() => {
      expect(api?.sent("GET", "/api/bots").length).toBeGreaterThan(1);
    });
    expect(screen.getByRole("dialog", { name: "Upgrade Write user stories to v3?" })).toBeTruthy();
  });

  it("shows a failed Add as a toast when its dialog is closed, not in the next dialog", async () => {
    const addAnswer = heldAnswer();
    open([designer, qa], {
      [`POST /api/skills/${SKILL_ID}/bots`]: () => addAnswer.promise,
      [`GET /api/skills/${SKILL_ID}/diff`]: () => ({ body: { description: null, body: [] } }),
    });
    await screen.findByRole("row", { name: /Designer/ });
    click(screen.getByRole("button", { name: "Add" }));
    const add = await screen.findByRole("dialog");
    await waitFor(() => {
      expect(within(add).getByText(/They get v3/)).toBeTruthy();
    });
    click(within(add).getByRole("checkbox"));
    click(within(add).getByRole("button", { name: "Add 1" }));
    click(within(add).getByRole("button", { name: "Skip" }));
    click(await screen.findByRole("button", { name: "Upgrade to v3" }));
    const upgrade = await screen.findByRole("dialog", {
      name: "Upgrade Write user stories to v3?",
    });
    await addAnswer.answer(STALE);
    expect(
      await screen.findByText("A bot changed in another place. Check the list and try again."),
    ).toBeTruthy();
    expect(within(upgrade).queryByText(/changed in another place/)).toBeNull();
  });

  it("shows loading shapes in the + Add card until the versions load", async () => {
    const versions = heldAnswer();
    open([qa], { [`GET /api/skills/${SKILL_ID}/versions`]: () => versions.promise });
    expect(await screen.findByText("No bot uses this skill yet.")).toBeTruthy();
    click(screen.getByRole("button", { name: "Add" }));
    const dialog = await screen.findByRole("dialog");
    const loading = within(dialog).getByRole("status", { name: "Loading the versions" });
    expect(loading.getAttribute("aria-busy")).toBe("true");
    expect(within(dialog).queryByText(/Loading/)).toBeNull();
    await versions.answer({ body: makeVersions(3) });
    await waitFor(() => {
      expect(within(dialog).queryByRole("status", { name: "Loading the versions" })).toBeNull();
    });
  });

  it("offers Try again when the upgrade card's changes do not load, and keeps a loaded diff", async () => {
    let diffCalls = 0;
    open([designer], {
      [`GET /api/skills/${SKILL_ID}/diff`]: () => {
        diffCalls += 1;
        return diffCalls === 1 ? FAILED : { body: { description: null, body: [] } };
      },
    });
    click(await screen.findByRole("button", { name: "Upgrade to v3" }));
    const dialog = await screen.findByRole("dialog", { name: "Upgrade Write user stories to v3?" });
    const alert = await within(dialog).findByRole("alert");
    expect(alert.textContent).toContain("The app could not load the changes.");
    click(within(alert).getByRole("button", { name: "Try again" }));
    expect(await within(dialog).findByRole("tab", { name: "Body" })).toBeTruthy();
  });

  // Fresh review of the audit: the switch forgot its change on its way when the tab came back.
  it("keeps the Always load value on its way when the owner leaves the tab and comes back", async () => {
    const held = heldAnswer();
    const { leave, back } = open([designer], {
      [`PUT /api/bots/${designer.id}/skills/${SKILL_ID}`]: async () => {
        const answer = await held.promise;
        return answer;
      },
    });
    click(await screen.findByRole("switch", { name: "Always load for Designer" }));
    await waitFor(() => {
      expect(api?.sent("PUT", `/api/bots/${designer.id}/skills/${SKILL_ID}`)).toHaveLength(1);
    });
    leave();
    back();
    const shown = await screen.findByRole("switch", { name: "Always load for Designer" });
    expect(shown.getAttribute("aria-checked")).toBe("true");
    expect(shown.hasAttribute("data-disabled")).toBe(true);
    await held.answer({ body: designer });
  });

  // Owner, 2026-11-03 (Q2): the row goes at once, and comes back with a toast if Remove fails.
  it("takes the row away at once, and brings it back with a toast when Remove fails", async () => {
    const held = heldAnswer();
    open([ba], {
      [`DELETE /api/bots/${ba.id}/skills/${SKILL_ID}`]: async () => {
        const answer = await held.promise;
        return answer;
      },
    });
    click(await screen.findByRole("button", { name: "Actions for BA" }));
    click(await screen.findByRole("menuitem", { name: "Remove" }));
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Actions for BA" })).toBeNull();
    });
    await held.answer(FAILED);
    expect(await screen.findByText("Something failed.")).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Actions for BA" })).toBeTruthy();
  });

  // Second fresh review: a bot added back while its Remove waited stayed hidden.
  it("shows a bot the owner adds back while its Remove is on its way", async () => {
    const held = heldAnswer();
    const pinned = makeBot(3, "QA", [makePin()]);
    let bots: Bot[] = [pinned];
    open([pinned], {
      "GET /api/bots": () => ({ body: bots }),
      [`DELETE /api/bots/${qa.id}/skills/${SKILL_ID}`]: async () => {
        bots = [qa];
        const answer = await held.promise;
        return answer;
      },
      [`POST /api/skills/${SKILL_ID}/bots`]: () => {
        bots = [pinned];
        return { body: [pinned] };
      },
    });
    click(await screen.findByRole("button", { name: "Actions for QA" }));
    click(await screen.findByRole("menuitem", { name: "Remove" }));
    expect(await screen.findByText("No bot uses this skill yet.")).toBeTruthy();
    click(screen.getByRole("button", { name: "Add" }));
    const dialog = await screen.findByRole("dialog");
    click(await within(dialog).findByRole("checkbox"));
    click(within(dialog).getByRole("button", { name: "Add 1" }));
    expect(await screen.findByRole("button", { name: "Actions for QA" })).toBeTruthy();
    await held.answer({ status: 204 });
  });

  // Review of 571375a: the answer of an Always load change sent before a Remove ended the Remove.
  // Q3 (owner, 2026-11-04): the whole row is off while a change of it waits, so Remove cannot
  // go out while an Always load change of the same pin waits. The reducer still keeps the row
  // away when an older change answers after a Remove (`bot-list-state.test.ts`, "Remove of a
  // skill"), for a Remove from another place.
  it("turns Remove off while an Always load change of the row waits, and on after its refresh", async () => {
    const heldToggle = heldAnswer();
    let bots: Bot[] = [ba];
    open([ba], {
      "GET /api/bots": () => ({ body: bots }),
      [`PUT /api/bots/${ba.id}/skills/${SKILL_ID}`]: async () => heldToggle.promise,
      [`DELETE /api/bots/${ba.id}/skills/${SKILL_ID}`]: () => {
        bots = [makeBot(1, "BA", [], { effort: "high" })];
        return { status: 204 };
      },
    });
    click(await screen.findByRole("switch", { name: "Always load for BA" }));
    expect(isOff(screen.getByRole("button", { name: "Actions for BA" }))).toBe(true);
    const toggled = makeBot(1, "BA", [makePin({ always_load: false })], { effort: "high" });
    bots = [toggled];
    await heldToggle.answer({ body: toggled });
    await waitFor(() => {
      expect(isOff(screen.getByRole("button", { name: "Actions for BA" }))).toBe(false);
    });
    click(screen.getByRole("button", { name: "Actions for BA" }));
    click(await screen.findByRole("menuitem", { name: "Remove" }));
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Actions for BA" })).toBeNull();
    });
  });

  // Review of d7c4cd7: a failed Remove whose refresh also failed kept the row hidden.
  it("brings the row back when Remove fails and the refresh fails too", async () => {
    let fail = false;
    open([ba], {
      "GET /api/bots": () => (fail ? FAILED : { body: [ba] }),
      [`DELETE /api/bots/${ba.id}/skills/${SKILL_ID}`]: () => {
        fail = true;
        return FAILED;
      },
    });
    click(await screen.findByRole("button", { name: "Actions for BA" }));
    click(await screen.findByRole("menuitem", { name: "Remove" }));
    expect(await screen.findByText("Something failed.")).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Actions for BA" })).toBeTruthy();
  });

  it("removes a bot from the skill without asking", async () => {
    open([ba], { [`DELETE /api/bots/${ba.id}/skills/${SKILL_ID}`]: () => ({ status: 204 }) });
    click(await screen.findByRole("button", { name: "Actions for BA" }));
    click(await screen.findByRole("menuitem", { name: "Remove" }));
    await waitFor(() => {
      expect(api?.sent("DELETE", `/api/bots/${ba.id}/skills/${SKILL_ID}`)).toHaveLength(1);
    });
  });

  it("shows the error state with Try again when the bots do not load", async () => {
    api = fakeApi({
      "GET /api/bots": () => ({
        status: 500,
        body: { error: { code: "internal_error", message: "Something failed." } },
      }),
      [`GET /api/skills/${SKILL_ID}/versions`]: () => ({ body: makeVersions(3) }),
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    watchQueryClient(queryClient);
    render(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <SkillBotsTab skill={makeSkill()} />
        </TooltipProvider>
      </QueryClientProvider>,
    );
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("The app could not load the bots.");
    expect(within(alert).getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.queryByText("No bot uses this skill yet.")).toBeNull();
  });

  it("does not offer + Add or the upgrade link on a deprecated skill", async () => {
    api = fakeApi({
      "GET /api/bots": () => ({ body: [designer, qa] }),
      [`GET /api/skills/${SKILL_ID}/versions`]: () => ({ body: makeVersions(3) }),
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    watchQueryClient(queryClient);
    render(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <SkillBotsTab skill={makeSkill({ deprecated: true })} />
        </TooltipProvider>
      </QueryClientProvider>,
    );
    await screen.findByRole("row", { name: /Designer/ });
    expect(screen.queryByRole("button", { name: "Add" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Upgrade to/ })).toBeNull();
  });
});
