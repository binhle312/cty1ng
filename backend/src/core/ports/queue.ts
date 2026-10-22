import type { ConversationId, RunId } from "@cty1ng/shared";

/**
 * The job queue port (architecture.md §6). Types only: the in-process adapter comes in M3,
 * which may refine these shapes. Every write after a claim carries the attempt number as the
 * fencing token (architecture.md §11).
 */
export interface ClaimedRun {
  runId: RunId;
  conversationId: ConversationId;
  attempt: number;
  lockedUntil: Date;
}

export interface RunQueue {
  enqueue(input: { runId: RunId; conversationId: ConversationId }): Promise<void>;
  /** Claims the oldest queued run whose conversation has no running run, or returns null. */
  claim(input: { now: Date; leaseSeconds: number }): Promise<ClaimedRun | null>;
  /** False when the fencing token no longer matches (another worker reclaimed the run). */
  finish(input: { runId: RunId; attempt: number }): Promise<boolean>;
  fail(input: { runId: RunId; attempt: number; error: string }): Promise<boolean>;
}
