import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// The mark that the end-to-end servers on the ports are ours: `pnpm e2e:serve` writes its process
// id here once its own servers hold the ports (./e2e-serve-run.ts), and `pnpm e2e` reuses a server
// only while that process runs. `pnpm e2e` writes test data into whatever server it reuses, so a
// server left by an old run, by another checkout, or the real app is never reused (testing.md §3).
// The file is in the checkout, so each checkout has its own.
export const SERVE_MARKER_PATH =
  process.env.E2E_SERVE_MARKER ?? resolve(import.meta.dirname, "..", "..", ".e2e-serve");

function processRuns(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function serveIsRunning(path: string): boolean {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return false;
  }
  return /^[1-9]\d*$/.test(text) && processRuns(Number(text));
}

export function writeServeMarker({ path, pid }: { path: string; pid: number }): void {
  writeFileSync(path, String(pid));
}

export function removeServeMarker(path: string): void {
  rmSync(path, { force: true });
}
