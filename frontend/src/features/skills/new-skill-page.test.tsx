import { onlineManager, type QueryClient } from "@tanstack/react-query";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { fakeApi, heldAnswer } from "../../../test/fake-api.ts";
import {
  BOT_SETTINGS,
  makeSkill,
  makeVersions,
  SKILL_ID,
  typeId,
  versionId,
} from "../../../test/fixtures.ts";
import { renderApp } from "../../../test/render-app.tsx";
import { CLONE_LOAD_FAILED } from "./save-error.ts";

// The Clone page (skills-page.md §12; plan `dq-180-clone-draft.md`, "Redesign of the page fix").
// The page instance holds the source that its editor opened with:
// - a later read does not close an open editor (frontend-conventions.md §5, DQ-104, DQ-180);
// - a new visit decides from its own first answer, not from data in the cache (DQ-185, DQ-191).
// One claim for each test: `scripts/breaks/pr-92.json` has a break for each.
describe("the Clone page and the reads of its source", () => {
  let api: ReturnType<typeof fakeApi> | null = null;
  afterEach(() => {
    api?.restore();
    api = null;
  });

  const WAIT = { timeout: 5000 };
  const DRAFT = "## Steps\n1. My own first step.";
  const FAILED = { status: 500, body: { error: { code: "internal_error", message: "Failed." } } };
  const CLONE_URL = `/skills/new?from=${versionId(3)}`;

  // The fake server. `listed` is what a read of the skill list answers; `fails` makes it fail;
  // `next`, when set, answers the next read of the list, one time; `settings`, when set,
  // answers the next read of the settings, one time.
  function startServer() {
    const server: {
      listed: unknown[];
      fails: boolean;
      next: ReturnType<typeof heldAnswer>["promise"] | null;
      settings: ReturnType<typeof heldAnswer>["promise"] | null;
    } = { listed: [makeSkill()], fails: false, next: null, settings: null };
    const [v3] = makeVersions(3);
    api = fakeApi({
      "GET /api/settings": () => {
        const { settings } = server;
        server.settings = null;
        return settings ?? { body: BOT_SETTINGS };
      },
      "GET /api/skills": () => {
        const { next } = server;
        server.next = null;
        if (next !== null) return next;
        return server.fails ? FAILED : { body: server.listed };
      },
      [`GET /api/skills/${SKILL_ID}/versions`]: () => ({ body: makeVersions(3) }),
      [`GET /api/skills/${SKILL_ID}/versions/3`]: () => ({
        body: { ...v3, body_md: "## Steps\n1. Read the brief." },
      }),
      "GET /api/bots": () => ({ body: [] }),
    });
    return server;
  }

  // Opens the Clone of v3. With `draft`, it also types a draft in the body.
  async function openClone({ draft = true } = {}) {
    const server = startServer();
    const app = await renderApp(CLONE_URL);
    await screen.findByLabelText("Name", { exact: true }, WAIT);
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

  const nameValue = () => {
    const field = screen.queryByLabelText("Name", { exact: true });
    return field instanceof HTMLInputElement ? field.value : null;
  };

  // A full read, as a `reset` event or a return to the tab starts it, and its end.
  async function readAll(queryClient: QueryClient) {
    await act(() => queryClient.invalidateQueries());
    await waitFor(() => {
      expect(queryClient.isFetching()).toBe(0);
    });
  }

  const slugValue = () => {
    const field = screen.queryByLabelText("Slug", { exact: true });
    return field instanceof HTMLInputElement ? field.value : null;
  };

  const sourceStatus = (queryClient: QueryClient) =>
    queryClient.getQueryState(["skill-clone-source", versionId(3)])?.status;

  // A full read starts and stays on its way. The owner leaves the page and returns before its
  // answer. The returned object gives the answer.
  async function returnDuringRead() {
    const { router, queryClient, server } = await openClone({ draft: false });
    const held = heldAnswer();
    server.next = held.promise;
    void queryClient.invalidateQueries();
    await act(() => router.navigate({ to: "/skills" }));
    await act(() => router.navigate({ to: "/skills/new", search: { from: versionId(3) } }));
    return { held, queryClient, server };
  }

  describe("an open editor", () => {
    it("keeps the typed text when a full read no longer finds the source skill", async () => {
      const { queryClient, server } = await openClone();
      // The source went to Trash in another tab: the list does not have it any more.
      server.listed = [];
      await readAll(queryClient);
      expect(bodyText(), "the draft").toBe(DRAFT);
    });

    it("keeps the typed text when the browser is online again", async () => {
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

    it("keeps the typed text when a later read fails", async () => {
      const { queryClient, server } = await openClone();
      server.fails = true;
      await readAll(queryClient);
      expect(bodyText(), "the draft, failed read").toBe(DRAFT);
    });

    it("keeps the typed text when the source goes away, comes back and goes away again", async () => {
      const { queryClient, server } = await openClone();
      const listed = server.listed;
      server.listed = [];
      await readAll(queryClient);
      server.listed = listed;
      await readAll(queryClient);
      server.listed = [];
      await readAll(queryClient);
      expect(bodyText(), "the draft, gone and back").toBe(DRAFT);
    });
  });

  describe("a first visit", () => {
    it("shows Page not found when no listed skill has the version", async () => {
      startServer().listed = [];
      await renderApp(CLONE_URL);
      expect(await screen.findByText("Page not found", {}, WAIT), "first visit").toBeTruthy();
    });

    // The copy's name is cut to the name limit, so the editor waits for the settings.
    it("shows no editor while the settings are on their way", async () => {
      const server = startServer();
      server.settings = heldAnswer().promise;
      const { queryClient } = await renderApp(CLONE_URL);
      await waitFor(() => {
        expect(sourceStatus(queryClient)).toBe("success");
      });
      expect(nameValue(), "the settings wait").toBeNull();
    });

    // A good answer of this visit stays good: a read that fails later, while the settings are
    // still on their way, is a failed refresh (review of `6ab9430`).
    it("opens the editor after the settings wait when a read failed during the wait", async () => {
      const server = startServer();
      const settings = heldAnswer();
      server.settings = settings.promise;
      const { queryClient } = await renderApp(CLONE_URL);
      await waitFor(() => {
        expect(sourceStatus(queryClient)).toBe("success");
      });
      server.fails = true;
      void queryClient.invalidateQueries();
      await waitFor(() => {
        expect(sourceStatus(queryClient)).toBe("error");
      });
      await settings.answer({ body: BOT_SETTINGS });
      await waitFor(() => {
        expect(nameValue(), "after the settings wait").toBe("Write user stories (copy)");
      });
    });

    it("shows Page not found after a failed read and a Try again with the source gone", async () => {
      const server = startServer();
      server.fails = true;
      await renderApp(CLONE_URL);
      const retry = await screen.findByRole("button", { name: "Try again" }, WAIT);
      server.fails = false;
      server.listed = [];
      act(() => {
        fireEvent.click(retry);
      });
      expect(await screen.findByText("Page not found", {}, WAIT), "after Try again").toBeTruthy();
    });
  });

  // The cache still has the source of the first visit. The page does not open from it.
  describe("a second visit, with no read on its way", () => {
    async function leave() {
      const { router, queryClient, server } = await openClone({ draft: false });
      await act(() => router.navigate({ to: "/skills" }));
      await waitFor(() => {
        expect(queryClient.isFetching()).toBe(0);
      });
      const back = () =>
        act(() => router.navigate({ to: "/skills/new", search: { from: versionId(3) } }));
      return { server, back };
    }

    it("shows Page not found when the source went away since the first visit", async () => {
      const { server, back } = await leave();
      server.listed = [];
      await back();
      expect(await screen.findByText("Page not found", {}, WAIT), "second visit").toBeTruthy();
    });

    // skills-page.md §12: a copy made since the last Clone took `-copy`.
    it("proposes the next free slug when a copy took the first one since the first visit", async () => {
      const { server, back } = await leave();
      const copy = makeSkill({ id: typeId("skill", 9), slug: "write-user-stories-copy" });
      server.listed = [makeSkill(), copy];
      await back();
      await waitFor(() => {
        expect(slugValue(), "the slug of this visit").toBe("write-user-stories-copy-2");
      });
    });
  });

  // A read that is still on its way when the page closes keeps the query, with its old data,
  // in the cache (owner-pasted review of `279500b`).
  describe("a second visit that returns before a pending read ends", () => {
    it("shows Page not found when the answer has no source", async () => {
      const { held } = await returnDuringRead();
      await held.answer({ body: [] });
      expect(await screen.findByText("Page not found", {}, WAIT), "pending read").toBeTruthy();
    });

    it("fills the editor from the answer of this visit, not from the old data", async () => {
      const { held } = await returnDuringRead();
      await held.answer({ body: [makeSkill({ name: "Renamed since" })] });
      await waitFor(() => {
        expect(nameValue(), "the name of this visit").toBe("Renamed since (copy)");
      });
    });

    it("shows the load error when the read fails, not the old editor", async () => {
      const { held } = await returnDuringRead();
      await held.answer(FAILED);
      expect(await screen.findByText(CLONE_LOAD_FAILED, {}, WAIT), "failed return").toBeTruthy();
    });
  });
});
