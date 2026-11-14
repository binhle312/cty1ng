import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { heldAnswer, watchQueryClient } from "./fake-api.ts";

// `heldAnswer` waits on the query client of the page under test (DQ-110). Without that client the
// wait checks nothing, so the helper fails loudly when the client is missing or left over from an
// earlier test (DQ-115).
describe("heldAnswer", () => {
  it("fails when the test set no query client", async () => {
    const held = heldAnswer();
    await expect(held.answer({ body: [] }), "no client").rejects.toThrow(/watchQueryClient/);
  });

  // The two tests below run in this order (Vitest runs the tests of a file one after another):
  // the first sets a client, the second must not use it.
  it("takes the answer when the test set its query client", async () => {
    watchQueryClient(new QueryClient());
    const held = heldAnswer();
    await held.answer({ body: [] });
    await expect(held.promise).resolves.toEqual({ body: [] });
  });

  it("fails when only an earlier test set the query client", async () => {
    const held = heldAnswer();
    await expect(held.answer({ body: [] }), "left over").rejects.toThrow(/watchQueryClient/);
  });
});
