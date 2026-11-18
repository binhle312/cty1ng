import { expect, type Page } from "@playwright/test";

// A check that something did not happen is real only after the page took every answer
// (docs/testing.md §3, "Test helpers"). The component tests wait for the query client
// (`heldAnswer`, DQ-110); an end-to-end test cannot reach it, so it counts the page's own
// requests. `watchRequests` wraps the page's fetch before the app loads: a request is open from
// the call until its body is read (a clone of it), or until it fails. The stream is an
// EventSource, not a fetch, so it does not count.
export async function watchRequests(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const count = { started: 0, open: 0 };
    Object.assign(window, { __requests: count });
    const original = window.fetch.bind(window);
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      count.started += 1;
      count.open += 1;
      try {
        const response = await original(...args);
        await response.clone().arrayBuffer();
        return response;
      } finally {
        count.open -= 1;
      }
    };
  });
}

// Waits until the page has no open request and starts none for some turns of its event loop.
// The turns give the page time to act on the last answer: the client parses it, TanStack Query
// tells the page on a zero-delay timer, and React renders. A retry that waits on its own timer
// has no open request in the meantime, so a test with retries first waits for their count.
export async function pageIsQuiet(page: Page): Promise<void> {
  // One window of two quiet checks in a row, in one call: a request that starts and ends between
  // two calls would be in neither check.
  const quiet = () =>
    page.evaluate(async () => {
      const count: unknown = Reflect.get(window, "__requests");
      if (
        typeof count !== "object" ||
        count === null ||
        !("started" in count) ||
        !("open" in count)
      )
        throw new Error("watchRequests(page) was not called before the page loaded.");
      const before = Number(count.started);
      const threeTurns = async () => {
        for (let n = 0; n < 3; n += 1) await new Promise((resolve) => setTimeout(resolve, 0));
      };
      await threeTurns();
      if (Number(count.open) !== 0) return false;
      await threeTurns();
      return Number(count.open) === 0 && Number(count.started) === before;
    });
  await expect.poll(quiet, { message: "the page stays quiet" }).toBe(true);
}
