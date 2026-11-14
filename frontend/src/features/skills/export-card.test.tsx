import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { fakeApi } from "../../../test/fake-api.ts";
import { BOT_SETTINGS, makeSkill, makeVersions, SKILL_ID, typeId } from "../../../test/fixtures.ts";
import { renderApp } from "../../../test/render-app.tsx";

const WAIT = { timeout: 5000 };

const notes = makeSkill({ id: typeId("skill", 2), slug: "notes", name: "Notes" });
const review = makeSkill({ id: typeId("skill", 3), slug: "review", name: "Review" });

// The Export card (skills-page.md §16) while its list changes: a skill that leaves the list in
// another tab (Deprecate or Delete) leaves the count too (P3 list item 62).
describe("the Export card when a skill leaves the list", () => {
  let api: ReturnType<typeof fakeApi> | null = null;
  afterEach(() => {
    api?.restore();
    api = null;
  });

  async function openCardThenLoseOne() {
    const server = { listed: [makeSkill(), notes, review] };
    api = fakeApi({
      "GET /api/settings": () => ({ body: BOT_SETTINGS }),
      "GET /api/skills": () => ({ body: server.listed }),
      [`GET /api/skills/${SKILL_ID}`]: () => ({ body: makeSkill() }),
      [`GET /api/skills/${SKILL_ID}/versions`]: () => ({ body: makeVersions(3) }),
      [`GET /api/skills/${SKILL_ID}/upgrade-candidates`]: () => ({ body: [] }),
      "GET /api/bots": () => ({ body: [] }),
    });
    const { queryClient } = await renderApp("/skills/write-user-stories");
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Export" }));
    });
    const card = await screen.findByRole("dialog", { name: "Export skills 📦" }, WAIT);
    await within(card).findByRole("button", { name: "Export 3 skills" });
    // Notes went to Trash in another tab; a read of all data brings the new list.
    server.listed = [makeSkill(), review];
    await act(() => queryClient.invalidateQueries());
    await waitFor(() => {
      expect(queryClient.isFetching()).toBe(0);
    });
    await waitFor(() => {
      expect(within(card).queryByText("Notes")).toBeNull();
    });
    return card;
  }

  it("counts only the ticked skills that are in the list", async () => {
    const card = await openCardThenLoseOne();
    expect(
      within(card).queryByRole("button", { name: "Export 2 skills" }),
      "the button counts the listed skills",
    ).not.toBeNull();
  });

  it("ticks Select all when every listed skill is ticked", async () => {
    const card = await openCardThenLoseOne();
    const selectAll = within(card).getByRole("checkbox", { name: "Select all" });
    expect(selectAll.getAttribute("aria-checked"), "Select all is ticked").toBe("true");
  });
});
