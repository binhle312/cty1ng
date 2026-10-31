import type { Logger } from "../adapters/log/pino-logger.ts";
import { OWNER_ID } from "../core/owner.ts";
import type { EventPruning } from "../core/events/event-pruning.service.ts";
import type { SkillsService } from "../core/skills/skills.service.ts";

// The timed jobs (architecture.md §6.1): the Trash purge, at start and then every
// PURGE_INTERVAL_HOURS, and the event pruning, at start and then every
// EVENT_PRUNE_INTERVAL_HOURS. Each job has its own timer; a failed run is logged and the next
// run tries again, and it never stops the other job. Returns a stop function.
export function startTimedJobs(deps: {
  skills: Pick<SkillsService, "purgeDue">;
  eventPruning: Pick<EventPruning, "pruneDue">;
  log: Logger;
  purgeIntervalHours: number;
  eventPruneIntervalHours: number;
}): () => void {
  const stops = [
    every(deps.purgeIntervalHours, async () => {
      try {
        const purged = await deps.skills.purgeDue(OWNER_ID);
        if (purged > 0) deps.log.info({ purged }, "trash purge");
      } catch (error) {
        deps.log.error({ err: error }, "trash purge failed");
      }
    }),
    every(deps.eventPruneIntervalHours, async () => {
      try {
        const pruned = await deps.eventPruning.pruneDue();
        if (pruned > 0) deps.log.info({ pruned }, "event prune");
      } catch (error) {
        deps.log.error({ err: error }, "event prune failed");
      }
    }),
  ];
  return () => {
    for (const stop of stops) stop();
  };
}

// Node runs a timer longer than this (about 24.8 days) after 1 ms instead, so a longer
// interval waits in steps.
const MAX_TIMER_MS = 2 ** 31 - 1;

// Runs `job` now and then every `hours`. `job` catches its own errors.
function every(hours: number, job: () => Promise<void>): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const wait = (ms: number): void => {
    timer = setTimeout(
      () => {
        if (ms > MAX_TIMER_MS) {
          wait(ms - MAX_TIMER_MS);
          return;
        }
        void job();
        wait(hours * 3_600_000);
      },
      Math.min(ms, MAX_TIMER_MS),
    );
    timer.unref();
  };
  void job();
  wait(hours * 3_600_000);
  return () => {
    clearTimeout(timer);
  };
}
