import type {
  GetSettingsResponse,
  GetSkillResponse,
  ListBotsResponse,
  ListModelsResponse,
  ListSkillVersionsResponse,
  ListToolsResponse,
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

export type Model = ListModelsResponse[number];
export type Tool = ListToolsResponse[number];

// A catalog model. The two fake models of the app: one with efforts, one without.
export function makeModel(overrides: Partial<Model> = {}): Model {
  return {
    id: "fake:effort",
    label: "Fake with effort",
    provider: "fake",
    available: true,
    unavailable_reason: null,
    api_key_env: null,
    efforts: ["low", "medium", "high"],
    default_effort: "medium",
    multimodal: true,
    context_window: 1_000_000,
    provider_tools: [],
    ...overrides,
  };
}

export const FAKE_SCRIPTED = makeModel({
  id: "fake:scripted",
  label: "Fake scripted",
  efforts: [],
  default_effort: null,
});

// A catalog tool: an internal tool that is on by default.
export function makeTool(id: string, overrides: Partial<Tool> = {}): Tool {
  return {
    id,
    label: id,
    kind: "internal",
    provider: null,
    job: id,
    added: "2026-10-01",
    sends_data_out: false,
    web: false,
    line: `The ${id} tool.`,
    off_line: null,
    needs: [],
    switch: "open",
    ...overrides,
  };
}

// The settings the Create page reads, with their defaults (domain-model.md §10).
export const BOT_SETTINGS: GetSettingsResponse = {
  trash_days: 30,
  skill_name_max: 64,
  skill_body_max: 20_000,
  skill_body_warn_lines: 500,
  bot_name_max: 32,
  bot_description_max: 160,
  bot_persona_max: 8000,
  bot_history_min_pct: 10,
  bot_history_max_pct: 80,
  bot_default_history_pct: 40,
  bot_default_request_limit: 30,
  bot_default_max_reply_chars: 6000,
  health_recent_runs: 5,
  health_failed_runs: 2,
  health_limit_stops: 3,
  health_limit_window_days: 7,
  bot_order: "recent",
  bot_order_direction: "desc",
};
