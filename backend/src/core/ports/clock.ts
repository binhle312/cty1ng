// Time comes in through this port, so tests can fix it (architecture.md §2).
export interface Clock {
  now(): Date;
}
