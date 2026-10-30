import { describe, expect, it } from "vitest";
import { groupAlive, spawnGroup, stopGroup } from "./process-group.ts";

// A shell that starts a background child: stopping only the shell would leave the child.
function startTree(script: string): number {
  const child = spawnGroup(script, { env: process.env, stdio: "ignore" });
  if (child.pid === undefined) throw new Error("the shell did not start");
  return child.pid;
}

describe("process groups", () => {
  it("stops the shell and its children, and returns only when all have stopped", async () => {
    const pid = startTree("sleep 60 & sleep 60");
    expect(groupAlive(pid)).toBe(true);
    await stopGroup(pid, { signal: "SIGTERM", timeoutMs: 5_000 });
    expect(groupAlive(pid)).toBe(false);
  });

  it("kills a group that ignores the signal once the timeout passes", async () => {
    // An ignored signal stays ignored in the children the shell starts.
    const pid = startTree("trap '' TERM; sleep 60 & sleep 60");
    await stopGroup(pid, { signal: "SIGTERM", timeoutMs: 200 });
    expect(groupAlive(pid)).toBe(false);
  });
});
