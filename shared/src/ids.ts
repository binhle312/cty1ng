import { z } from "zod";

/**
 * TypeID prefixes, one per table (D36). A new table adds its prefix here in the PR that adds
 * the table, and docs/decisions/D36 is updated with it.
 */
export const ID_PREFIXES = [
  "bot",
  "skill",
  "skillv",
  "conv",
  "msg",
  "run",
  "step",
  "mreq",
  "handoff",
] as const;
export type IdPrefix = (typeof ID_PREFIXES)[number];

/** A TypeID with the given prefix, branded so one kind cannot be passed for another. */
export type IdOf<P extends IdPrefix> = string & z.$brand<`${P}Id`>;

// TypeID suffix: 26 characters of Crockford base32 in lowercase; the first is 0–7 so the
// 128 bits fit (https://github.com/jetify-com/typeid, spec v0.3).
const SUFFIX = "[0-7][0-9a-hjkmnp-tv-z]{25}";
const pattern = (prefix: IdPrefix): RegExp => new RegExp(`^${prefix}_${SUFFIX}$`);
const message = (prefix: IdPrefix): string => `expected a ${prefix}_… id`;

export const BotId = z.string().regex(pattern("bot"), message("bot")).brand<"botId">();
export const SkillId = z.string().regex(pattern("skill"), message("skill")).brand<"skillId">();
export const SkillVersionId = z
  .string()
  .regex(pattern("skillv"), message("skillv"))
  .brand<"skillvId">();
export const ConversationId = z.string().regex(pattern("conv"), message("conv")).brand<"convId">();
export const MessageId = z.string().regex(pattern("msg"), message("msg")).brand<"msgId">();
export const RunId = z.string().regex(pattern("run"), message("run")).brand<"runId">();
export const RunStepId = z.string().regex(pattern("step"), message("step")).brand<"stepId">();
export const ModelRequestId = z.string().regex(pattern("mreq"), message("mreq")).brand<"mreqId">();
export const HandoffId = z
  .string()
  .regex(pattern("handoff"), message("handoff"))
  .brand<"handoffId">();

export type BotId = z.infer<typeof BotId>;
export type SkillId = z.infer<typeof SkillId>;
export type SkillVersionId = z.infer<typeof SkillVersionId>;
export type ConversationId = z.infer<typeof ConversationId>;
export type MessageId = z.infer<typeof MessageId>;
export type RunId = z.infer<typeof RunId>;
export type RunStepId = z.infer<typeof RunStepId>;
export type ModelRequestId = z.infer<typeof ModelRequestId>;
export type HandoffId = z.infer<typeof HandoffId>;

const PATTERNS: { [P in IdPrefix]: RegExp } = {
  bot: pattern("bot"),
  skill: pattern("skill"),
  skillv: pattern("skillv"),
  conv: pattern("conv"),
  msg: pattern("msg"),
  run: pattern("run"),
  step: pattern("step"),
  mreq: pattern("mreq"),
  handoff: pattern("handoff"),
};

/** The same check as the schemas above, for code that is generic over the prefix. */
export function isId<P extends IdPrefix>(prefix: P, value: string): value is IdOf<P> {
  return PATTERNS[prefix].test(value);
}

/** Parses an id of the given prefix; throws on a malformed id or a wrong prefix. */
export function parseId<P extends IdPrefix>(prefix: P, value: string): IdOf<P> {
  if (!isId(prefix, value)) throw new Error(message(prefix));
  return value;
}

export function isIdPrefix(value: string): value is IdPrefix {
  return ID_PREFIXES.some((prefix) => prefix === value);
}
