import type { Clock } from "../../core/ports/clock";

export const systemClock: Clock = {
  now: () => new Date(),
};
