import { createRoute, z } from "@hono/zod-openapi";
import { bodyLimit } from "hono/body-limit";
import { SkillId, SkillVersionId } from "@cty1ng/shared/ids";
import {
  DiffLine,
  Skill,
  SkillDetail,
  SkillImportPreview,
  SkillImportResult,
  SkillVersion,
} from "@cty1ng/shared/skills";
import { OWNER_ID } from "../../../core/owner.ts";
import type { SkillImportService } from "../../../core/skills/skill-import.service.ts";
import type { SkillsService } from "../../../core/skills/skills.service.ts";
import { ApiFailure } from "../errors.ts";
import { createRouter } from "../router.ts";
import { readSkillZip, SKILL_ZIP, writeSkillZip } from "../uploads/skill-zip.ts";

// Skills (api.md §2). Every operation id has "Skill" in it: the frontend's event reducer finds
// the cached skill queries by it. Phase 1 has one owner, so the actor is always OWNER_ID.

export const SKILL_UPLOAD_PATHS = ["/api/skills/import/preview"];

const json = <T extends z.ZodType>(schema: T, description: string) => ({
  description,
  content: { "application/json": { schema } },
});
const IdParam = z.object({ id: SkillId });
const VersionParam = z.object({ id: SkillId, version: z.coerce.number().int().positive() });
const RowVersion = z.number().int().positive();
const Changelog = z.string().optional();
const ImportFile = z.instanceof(File).openapi({ type: "string", format: "binary" });

const routes = {
  // Registered before `/skills/{id}`, so "export" is never read as an id.
  exportSkills: createRoute({
    method: "get",
    path: "/skills/export",
    operationId: "exportSkills",
    request: {
      query: z.object({
        // Comma-separated skill ids; none means every active skill.
        ids: z.string().optional(),
      }),
    },
    responses: {
      200: {
        description: "A zip of `<slug>/SKILL.md` folders",
        content: { "application/zip": { schema: z.string().openapi({ format: "binary" }) } },
      },
    },
  }),
  previewSkillImport: createRoute({
    method: "post",
    path: "/skills/import/preview",
    operationId: "previewSkillImport",
    middleware: [
      bodyLimit({
        maxSize: SKILL_ZIP.maxZipBytes + SKILL_ZIP.multipartOverheadBytes,
        onError: () => {
          throw new ApiFailure("too_large", "The zip is larger than 5 MB.");
        },
      }),
    ] as const,
    request: {
      body: {
        required: true,
        content: { "multipart/form-data": { schema: z.object({ file: ImportFile }) } },
      },
    },
    responses: { 200: json(SkillImportPreview, "What Apply would change; nothing is written") },
  }),
  applySkillImport: createRoute({
    method: "post",
    path: "/skills/import/apply",
    operationId: "applySkillImport",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({ preview_id: z.string(), slugs: z.array(z.string()) }).strict(),
          },
        },
      },
    },
    responses: { 200: json(SkillImportResult, "The ticked rows were applied") },
  }),
  listSkills: createRoute({
    method: "get",
    path: "/skills",
    operationId: "listSkills",
    request: {
      query: z.object({ include_deprecated: z.enum(["true", "false"]).optional() }),
    },
    responses: { 200: json(z.array(Skill), "Skills not in Trash, newest change first") },
  }),
  createSkill: createRoute({
    method: "post",
    path: "/skills",
    operationId: "createSkill",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z
              .object({
                slug: z.string(),
                name: z.string(),
                description: z.string(),
                body_md: z.string(),
                cloned_from_skill_version_id: SkillVersionId.optional(),
              })
              .strict(),
          },
        },
      },
    },
    responses: { 201: json(Skill, "The skill and its v1") },
  }),
  getSkill: createRoute({
    method: "get",
    path: "/skills/{id}",
    operationId: "getSkill",
    request: { params: IdParam },
    responses: { 200: json(SkillDetail, "The skill with its latest body") },
  }),
  renameSkill: createRoute({
    method: "patch",
    path: "/skills/{id}",
    operationId: "renameSkill",
    request: {
      params: IdParam,
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({ name: z.string(), row_version: RowVersion }).strict(),
          },
        },
      },
    },
    responses: { 200: json(Skill, "Renamed; no new version") },
  }),
  createSkillVersion: createRoute({
    method: "post",
    path: "/skills/{id}/versions",
    operationId: "createSkillVersion",
    request: {
      params: IdParam,
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z
              .object({
                base_version: z.number().int().positive(),
                description: z.string(),
                body_md: z.string(),
                changelog: Changelog,
                upgrade_bot_ids: z.array(z.string()),
                name: z.string().optional(),
                row_version: RowVersion.optional(),
              })
              .strict()
              .refine((body) => (body.name === undefined) === (body.row_version === undefined), {
                message: "Send name and row_version together.",
                path: ["row_version"],
              }),
          },
        },
      },
    },
    responses: { 201: json(Skill, "Version N+1 is saved") },
  }),
  listSkillVersions: createRoute({
    method: "get",
    path: "/skills/{id}/versions",
    operationId: "listSkillVersions",
    request: { params: IdParam },
    responses: { 200: json(z.array(SkillVersion), "Versions, newest first") },
  }),
  getSkillVersion: createRoute({
    method: "get",
    path: "/skills/{id}/versions/{version}",
    operationId: "getSkillVersion",
    request: { params: VersionParam },
    responses: { 200: json(SkillVersion, "One version") },
  }),
  getSkillDiff: createRoute({
    method: "get",
    path: "/skills/{id}/diff",
    operationId: "getSkillDiff",
    request: {
      params: IdParam,
      query: z.object({
        from: z.coerce.number().int().positive(),
        to: z.coerce.number().int().positive(),
      }),
    },
    responses: {
      200: json(
        z.object({ description: z.array(DiffLine).nullable(), body: z.array(DiffLine) }),
        "A line diff of the descriptions and the bodies",
      ),
    },
  }),
  restoreSkillVersion: createRoute({
    method: "post",
    path: "/skills/{id}/versions/{version}/restore",
    operationId: "restoreSkillVersion",
    request: {
      params: VersionParam,
      body: {
        required: true,
        content: { "application/json": { schema: z.object({ changelog: Changelog }).strict() } },
      },
    },
    responses: { 201: json(Skill, "A new version with that version's text") },
  }),
  listSkillUpgradeCandidates: createRoute({
    method: "get",
    path: "/skills/{id}/upgrade-candidates",
    operationId: "listSkillUpgradeCandidates",
    request: { params: IdParam },
    responses: {
      200: json(z.array(z.object({ bot_id: z.string() })), "Bots on older versions (M2)"),
    },
  }),
  deprecateSkill: createRoute({
    method: "post",
    path: "/skills/{id}/deprecate",
    operationId: "deprecateSkill",
    request: {
      params: IdParam,
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z
              .object({ remove_bot_ids: z.array(z.string()), row_version: RowVersion })
              .strict(),
          },
        },
      },
    },
    responses: { 200: json(Skill, "Deprecated") },
  }),
  undeprecateSkill: createRoute({
    method: "post",
    path: "/skills/{id}/undeprecate",
    operationId: "undeprecateSkill",
    request: {
      params: IdParam,
      body: {
        required: true,
        content: {
          "application/json": { schema: z.object({ row_version: RowVersion }).strict() },
        },
      },
    },
    responses: { 200: json(Skill, "Active again") },
  }),
  trashSkill: createRoute({
    method: "post",
    path: "/skills/{id}/trash",
    operationId: "trashSkill",
    request: {
      params: IdParam,
      body: {
        required: true,
        content: {
          "application/json": { schema: z.object({ row_version: RowVersion }).strict() },
        },
      },
    },
    responses: {
      200: json(
        z.object({ skill_id: SkillId, removed_bot_ids: z.array(z.string()) }),
        "In Trash; the bots it was removed from",
      ),
    },
  }),
  restoreSkill: createRoute({
    method: "post",
    path: "/skills/{id}/restore",
    operationId: "restoreSkill",
    request: { params: IdParam },
    responses: {
      200: json(
        z.object({ skill: Skill, suggested_bot_ids: z.array(z.string()) }),
        "Out of Trash, still deprecated",
      ),
    },
  }),
  deleteSkill: createRoute({
    method: "delete",
    path: "/skills/{id}",
    operationId: "deleteSkill",
    request: { params: IdParam },
    responses: { 204: { description: "Purged from Trash" } },
  }),
};

export function skillRoutes(deps: { skills: SkillsService; skillImport: SkillImportService }) {
  const { skills, skillImport } = deps;
  return createRouter()
    .openapi(routes.exportSkills, async (c) => {
      const raw = c.req.valid("query").ids;
      const ids =
        raw === undefined
          ? null
          : raw
              .split(",")
              .filter((id) => id !== "")
              .map((id) => {
                const parsed = SkillId.safeParse(id);
                if (!parsed.success) throw new ApiFailure("invalid_id", "Not a skill id.", "ids");
                return parsed.data;
              });
      const { fileName, files } = await skills.exportFiles(ids);
      const zip = await writeSkillZip(files);
      return c.body(zip, 200, {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="${fileName}"`,
      });
    })
    .openapi(routes.previewSkillImport, async (c) => {
      const { file } = c.req.valid("form");
      if (file.size > SKILL_ZIP.maxZipBytes) {
        throw new ApiFailure("too_large", "The zip is larger than 5 MB.");
      }
      const folders = await readSkillZip(new Uint8Array(await file.arrayBuffer()));
      return c.json(await skillImport.preview(file.name, folders, OWNER_ID), 200);
    })
    .openapi(routes.applySkillImport, async (c) => {
      const body = c.req.valid("json");
      return c.json(await skillImport.apply(body.preview_id, body.slugs, OWNER_ID), 200);
    })
    .openapi(routes.listSkills, async (c) => {
      const includeDeprecated = c.req.valid("query").include_deprecated === "true";
      return c.json(await skills.list({ includeDeprecated }, OWNER_ID), 200);
    })
    .openapi(routes.createSkill, async (c) => {
      const body = c.req.valid("json");
      const skill = await skills.create(
        {
          slug: body.slug,
          name: body.name,
          description: body.description,
          bodyMd: body.body_md,
          clonedFromSkillVersionId: body.cloned_from_skill_version_id,
        },
        OWNER_ID,
      );
      return c.json(skill, 201);
    })
    .openapi(routes.getSkill, async (c) =>
      c.json(await skills.get(c.req.valid("param").id, OWNER_ID), 200),
    )
    .openapi(routes.renameSkill, async (c) => {
      const body = c.req.valid("json");
      const skill = await skills.rename(
        c.req.valid("param").id,
        { name: body.name, rowVersion: body.row_version },
        OWNER_ID,
      );
      return c.json(skill, 200);
    })
    .openapi(routes.createSkillVersion, async (c) => {
      const body = c.req.valid("json");
      const skill = await skills.addVersion(
        c.req.valid("param").id,
        {
          baseVersion: body.base_version,
          description: body.description,
          bodyMd: body.body_md,
          changelog: body.changelog,
          upgradeBotIds: body.upgrade_bot_ids,
          rename:
            body.name === undefined || body.row_version === undefined
              ? undefined
              : { name: body.name, rowVersion: body.row_version },
        },
        OWNER_ID,
      );
      return c.json(skill, 201);
    })
    .openapi(routes.listSkillVersions, async (c) =>
      c.json(await skills.versions(c.req.valid("param").id), 200),
    )
    .openapi(routes.getSkillVersion, async (c) => {
      const { id, version } = c.req.valid("param");
      return c.json(await skills.version(id, version), 200);
    })
    .openapi(routes.getSkillDiff, async (c) => {
      const { from, to } = c.req.valid("query");
      return c.json(await skills.diff(c.req.valid("param").id, from, to), 200);
    })
    .openapi(routes.restoreSkillVersion, async (c) => {
      const { id, version } = c.req.valid("param");
      const skill = await skills.restoreVersion(
        id,
        version,
        c.req.valid("json").changelog,
        OWNER_ID,
      );
      return c.json(skill, 201);
    })
    .openapi(routes.listSkillUpgradeCandidates, async (c) =>
      c.json(await skills.upgradeCandidates(c.req.valid("param").id), 200),
    )
    .openapi(routes.deprecateSkill, async (c) => {
      const body = c.req.valid("json");
      const skill = await skills.deprecate(
        c.req.valid("param").id,
        { removeBotIds: body.remove_bot_ids, rowVersion: body.row_version },
        OWNER_ID,
      );
      return c.json(skill, 200);
    })
    .openapi(routes.undeprecateSkill, async (c) => {
      const skill = await skills.undeprecate(
        c.req.valid("param").id,
        { rowVersion: c.req.valid("json").row_version },
        OWNER_ID,
      );
      return c.json(skill, 200);
    })
    .openapi(routes.trashSkill, async (c) => {
      const result = await skills.trash(
        c.req.valid("param").id,
        { rowVersion: c.req.valid("json").row_version },
        OWNER_ID,
      );
      return c.json(result, 200);
    })
    .openapi(routes.restoreSkill, async (c) =>
      c.json(await skills.restore(c.req.valid("param").id, OWNER_ID), 200),
    )
    .openapi(routes.deleteSkill, async (c) => {
      await skills.purge(c.req.valid("param").id, OWNER_ID);
      return c.body(null, 204);
    });
}
