import type { RunId } from "@cty1ng/shared/ids";

// The job queue port (architecture.md §2, §6). Types only: the in-process adapter comes with
// the runs slice (M3), which may change this interface with the owner's review.
export interface ClaimedRun {
  runId: RunId;
  attempt: number; // the fencing token (architecture.md §11)
  lockedUntil: Date;
}

export interface Queue {
  // Claims the oldest queued run whose conversation has no running run, or reclaims one whose
  // lease expired. Null when there is nothing to claim.
  claim(now: Date, leaseSeconds: number): Promise<ClaimedRun | null>;
  finish(run: ClaimedRun): Promise<boolean>;
  fail(run: ClaimedRun, error: string): Promise<boolean>;
}
