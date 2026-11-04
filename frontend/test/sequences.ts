// Drivers for sequence tests of a pure state module (testing.md §3, "State table cells"): every
// order of a small set of steps, and random orders from a seed. A model holds a world (a model of
// the server and the module's state) and gives the steps that can run now. A failure prints the
// steps, and the random driver prints its seed, so a failing run can be run again.

// A world logs the labels of the steps that made it.
export interface Logged {
  log: string[];
}

export interface Step {
  label: string;
  run: () => void;
}

// mulberry32: a small seeded random number generator, so a failing run can be run again.
export function random(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Model<W> {
  start: () => W;
  copy: (world: W) => W;
  steps: (world: W) => Step[];
  // Throws when the page shows something it must not, after any step.
  check: (world: W) => void;
  // Ends every request and lands a last load; then the page must show the server's value.
  settle: (world: W) => void;
  checkSettled: (world: W) => void;
}

export function fail(
  { log, seed }: { log: readonly string[]; seed?: number },
  why: unknown,
): never {
  const head = seed === undefined ? "" : `seed ${String(seed)}: `;
  const message = why instanceof Error ? why.message : String(why);
  throw new Error(`${head}${message}\nsteps:\n  ${log.join("\n  ")}`);
}

interface Run<W> {
  model: Model<W>;
  seed?: number;
}

function checked<W extends Logged>({ model, seed }: Run<W>, world: W) {
  try {
    model.check(world);
  } catch (error) {
    fail({ log: world.log, ...(seed === undefined ? {} : { seed }) }, error);
  }
}

function settled<W extends Logged>({ model, seed }: Run<W>, world: W) {
  const end = model.copy(world);
  try {
    model.settle(end);
    model.checkSettled(end);
  } catch (error) {
    fail({ log: end.log, ...(seed === undefined ? {} : { seed }) }, error);
  }
}

// Every order: each path through the steps, up to `depth` steps.
export function everyOrder<W extends Logged>(model: Model<W>, depth: number): number {
  let paths = 0;
  const walk = (world: W, left: number) => {
    checked({ model }, world);
    const steps = model.steps(world);
    if (left === 0 || steps.length === 0) {
      settled({ model }, world);
      paths += 1;
      return;
    }
    for (let i = 0; i < steps.length; i += 1) {
      const next = model.copy(world);
      const step = model.steps(next)[i];
      if (step === undefined) continue;
      next.log.push(step.label);
      step.run();
      walk(next, left - 1);
    }
  };
  walk(model.start(), depth);
  return paths;
}

export function randomOrders<W extends Logged>(
  model: Model<W>,
  { runs, length, firstSeed }: { runs: number; length: number; firstSeed: number },
) {
  for (let seed = firstSeed; seed < firstSeed + runs; seed += 1) {
    const next = random(seed);
    const world = model.start();
    for (let n = 0; n < length; n += 1) {
      const steps = model.steps(world);
      const step = steps[Math.floor(next() * steps.length)];
      if (step === undefined) break;
      world.log.push(step.label);
      step.run();
      checked({ model, seed }, world);
    }
    settled({ model, seed }, world);
  }
}
