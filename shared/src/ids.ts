import { z } from "zod";

// TypeIDs (D36): `<prefix>_<26 base32 chars>`. The suffix is the UUIDv7 (D22) in Crockford
// base32, lowercase, without i, l, o and u. 128 bits in 26 characters leaves 2 spare bits, so
// the first character is 0–7. Conversion to and from the UUID lives in the backend ids adapter;
// this file only checks the shape and the prefix.
const SUFFIX = "[0-7][0-9a-hjkmnp-tv-z]{25}";

function typeId<const Brand extends string>(prefix: string, brand: Brand) {
  return z
    .string()
    .regex(new RegExp(`^${prefix}_${SUFFIX}$`), { message: `Expected a ${brand} (${prefix}_…)` })
    .brand<Brand>();
}

// One schema per table prefix: D36 and domain-model.md.
export const BotId = typeId("bot", "BotId");
export const SkillId = typeId("skill", "SkillId");
export const SkillVersionId = typeId("skillv", "SkillVersionId");
export const SkillDraftId = typeId("skilld", "SkillDraftId");
export const SkillTestCaseId = typeId("stest", "SkillTestCaseId");
export const ConversationId = typeId("conv", "ConversationId");
export const MessageId = typeId("msg", "MessageId");
export const RunId = typeId("run", "RunId");
export const RunStepId = typeId("step", "RunStepId");
export const RunSlotId = typeId("rslot", "RunSlotId");
export const ModelRequestId = typeId("mreq", "ModelRequestId");
export const HandoffId = typeId("handoff", "HandoffId");
export const ProjectId = typeId("proj", "ProjectId");
export const MemoryItemId = typeId("mem", "MemoryItemId");
export const MemoryProposalId = typeId("mprop", "MemoryProposalId");
export const FeedbackId = typeId("fb", "FeedbackId");

export type BotId = z.infer<typeof BotId>;
export type SkillId = z.infer<typeof SkillId>;
export type SkillVersionId = z.infer<typeof SkillVersionId>;
export type SkillDraftId = z.infer<typeof SkillDraftId>;
export type SkillTestCaseId = z.infer<typeof SkillTestCaseId>;
export type ConversationId = z.infer<typeof ConversationId>;
export type MessageId = z.infer<typeof MessageId>;
export type RunId = z.infer<typeof RunId>;
export type RunStepId = z.infer<typeof RunStepId>;
export type RunSlotId = z.infer<typeof RunSlotId>;
export type ModelRequestId = z.infer<typeof ModelRequestId>;
export type HandoffId = z.infer<typeof HandoffId>;
export type ProjectId = z.infer<typeof ProjectId>;
export type MemoryItemId = z.infer<typeof MemoryItemId>;
export type MemoryProposalId = z.infer<typeof MemoryProposalId>;
export type FeedbackId = z.infer<typeof FeedbackId>;
