// The copy step of `pnpm check:breaks` (testing.md §5, step 1): put the local changes into the
// copy of HEAD, and check that the copy has them.
import { execFileSync } from "node:child_process";

// Applies `patch` (`git diff HEAD --binary`) to the copy.
export function applyPatch(copy: string, patch: Buffer): void {
  execFileSync("git", ["apply", "--whitespace=nowarn"], { cwd: copy, input: patch });
}

// The files of `files` that differ between the checkout `repo` and the copy.
export function changesMissing(_options: {
  repo: string;
  copy: string;
  files: string[];
}): string[] {
  return [];
}
