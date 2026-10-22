import { describe, expect, it } from "vitest";
import { auditWithRetries, judge, type Attempt } from "./audit";

const ok: Attempt = { code: 0, output: "No known vulnerabilities found", timedOut: false };
const found: Attempt = { code: 1, output: "1 high severity vulnerability", timedOut: false };
const badResponse: Attempt = {
  code: 1,
  output: "Error: ERR_PNPM_AUDIT_BAD_RESPONSE\n  operation timed out",
  timedOut: false,
};
const hung: Attempt = { code: null, output: "", timedOut: true };

async function run(results: Attempt[]) {
  const calls: Attempt[] = [...results];
  let runs = 0;
  const result = await auditWithRetries({
    run: async () => {
      runs += 1;
      return calls.shift() ?? badResponse;
    },
    attempts: 4,
    wait: async () => undefined,
    log: () => undefined,
  });
  return { verdict: result.verdict, runs };
}

describe("pnpm audit with retries", () => {
  it.each([
    ["a clean audit", ok, "pass"],
    ["a vulnerability", found, "fail"],
    ["npm's bad-response error", badResponse, "retry"],
    ["an attempt killed by the timeout", hung, "retry"],
  ])("judges %s as %s", (_label, attempt, verdict) => {
    expect(judge(attempt)).toBe(verdict);
  });

  it("a vulnerability fails at once, without retrying", async () => {
    expect(await run([found, ok])).toEqual({ verdict: "fail", runs: 1 });
  });

  it("retries network failures until npm answers", async () => {
    expect(await run([hung, badResponse, ok])).toEqual({ verdict: "pass", runs: 3 });
  });

  it("a vulnerability found after a network failure still fails", async () => {
    expect(await run([badResponse, found])).toEqual({ verdict: "fail", runs: 2 });
  });

  it("fails when npm never answers", async () => {
    expect(await run([])).toEqual({ verdict: "fail", runs: 4 });
  });
});
