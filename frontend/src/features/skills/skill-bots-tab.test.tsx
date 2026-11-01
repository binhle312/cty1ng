import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { fakeApi } from "../../../test/fake-api.ts";
import {
  makeBot,
  makePin,
  makeSkill,
  makeVersions,
  SKILL_ID,
  versionId,
  type Bot,
} from "../../../test/fixtures.ts";
import { TooltipProvider } from "../../components/ui/tooltip.tsx";
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
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SkillBotsTab skill={makeSkill()} />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

const click = (element: HTMLElement) => {
  act(() => {
    fireEvent.click(element);
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
    // Add is at 40% until a box is ticked.
    expect(screen.getByRole("button", { name: "Add" }).getAttribute("aria-disabled")).toBe("true");
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
