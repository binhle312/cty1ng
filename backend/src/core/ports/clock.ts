/** Now, as a port so tests can fix time (D35). */
export interface Clock {
  now(): Date;
}
