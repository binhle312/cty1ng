// Set changes for React state, which must never change in place: each returns a new set.

// `item` taken out when the set has it, else put in: a check box that flips.
export function toggled<T>(set: ReadonlySet<T>, item: T): Set<T> {
  const next = new Set(set);
  if (next.has(item)) next.delete(item);
  else next.add(item);
  return next;
}

// `item` in the set when `on`, else out of it: a check box that says its new value.
export function withItem<T>({
  set,
  item,
  on,
}: {
  set: ReadonlySet<T>;
  item: T;
  on: boolean;
}): Set<T> {
  const next = new Set(set);
  if (on) next.add(item);
  else next.delete(item);
  return next;
}
