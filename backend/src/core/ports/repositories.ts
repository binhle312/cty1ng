import type { ConversationId } from "@cty1ng/shared/ids";

// The persistence port (D35, architecture.md §2): repositories plus a unit of work, so a state
// change and the event that describes it commit together (AGENTS.md §5 rule 3).

export interface PersistedEvent {
  seq: number;
  type: string;
  conversationId: ConversationId | null;
  payload: unknown;
  createdAt: Date;
}

export interface NewEvent {
  type: string;
  conversationId: ConversationId | null;
  payload: unknown;
  createdAt: Date;
}

export interface EventsReader {
  // Events with seq greater than `seq`, oldest first, at most `limit`.
  after(seq: number, limit: number): Promise<PersistedEvent[]>;
  // The oldest and newest kept seq; both null when there is no event.
  bounds(): Promise<{ oldest: number | null; newest: number | null }>;
}

export interface EventsWriter extends EventsReader {
  // Inserts the event and returns its seq.
  append(event: NewEvent): Promise<number>;
}

export interface SettingsReader {
  // The stored value, or undefined when the key has no row.
  get(key: string): Promise<unknown>;
}

export interface SettingsWriter extends SettingsReader {
  set(key: string, value: unknown): Promise<void>;
  // Compare-and-set: writes `next` only when the stored value equals `expected`. Returns
  // whether it wrote (architecture.md §11: the loser changes 0 rows).
  setIf(key: string, expected: unknown, next: unknown): Promise<boolean>;
}

export interface Tx {
  readonly events: EventsWriter;
  readonly settings: SettingsWriter;
  // Runs once, after COMMIT succeeds; never after a rollback.
  afterCommit(callback: () => void): void;
}

export interface UnitOfWork {
  // One write transaction. A transaction does not begin until any running one has ended. If
  // `work` throws, everything rolls back and no afterCommit callback runs.
  run<T>(work: (tx: Tx) => Promise<T>): Promise<T>;
}

// Reads outside a transaction. They see only committed data.
export interface Readers {
  readonly events: EventsReader;
  readonly settings: SettingsReader;
  // Whether the database answers (GET /api/health).
  ping(): Promise<boolean>;
}
