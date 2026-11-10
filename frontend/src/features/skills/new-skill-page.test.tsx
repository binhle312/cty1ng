import { onlineManager } from "@tanstack/react-query";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { fakeApi } from "../../../test/fake-api.ts";
import {
  BOT_SETTINGS,
  makeSkill,
  makeVersions,
  SKILL_ID,
  versionId,
} from "../../../test/fixtures.ts";
import { renderApp } from "../../../test/render-app.tsx";

// frontend-conventions.md §5: a later read does not close an open form (DQ-104, DQ-180). The
// Clone page reads its source again on each full read (a `reset` event, or a return to the tab),
// and when the browser is online again.
describe("a Clone draft when its source is read again", () => {
  let api: ReturnType<typeof fakeApi> | null = null;
  afterEach(() => {
    api?.restore();
    api = null;
  });

  const SOURCE_BODY = "## Steps\n1. Read the brief.";
  const WAIT = { timeout: 5000 };
  const DRAFT = "## Steps\n1. My own first step.";

  // Opens the Clone of v3 and types a draft. `server.listed` is what the next list read answers.
  async function openClone({ draft = true } = {}) {
    const skill = makeSkill();
    const server = { listed: [skill] };
    const [v3] = makeVersions(3);
    api = fakeApi({
      "GET /api/settings": () => ({ body: BOT_SETTINGS }),
      "GET /api/skills": () => ({ body: server.listed }),
      [`GET /api/skills/${SKILL_ID}/versions`]: () => ({ body: makeVersions(3) }),
      [`GET /api/skills/${SKILL_ID}/versions/3`]: () => ({ body: { ...v3, body_md: SOURCE_BODY } }),
      "GET /api/bots": () => ({ body: [] }),
    });
    const app = await renderApp(`/skills/new?from=${versionId(3)}`);
    await screen.findByLabelText("Name", { exact: true }, { timeout: 5000 });
    if (!draft) return { ...app, server };
    // A Clone opens with the source's text, on the preview.
    act(() => {
      fireEvent.click(screen.getByRole("tab", { name: "Write" }));
    });
    act(() => {
      fireEvent.change(screen.getByLabelText("Body", { exact: true }), {
        target: { value: DRAFT },
      });
    });
    return { ...app, server };
  }

  const bodyText = () => {
    const field = screen.queryByLabelText("Body", { exact: true });
    return field instanceof HTMLTextAreaElement ? field.value : null;
  };

  it("keeps the editor and the typed text when the source skill is no longer listed", async () => {
    const { queryClient, server } = await openClone();
    // The source went to Trash in another tab: the list does not have it any more.
    server.listed = [];
    await act(() => queryClient.invalidateQueries());
    await waitFor(() => {
      expect(queryClient.isFetching()).toBe(0);
    });
    expect(bodyText(), "the draft").toBe(DRAFT);
  });

  it("keeps the editor and the typed text when the browser is online again", async () => {
    const { queryClient, server } = await openClone();
    server.listed = [];
    // How many answers the Clone source read has had. Other parts of the page read the skill
    // list too, so a count of list requests does not show that this read ran again.
    const sourceAnswers = () =>
      queryClient.getQueryState(["skill-clone-source", versionId(3)])?.dataUpdateCount ?? 0;
    const before = sourceAnswers();
    act(() => {
      onlineManager.setOnline(false);
    });
    act(() => {
      onlineManager.setOnline(true);
    });
    // The test proves nothing if the source is not read again: then it must fail here.
    await waitFor(() => {
      expect(sourceAnswers(), "the source is read again").toBeGreaterThan(before);
    });
    expect(bodyText(), "the draft, online again").toBe(DRAFT);
  });

  // The kept source lives only while the page is open (`gcTime: 0`).
  it("shows Page not found on a second visit after the source went away", async () => {
    const { router, queryClient, server } = await openClone({ draft: false });
    await act(() => router.navigate({ to: "/skills" }));
    await waitFor(() => {
      expect(queryClient.isFetching()).toBe(0);
    });
    server.listed = [];
    await act(() => router.navigate({ to: "/skills/new", search: { from: versionId(3) } }));
    expect(await screen.findByText("Page not found", {}, WAIT), "second visit").toBeTruthy();
  });

  it("shows Page not found on a first visit when the version does not exist", async () => {
    api = fakeApi({
      "GET /api/settings": () => ({ body: BOT_SETTINGS }),
      "GET /api/skills": () => ({ body: [] }),
      "GET /api/bots": () => ({ body: [] }),
    });
    await renderApp(`/skills/new?from=${versionId(3)}`);
    expect(await screen.findByText("Page not found", {}, WAIT), "first visit").toBeTruthy();
  });
});
