import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { type Bot, makeBot, makePin, SKILL_ID, versionId } from "../../../test/fixtures.ts";
import { listBotsQueryKey } from "../../lib/api/generated/@tanstack/react-query.gen.ts";
import {
  botListLoads,
  sendPinChange,
  useAlwaysLoadsOnTheirWay,
  withPinAnswer,
  writePinAnswer,
} from "./pin-answer.ts";

// A pin answer writes only the pin of its own skill, and only while the page shows the pin the
// request expected (bot-page.md §7, skills-page.md §2a).
const v2 = makePin({ version: 2, skill_version_id: versionId(2) });
const v3 = makePin();

describe("a pin answer", () => {
  it("counts the server loads of the bot list, with no component on the page", async () => {
    const queryClient = new QueryClient();
    const before = botListLoads(queryClient);
    await queryClient.query({ queryKey: listBotsQueryKey(), queryFn: () => [] });
    // A write from an answer is not a load.
    queryClient.setQueryData(listBotsQueryKey(), []);
    expect(botListLoads(queryClient)).toBe(before + 1);
  });

  it("takes the answer's pin while the page shows the pin the request expected", () => {
    const bot = makeBot(1, "BA", [v2]);
    const next = withPinAnswer({
      bot,
      answer: makeBot(1, "BA", [v3]),
      skillId: SKILL_ID,
      expected: { skill_version_id: versionId(2), always_load: false },
    });
    expect(next.pins).toEqual([v3]);
  });

  it("keeps a newer pin that is not the one the request expected", () => {
    const newer = { ...v2, always_load: true };
    const bot = makeBot(1, "BA", [newer]);
    const next = withPinAnswer({
      bot,
      answer: makeBot(1, "BA", [v3]),
      skillId: SKILL_ID,
      expected: { skill_version_id: versionId(2), always_load: false },
    });
    expect(next).toBe(bot);
  });

  it("adds a new pin only when the page has no pin of that skill (expected null)", () => {
    const added = withPinAnswer({
      bot: makeBot(1, "BA"),
      answer: makeBot(1, "BA", [v3]),
      skillId: SKILL_ID,
      expected: null,
    });
    expect(added.pins).toEqual([v3]);
    expect(added.counts.skills).toBe(1);
    const there = makeBot(1, "BA", [v2]);
    expect(
      withPinAnswer({
        bot: there,
        answer: makeBot(1, "BA", [v3]),
        skillId: SKILL_ID,
        expected: null,
      }),
    ).toBe(there);
  });

  it("keeps every other field of the bot: a newer Profile save may have come first", () => {
    const bot = { ...makeBot(1, "BA", [v2]), row_version: 2, description: "Newer." };
    const next = withPinAnswer({
      bot,
      answer: { ...makeBot(1, "BA", [{ ...v3, latest_version: 4 }]), description: "Older." },
      skillId: SKILL_ID,
      expected: { skill_version_id: versionId(2), always_load: false },
    });
    expect(next.row_version).toBe(2);
    expect(next.description).toBe("Newer.");
    expect(next.counts.skill_updates).toBe(1);
  });

  it("writes nothing after a list load that came after the request went out", async () => {
    const queryClient = new QueryClient();
    const shown: Bot[] = [makeBot(1, "BA", [v2])];
    queryClient.setQueryData(listBotsQueryKey(), shown);
    const loadsAtSend = botListLoads(queryClient);
    await queryClient.query({ queryKey: listBotsQueryKey(), queryFn: () => shown });
    writePinAnswer({
      queryClient,
      answer: makeBot(1, "BA", [v3]),
      skillId: SKILL_ID,
      expected: { skill_version_id: versionId(2), always_load: false },
      loadsAtSend,
    });
    expect(queryClient.getQueryData<Bot[]>(listBotsQueryKey())?.[0]?.pins).toEqual([v2]);
  });

  it("ends a pin change only after the refresh that follows its answer", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(listBotsQueryKey(), [makeBot(1, "BA", [v2])]);
    const steps: string[] = [];
    let endRefresh: () => void = () => undefined;
    const done = sendPinChange({
      queryClient,
      request: () => Promise.resolve(makeBot(1, "BA", [v3])),
      botId: makeBot(1, "BA").id,
      skillId: SKILL_ID,
      alwaysLoad: true,
      expected: { skill_version_id: versionId(2), always_load: false },
      onFailed: () => {
        steps.push("failed");
      },
      refresh: () =>
        new Promise<void>((resolve) => {
          steps.push("refresh");
          endRefresh = resolve;
        }),
    }).then(() => {
      steps.push("done");
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(steps).toEqual(["refresh"]);
    expect(queryClient.getQueryData<Bot[]>(listBotsQueryKey())?.[0]?.pins).toEqual([v3]);
    endRefresh();
    await done;
    expect(steps).toEqual(["refresh", "done"]);
  });

  it("reports a failed pin change at once, and still refreshes", async () => {
    const queryClient = new QueryClient();
    const steps: string[] = [];
    await sendPinChange({
      queryClient,
      request: () => Promise.reject(new Error("no")),
      botId: makeBot(1, "BA").id,
      skillId: SKILL_ID,
      alwaysLoad: true,
      expected: null,
      onFailed: () => {
        steps.push("failed");
      },
      refresh: () => {
        steps.push("refresh");
        return Promise.resolve();
      },
    });
    expect(steps).toEqual(["failed", "refresh"]);
  });

  it("keeps the Always load value on its way, with no component, until the refresh ends", async () => {
    const queryClient = new QueryClient();
    const seen: (boolean | null)[] = [];
    let endRefresh: () => void = () => undefined;
    const done = sendPinChange({
      queryClient,
      request: () => Promise.resolve(makeBot(1, "BA", [v3])),
      botId: makeBot(1, "BA").id,
      skillId: SKILL_ID,
      alwaysLoad: true,
      expected: { skill_version_id: versionId(2), always_load: false },
      onFailed: () => undefined,
      refresh: () =>
        new Promise<void>((resolve) => {
          endRefresh = resolve;
        }),
    });
    const { result } = renderHook(() => useAlwaysLoadsOnTheirWay(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });
    seen.push(result.current({ botId: makeBot(1, "BA").id, skillId: SKILL_ID }));
    await Promise.resolve();
    await Promise.resolve();
    endRefresh();
    await act(() => done);
    seen.push(result.current({ botId: makeBot(1, "BA").id, skillId: SKILL_ID }));
    expect(seen).toEqual([true, null]);
  });
});
