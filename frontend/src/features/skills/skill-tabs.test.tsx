import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { fakeApi } from "../../../test/fake-api.ts";
import { BOT_SETTINGS, makeSkill, makeVersions, SKILL_ID } from "../../../test/fixtures.ts";
import { renderApp } from "../../../test/render-app.tsx";

// The tabs of the skill page and their `?tab=` (skills-page.md §1): Skill has no `tab`, and a
// `tab` that is not a tab opens Skill.
describe("the tabs of the skill page", () => {
  let api: ReturnType<typeof fakeApi> | null = null;
  afterEach(() => {
    api?.restore();
    api = null;
  });

  async function open(path: string) {
    const skill = makeSkill();
    api = fakeApi({
      "GET /api/settings": () => ({ body: BOT_SETTINGS }),
      "GET /api/skills": () => ({ body: [skill] }),
      [`GET /api/skills/${SKILL_ID}`]: () => ({ body: skill }),
      [`GET /api/skills/${SKILL_ID}/versions`]: () => ({ body: makeVersions(3) }),
      "GET /api/bots": () => ({ body: [] }),
    });
    const { router } = await renderApp(path);
    await screen.findByRole("tab", { name: "Skill" }, { timeout: 5000 });
    return router;
  }

  const selected = () =>
    screen.getAllByRole("tab").find((tab) => tab.getAttribute("aria-selected") === "true");

  it("writes each tab into the URL, and Skill as no tab", async () => {
    const router = await open("/skills/write-user-stories");
    const click = (name: RegExp) => {
      act(() => {
        fireEvent.click(screen.getByRole("tab", { name }));
      });
    };
    click(/^Bots/);
    await waitFor(() => {
      expect(router.state.location.search).toEqual({ tab: "bots" });
    });
    click(/^History/);
    await waitFor(() => {
      expect(router.state.location.search).toEqual({ tab: "history" });
    });
    click(/^Skill$/);
    await waitFor(() => {
      expect(router.state.location.search).toEqual({});
    });
    expect(selected()?.textContent).toBe("Skill");
  });

  it("opens the Skill tab for a tab that is not a tab", async () => {
    await open("/skills/write-user-stories?tab=nope");
    expect(selected()?.textContent).toBe("Skill");
  });
});
