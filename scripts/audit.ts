/**
 * `pnpm audit:deps`: `pnpm audit --audit-level high` with retries (security.md §2.11).
 *
 * npm's bulk advisory endpoint sometimes hangs or answers 503 for a request that succeeds a
 * moment later, and `pnpm audit` makes one attempt. This retries only those network failures.
 * A real finding fails at once: the gate is never weakened.
 */
import { spawn } from "node:child_process";

export interface Attempt {
  code: number | null;
  output: string;
  timedOut: boolean;
}

export type Verdict = "pass" | "fail" | "retry";

/** pnpm's error when the advisory endpoint did not answer (timeout, 5xx, connection reset). */
const NETWORK_FAILURE = /ERR_PNPM_AUDIT_BAD_RESPONSE|ERR_PNPM_AUDIT_ENDPOINT|ETIMEDOUT|ECONNRESET/;

export function judge(attempt: Attempt): Verdict {
  if (attempt.timedOut) return "retry";
  if (attempt.code === 0) return "pass";
  return NETWORK_FAILURE.test(attempt.output) ? "retry" : "fail";
}

export async function auditWithRetries(input: {
  run: () => Promise<Attempt>;
  attempts: number;
  wait: (ms: number) => Promise<void>;
  log: (line: string) => void;
}): Promise<Attempt & { verdict: "pass" | "fail" }> {
  let last: Attempt = { code: null, output: "", timedOut: false };
  for (let attempt = 1; attempt <= input.attempts; attempt += 1) {
    last = await input.run();
    const verdict = judge(last);
    if (verdict !== "retry") return { ...last, verdict };
    if (attempt < input.attempts) {
      const ms = 5_000 * 2 ** (attempt - 1);
      input.log(
        `audit: npm's advisory endpoint did not answer (attempt ${attempt}); retrying in ${ms / 1000} s`,
      );
      await input.wait(ms);
    }
  }
  input.log(`audit: npm's advisory endpoint did not answer after ${input.attempts} attempts`);
  return { ...last, verdict: "fail" };
}

const ATTEMPT_TIMEOUT_MS = 60_000;

function runPnpmAudit(): Promise<Attempt> {
  return new Promise((resolve) => {
    const child = spawn("pnpm", ["audit", "--audit-level", "high"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let timedOut = false;
    child.stdout.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => (output += chunk.toString()));
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, ATTEMPT_TIMEOUT_MS);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, output, timedOut });
    });
  });
}

if (import.meta.main) {
  const result = await auditWithRetries({
    run: runPnpmAudit,
    attempts: 4,
    wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    log: (line) => process.stderr.write(`${line}\n`),
  });
  process.stdout.write(result.output);
  process.exit(result.verdict === "pass" ? 0 : 1);
}
