import { afterEach, beforeEach, describe, it } from "vitest";

/**
 * Contract suites (D35, architecture.md §2): one per port, written against the port only.
 * Every adapter of that port runs the same cases with `runContract`.
 */
export interface Contract<S> {
  port: string;
  cases: Record<string, (subject: S) => Promise<void>>;
}

export interface ContractSetup<S> {
  subject: S;
  teardown(): Promise<void> | void;
}

export function defineContract<S>(
  port: string,
  cases: Record<string, (subject: S) => Promise<void>>,
): Contract<S> {
  return { port, cases };
}

export function runContract<S>(
  contract: Contract<S>,
  adapter: string,
  setup: () => Promise<ContractSetup<S>> | ContractSetup<S>,
): void {
  describe(`${contract.port} contract: ${adapter}`, () => {
    let current: ContractSetup<S> | undefined;
    beforeEach(async () => {
      current = await setup();
    });
    afterEach(async () => {
      await current?.teardown();
      current = undefined;
    });
    for (const [name, run] of Object.entries(contract.cases)) {
      it(name, async () => {
        if (current === undefined) throw new Error("contract setup did not run");
        await run(current.subject);
      });
    }
  });
}
