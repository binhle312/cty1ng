import type { QueryClient } from "@tanstack/react-query";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { fakeApi, heldAnswer } from "../../../test/fake-api.ts";
import { BOT_SETTINGS, makeSkill, makeVersions, SKILL_ID } from "../../../test/fixtures.ts";
import { renderApp } from "../../../test/render-app.tsx";

const WAIT = { timeout: 5000 };
const FAILED = { status: 500, body: { error: { code: "internal_error", message: "Failed." } } };
const VERSIONS_FAILED = "The app could not load the versions.";
const CHANGES_FAILED = "The app could not load the changes.";

type Answer = Awaited<ReturnType<typeof heldAnswer>["promise"]>;

// Ten unchanged lines and one added line: the diff folds the first seven unchanged lines
// (`diff-fold.ts`), with the same fold key for each pair. `tag` makes the text of each pair
// differ, so a test can see which lines show.
function diffOf(tag: string) {
  return {
    description: null,
    body: [
      ...Array.from({ length: 10 }, (_, i) => ({ op: "same", text: `${tag} line ${String(i)}` })),
      { op: "add", text: `${tag} added` },
    ],
  };
}

// The fake server. `versions` answers each read of the versions; `diff` each read of a diff,
// with the pair of the request.
function startServer() {
  const server: {
    versions: () => Answer | Promise<Answer>;
    diff: (from: string | null, to: string | null) => Answer | Promise<Answer>;
  } = {
    versions: () => ({ body: makeVersions(3) }),
    diff: (from, to) => ({ body: diffOf(`v${String(from)}-v${String(to)}`) }),
  };
  const api = fakeApi({
    "GET /api/settings": () => ({ body: BOT_SETTINGS }),
    "GET /api/skills": () => ({ body: [makeSkill()] }),
    [`GET /api/skills/${SKILL_ID}`]: () => ({ body: makeSkill() }),
    [`GET /api/skills/${SKILL_ID}/versions`]: () => server.versions(),
    [`GET /api/skills/${SKILL_ID}/upgrade-candidates`]: () => ({ body: [] }),
    [`GET /api/skills/${SKILL_ID}/diff`]: (_request, search) =>
      server.diff(search.get("from"), search.get("to")),
    "GET /api/bots": () => ({ body: [] }),
  });
  return { api, server };
}

// A read of all data, as a window focus or a `reset` event starts it, and its end.
async function refreshAll(queryClient: QueryClient) {
  await act(() => queryClient.invalidateQueries());
  await waitFor(() => {
    expect(queryClient.isFetching()).toBe(0);
  });
}

// The History tab (skills-page.md §13). A failed background refresh keeps the data the tab has
// (skills-page.md, "A failed background refresh keeps the list"; P3 list item 59). The order
// cases of testing.md §3, "The refresh after a change is slow or fails".
describe("the History tab and a background refresh", () => {
  let api: ReturnType<typeof fakeApi> | null = null;
  afterEach(() => {
    api?.restore();
    api = null;
  });

  async function openHistory() {
    const started = startServer();
    api = started.api;
    const app = await renderApp("/skills/write-user-stories?tab=history&from=1&to=3");
    await screen.findByRole("list", { name: "Versions" }, WAIT);
    await screen.findByText("v1-v3 added", {}, WAIT);
    return { ...app, server: started.server };
  }

  it("keeps the versions when a refresh of the versions fails", async () => {
    const { queryClient, server } = await openHistory();
    server.versions = () => FAILED;
    await refreshAll(queryClient);
    expect(screen.queryByRole("list", { name: "Versions" }), "the versions").not.toBeNull();
    expect(screen.queryByText(VERSIONS_FAILED), "no load error of the versions").toBeNull();
  });

  it("keeps the changes when a refresh of the diff fails", async () => {
    const { queryClient, server } = await openHistory();
    server.diff = () => FAILED;
    await refreshAll(queryClient);
    expect(screen.queryByText("v1-v3 added"), "the changes").not.toBeNull();
    expect(screen.queryByText(CHANGES_FAILED), "no load error of the changes").toBeNull();
  });

  // Guards, not fix claims: the old code passed them too.
  it("keeps the versions while a refresh of the versions waits", async () => {
    const { queryClient, server } = await openHistory();
    const held = heldAnswer();
    server.versions = () => held.promise;
    void queryClient.invalidateQueries();
    await waitFor(() => {
      expect(queryClient.isFetching()).toBeGreaterThan(0);
    });
    const list = screen.queryByRole("list", { name: "Versions" });
    expect(list, "the versions, waiting").not.toBeNull();
    await held.answer({ body: makeVersions(3) });
  });

  it("shows the new versions after a failed refresh and a good one", async () => {
    const { queryClient, server } = await openHistory();
    server.versions = () => FAILED;
    await refreshAll(queryClient);
    const [v3, ...older] = makeVersions(3);
    server.versions = () => ({ body: [{ ...v3, changelog: "A newer note" }, ...older] });
    await refreshAll(queryClient);
    expect(await screen.findByText("A newer note"), "the new versions").toBeTruthy();
  });

  it("shows the load errors when the first loads fail", async () => {
    const started = startServer();
    api = started.api;
    started.server.versions = () => FAILED;
    started.server.diff = () => FAILED;
    await renderApp("/skills/write-user-stories?tab=history&from=1&to=3");
    expect(await screen.findByText(VERSIONS_FAILED, {}, WAIT)).toBeTruthy();
    expect(await screen.findByText(CHANGES_FAILED, {}, WAIT)).toBeTruthy();
  });
});

// The folds of a diff belong to one pair of versions (P3 list item 63).
describe("the folds of the History diff", () => {
  let api: ReturnType<typeof fakeApi> | null = null;
  afterEach(() => {
    api?.restore();
    api = null;
  });

  // A pair that the cache does not have shows its skeleton first, so its diff starts new. A pair
  // that the cache has shows its diff at once, in the same diff view.
  it("closes the open folds when the pair of versions changes", async () => {
    api = startServer().api;
    const { router } = await renderApp("/skills/write-user-stories?tab=history&from=1&to=3");
    const pickPair = (from: number) =>
      act(() =>
        router.navigate({
          to: "/skills/$slug",
          params: { slug: "write-user-stories" },
          search: { tab: "history", from, to: 3 },
        }),
      );
    await screen.findByText("v1-v3 added", {}, WAIT);
    await pickPair(2);
    const body = await screen.findByLabelText("Body changes", {}, WAIT);
    await within(body).findByText("v2-v3 added", {}, WAIT);
    act(() => {
      fireEvent.click(within(body).getByRole("button", { name: "Show" }));
    });
    expect(within(body).getByText("v2-v3 line 0")).toBeTruthy();
    await pickPair(1);
    await screen.findByText("v1-v3 added", {}, WAIT);
    expect(screen.queryByText("v1-v3 line 0"), "the fold of the new pair is closed").toBeNull();
  });
});

// A diff is a group with a name, so a screen reader reads its label: `aria-label` on an element
// with no role is not read (P3 list item 64).
describe("the diff of the History tab", () => {
  let api: ReturnType<typeof fakeApi> | null = null;
  afterEach(() => {
    api?.restore();
    api = null;
  });

  it("is a group named Body changes", async () => {
    api = startServer().api;
    await renderApp("/skills/write-user-stories?tab=history&from=1&to=3");
    expect(
      await screen.findByRole("group", { name: "Body changes" }, WAIT),
      "the diff is a group",
    ).toBeTruthy();
  });
});
