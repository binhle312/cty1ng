import type {
  GetSkillResponse,
  ListBotsResponse,
  ListSkillVersionsResponse,
} from "../src/lib/api/generated/types.gen.ts";

// Data for component tests. The ids have the TypeID shape that the generated schemas check
// (`<prefix>_<26 characters>`).
export const typeId = (prefix: string, n: number) => `${prefix}_0${String(n).padStart(25, "0")}`;

export type Bot = ListBotsResponse[number];
export type Pin = Bot["pins"][number];
export type Skill = GetSkillResponse;
export type SkillVersion = ListSkillVersionsResponse[number];

export const SKILL_ID = typeId("skill", 1);

// A skill with `latest` versions, from v1 to v{latest}; version ids are `skillv_…{version}`.
export const versionId = (version: number) => typeId("skillv", version);

export function makeVersions(latest: number): SkillVersion[] {
  return Array.from({ length: latest }, (_, index) => latest - index).map((version) => ({
    id: versionId(version),
    version,
    description: "Use this skill when the owner asks for user stories.",
    changelog: version === 1 ? null : `Change ${String(version)}`,
    created_by: typeId("user", 1),
    created_at: "2026-10-20T10:00:00.000Z",
    bots_using: 0,
  }));
}

export function makeSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: SKILL_ID,
    slug: "write-user-stories",
    name: "Write user stories",
    author_id: typeId("user", 1),
    is_author: true,
    row_version: 1,
    latest_version: {
      version: 3,
      description: "Use this skill when the owner asks for user stories.",
      changelog: null,
      created_at: "2026-10-20T10:00:00.000Z",
    },
    bots_using: 0,
    bots_outdated: 0,
    deprecated: false,
    deprecated_at: null,
    updated_at: "2026-10-20T10:00:00.000Z",
    cloned_from: null,
    body_md: "## Steps\n1. Read the brief.",
    ...overrides,
  };
}

export function makePin(overrides: Partial<Pin> = {}): Pin {
  return {
    skill_id: SKILL_ID,
    skill_slug: "write-user-stories",
    skill_name: "Write user stories",
    description: "Use this skill when the owner asks for user stories.",
    skill_version_id: versionId(3),
    version: 3,
    latest_version: 3,
    always_load: false,
    deprecated: false,
    ...overrides,
  };
}

export function makeBot(
  n: number,
  name: string,
  pins: Pin[] = [],
  overrides: Partial<Bot> = {},
): Bot {
  return {
    id: typeId("bot", n),
    slug: name.toLowerCase(),
    name,
    row_version: 1,
    description: `${name} does its job.`,
    persona_md: "You are a bot.",
    avatar_style: "flat",
    avatar_colour: "#336699",
    avatar_id: null,
    avatar_url: null,
    model_id: "fake:scripted",
    model_label: "Fake scripted",
    effort: null,
    request_limit: 10,
    max_reply_chars: 8000,
    history_share_pct: 50,
    tool_settings: {},
    cloned_from_bot_id: null,
    available: true,
    unavailable_reason: null,
    pins,
    pinned_position: null,
    last_activity_at: null,
    counts: { skills: pins.length, skill_updates: 0, projects: 0, conversations: 0 },
    status: { state: "idle" },
    health: null,
    created_at: "2026-10-20T10:00:00.000Z",
    updated_at: "2026-10-20T10:00:00.000Z",
    ...overrides,
  };
}
