import { onlineManager } from "@tanstack/react-query";
import { afterEach, describe, expect, it } from "vitest";
import { createQueryClient } from "./query-client.ts";

// DQ-088. These run the real TanStack Query: the pause after an `offline` event is the library's
// behaviour, and a mock would only repeat what the default assumes.
afterEach(() => {
  onlineManager.setOnline(true);
});

describe("createQueryClient", () => {
  it("offline: a read runs and answers", async () => {
    const queryClient = createQueryClient();
    onlineManager.setOnline(false);
    const answer = await queryClient.query({
      queryKey: ["things"],
      queryFn: () => Promise.resolve(["one"]),
    });
    expect(answer).toEqual(["one"]);
  });

  it("offline: a save runs and answers", async () => {
    const queryClient = createQueryClient();
    onlineManager.setOnline(false);
    const mutation = queryClient.getMutationCache().build(queryClient, {
      mutationFn: (value: string) => Promise.resolve(`saved ${value}`),
    });
    await expect(mutation.execute("text")).resolves.toBe("saved text");
  });

  it("offline: a failed read retries, and does not pause", async () => {
    const queryClient = createQueryClient({ retryDelay: 0 });
    onlineManager.setOnline(false);
    let calls = 0;
    const read = queryClient.query({
      queryKey: ["things"],
      queryFn: () => {
        calls += 1;
        return calls < 3 ? Promise.reject(new Error("down")) : Promise.resolve(["one"]);
      },
      retry: 2,
    });
    await expect(read).resolves.toEqual(["one"]);
    expect(calls).toBe(3);
  });

  it("keeps the other options that a caller gives", () => {
    const queryClient = createQueryClient({ retry: false });
    expect(queryClient.getDefaultOptions().queries?.retry).toBe(false);
    expect(queryClient.getDefaultOptions().queries?.networkMode).toBe("always");
    expect(queryClient.getDefaultOptions().mutations?.networkMode).toBe("always");
  });
});
