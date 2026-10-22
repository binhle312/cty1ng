import type { ConversationId, PersistedEventType } from "@cty1ng/shared";

/** A row of the `events` table as the core sees it (domain-model.md §8). */
export interface StoredEvent {
  seq: number;
  type: PersistedEventType;
  conversationId: ConversationId | null;
  /** Unparsed JSON value; parse it with the event type's schema before use. */
  payload: unknown;
  createdAt: Date;
}

export interface NewEvent {
  type: PersistedEventType;
  conversationId: ConversationId | null;
  payload: unknown;
  createdAt: Date;
}

/** Lowest and highest `seq` still in the table; both null when it is empty. */
export interface SeqBounds {
  minSeq: number | null;
  maxSeq: number | null;
}

/** Reads of the event log. Outside a unit of work these see committed rows only. */
export interface EventLogReader {
  listAfter(input: { afterSeq: number; limit: number }): Promise<StoredEvent[]>;
  bounds(): Promise<SeqBounds>;
}

export interface EventsRepository extends EventLogReader {
  /** Inserts one event and returns its `seq`. Only inside a unit of work. */
  append(event: NewEvent): Promise<number>;
}

export interface SettingsRepository {
  /** The stored JSON value, unparsed, or undefined when the key has no row. */
  get(key: string): Promise<unknown>;
  put(key: string, value: unknown): Promise<void>;
  /**
   * Compare-and-set (architecture.md §11): writes `next` only if the stored value still equals
   * `expected`. Returns false when another writer changed it first.
   */
  compareAndSet(input: { key: string; expected: unknown; next: unknown }): Promise<boolean>;
}

/** The repositories a unit of work hands to a service; all share its transaction. */
export interface Repositories {
  events: EventsRepository;
  settings: SettingsRepository;
}

/**
 * A state change and the event that describes it commit together (AGENTS.md §5 rule 3,
 * architecture.md §2). `run` commits when `work` resolves and rolls back when it throws.
 * Units of work do not nest.
 */
export interface UnitOfWork {
  run<T>(work: (tx: Repositories) => Promise<T>): Promise<T>;
}

/** Health check of the database (`GET /api/health`). Throws when it is not reachable. */
export interface DatabaseProbe {
  ping(): Promise<void>;
}
