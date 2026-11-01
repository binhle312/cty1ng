import type { AvatarStyle } from "@cty1ng/shared/bots";
import type { Effort } from "@cty1ng/shared/catalog";
import type { BotId, ConversationId, SkillId, SkillVersionId } from "@cty1ng/shared/ids";

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
  // The highest seq ever given, kept or pruned; null before the first event.
  lastSeq(): Promise<number | null>;
}

export interface EventsWriter extends EventsReader {
  // Inserts the event and returns its seq.
  append(event: NewEvent): Promise<number>;
  // Deletes the events created before `cutoff` (domain-model.md §8); returns how many.
  deleteBefore(cutoff: Date): Promise<number>;
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

// A `skills` row (domain-model.md §3.1).
export interface SkillRecord {
  id: SkillId;
  slug: string;
  name: string;
  authorId: string;
  clonedFromSkillVersionId: SkillVersionId | null;
  rowVersion: number;
  createdAt: Date;
  updatedAt: Date;
  deprecatedAt: Date | null;
  trashedAt: Date | null;
  trashedBotIds: string[] | null;
}

// A `skill_versions` row. Never updated (invariant 2).
export interface SkillVersionRecord {
  id: SkillVersionId;
  skillId: SkillId;
  version: number;
  description: string;
  bodyMd: string;
  changelog: string | null;
  createdBy: string;
  createdAt: Date;
}

export interface SkillWithLatest {
  skill: SkillRecord;
  latest: SkillVersionRecord;
}

export interface SkillsReader {
  // Skills not in Trash, newest `updated_at` first, each with its latest version.
  list(options: { includeDeprecated: boolean }): Promise<SkillWithLatest[]>;
  // Any skill, Trash included; the services decide what a trashed skill may do.
  byId(id: SkillId): Promise<SkillRecord | null>;
  bySlug(slug: string): Promise<SkillRecord | null>;
  // Skills in Trash, newest delete first.
  trashed(): Promise<SkillRecord[]>;
  // Skills whose `trashed_at` is at or before `cutoff` (the purge job).
  trashedUntil(cutoff: Date): Promise<SkillId[]>;
  latestVersion(skillId: SkillId): Promise<SkillVersionRecord | null>;
  version(skillId: SkillId, version: number): Promise<SkillVersionRecord | null>;
  versionById(id: SkillVersionId): Promise<SkillVersionRecord | null>;
  // Newest first.
  versions(skillId: SkillId): Promise<SkillVersionRecord[]>;
}

export interface SkillsWriter extends SkillsReader {
  // Returns false, and writes nothing, when the slug is taken (Trash included).
  insertSkill(skill: SkillRecord): Promise<boolean>;
  // Inserts version N. Returns false, and writes nothing, when the skill already has version N
  // (two saves of the same base version: the loser gets `stale_write`, architecture.md §11).
  insertVersion(version: SkillVersionRecord): Promise<boolean>;
  // Updates the row and raises `row_version` by one. With `expectedRowVersion`, writes only when
  // the stored value equals it; returns whether it wrote.
  updateSkill(
    id: SkillId,
    change: Partial<
      Pick<SkillRecord, "name" | "updatedAt" | "deprecatedAt" | "trashedAt" | "trashedBotIds">
    >,
    expectedRowVersion?: number,
  ): Promise<boolean>;
  // The Trash purge (domain-model.md §3.4): clears every link to the skill's versions, then
  // deletes the versions and the skill. Returns the ids of the skills whose clone link it cleared.
  purge(id: SkillId): Promise<SkillId[]>;
}

// A `bots` row (domain-model.md §2). A purged bot keeps its row as a tombstone (D50).
export interface BotRecord {
  id: BotId;
  slug: string;
  name: string;
  nameKey: string;
  rowVersion: number;
  description: string;
  personaMd: string;
  avatarStyle: AvatarStyle;
  avatarColour: string;
  // `avatars/<sha256>.webp` when the style is upload, else null.
  avatarPath: string | null;
  modelId: string;
  effort: Effort | null;
  requestLimit: number;
  maxReplyChars: number;
  historySharePct: number;
  // As last saved; read through `effectiveToolSettings`.
  toolSettings: Record<string, boolean>;
  clonedFromBotId: BotId | null;
  createKey: string | null;
  createRequestHash: string | null;
  pinnedPosition: number | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  purgedAt: Date | null;
}

// A `bot_skills` row (domain-model.md §3.1).
export interface BotPinRecord {
  botId: BotId;
  skillId: SkillId;
  skillVersionId: SkillVersionId;
  alwaysLoad: boolean;
  addedAt: Date;
  updatedAt: Date;
}

// A pin with what the pages show about its skill.
export interface BotPinView extends BotPinRecord {
  skillSlug: string;
  skillName: string;
  description: string;
  version: number;
  latestVersion: number;
  deprecated: boolean;
}

// A pin seen from its skill: which bot, at which version.
export interface SkillPinRecord {
  botId: BotId;
  skillVersionId: SkillVersionId;
  version: number;
  alwaysLoad: boolean;
  botDeleted: boolean;
}

export interface BotsReader {
  // Bots not in Trash, in no order (the service orders them).
  list(): Promise<BotRecord[]>;
  // Any bot: live, in Trash or a tombstone; the services decide what each may do.
  byId(id: BotId): Promise<BotRecord | null>;
  bySlug(slug: string): Promise<BotRecord | null>;
  byCreateKey(key: string): Promise<BotRecord | null>;
  // Any row holds its slug forever (D19).
  slugTaken(slug: string): Promise<boolean>;
  // The bot not purged whose name key this is, Trash included (invariant 12).
  nameKeyHolder(nameKey: string): Promise<BotRecord | null>;
  // A bot's pins, by skill name.
  pins(botId: BotId): Promise<BotPinView[]>;
  // The pins of a skill, on bots not purged (purged bots have none).
  pinsOfSkill(skillId: SkillId): Promise<SkillPinRecord[]>;
  // The pinned bots, by position.
  pinnedIds(): Promise<BotId[]>;
  trashedCount(): Promise<number>;
  // Bots in Trash, not purged, newest delete first.
  trashed(): Promise<BotRecord[]>;
  // Bots in Trash, not purged, whose `deleted_at` is at or before `cutoff` (the purge job).
  trashedUntil(cutoff: Date): Promise<BotId[]>;
  // The `avatar_path` values that any row names: live, in Trash or a tombstone.
  avatarPaths(): Promise<Set<string>>;
}

export interface BotsWriter extends BotsReader {
  // Returns false, and writes nothing, when the slug, the name key or the create key is taken.
  insertBot(bot: BotRecord): Promise<boolean>;
  // Updates the row and raises `row_version` by one. With `expectedRowVersion`, writes only when
  // the stored value equals it; returns whether it wrote.
  updateBot(
    id: BotId,
    change: Partial<
      Omit<
        BotRecord,
        "id" | "slug" | "rowVersion" | "modelId" | "effort" | "createdBy" | "createdAt"
      >
    >,
    expectedRowVersion?: number,
  ): Promise<boolean>;
  // Every bot gets NULL first, then the listed bots get 1…n, so the unique index never sees a
  // duplicate (domain-model.md §2 Order). Raises no `row_version`.
  setPinnedOrder(ids: readonly BotId[]): Promise<void>;
  // Inserts the pin, or changes its version and Always load. Raises no `row_version`.
  upsertPin(pin: BotPinRecord): Promise<void>;
  // Returns whether a row was removed.
  deletePin(botId: BotId, skillId: SkillId): Promise<boolean>;
  // Removes every pin of the skill; returns the bots that had one.
  deletePinsOfSkill(skillId: SkillId): Promise<BotId[]>;
  // The purge (D50): the closed list of cleared columns, and the bot's pins deleted.
  tombstone(id: BotId, now: Date): Promise<void>;
}

export interface Tx {
  readonly events: EventsWriter;
  readonly settings: SettingsWriter;
  readonly skills: SkillsWriter;
  readonly bots: BotsWriter;
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
  readonly skills: SkillsReader;
  readonly bots: BotsReader;
  // Whether the database answers (GET /api/health).
  ping(): Promise<boolean>;
}
