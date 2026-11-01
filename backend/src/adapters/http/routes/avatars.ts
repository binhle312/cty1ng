import { createRoute, z } from "@hono/zod-openapi";
import { bodyLimit } from "hono/body-limit";
import { AVATAR_ACCEPTED_TYPES, AvatarLimits, AvatarUpload } from "@cty1ng/shared/bots";
import type { AvatarsService } from "../../../core/bots/avatars.service.ts";
import { ApiFailure } from "../errors.ts";
import { createRouter } from "../router.ts";
import { AVATAR_IMAGE, encodeAvatar } from "../uploads/avatar-image.ts";

// Avatar images (api.md §4, security.md §2.4). The upload is decoded and re-encoded here; the
// service hashes, stores and serves the result.

export const AVATAR_UPLOAD_PATHS = ["/api/avatars"];

const json = <T extends z.ZodType>(schema: T, description: string) => ({
  description,
  content: { "application/json": { schema } },
});
const NoQuery = z.object({}).strict();
const UploadFile = z.instanceof(File).openapi({ type: "string", format: "binary" });
const FileParam = z.object({ file: z.string().regex(/^[0-9a-f]{64}\.webp$/) });

function tooLarge(maxBytes: number): ApiFailure {
  const mb = Math.round((maxBytes / 1_048_576) * 10) / 10;
  return new ApiFailure("too_large", `The image is larger than ${String(mb)} MB.`);
}

export function avatarRoutes(deps: { avatars: AvatarsService; maxBytes: number }) {
  const routes = {
    getAvatarLimits: createRoute({
      method: "get",
      path: "/avatars/limits",
      operationId: "getAvatarLimits",
      request: { query: NoQuery },
      responses: { 200: json(AvatarLimits, "The size limit and the accepted types") },
    }),
    uploadAvatar: createRoute({
      method: "post",
      path: "/avatars",
      operationId: "uploadAvatar",
      middleware: [
        bodyLimit({
          maxSize: deps.maxBytes + AVATAR_IMAGE.multipartOverheadBytes,
          onError: () => {
            throw tooLarge(deps.maxBytes);
          },
        }),
      ] as const,
      request: {
        query: NoQuery,
        body: {
          required: true,
          content: { "multipart/form-data": { schema: z.object({ file: UploadFile }) } },
        },
      },
      responses: { 200: json(AvatarUpload, "The stored image: its id and URL") },
    }),
    getAvatar: createRoute({
      method: "get",
      path: "/avatars/{file}",
      operationId: "getAvatar",
      request: { params: FileParam, query: NoQuery },
      responses: {
        200: {
          description: "The image",
          content: { "image/webp": { schema: z.string().openapi({ format: "binary" }) } },
        },
      },
    }),
  };

  return createRouter()
    .openapi(routes.getAvatarLimits, (c) =>
      c.json({ max_bytes: deps.maxBytes, accepted_types: [...AVATAR_ACCEPTED_TYPES] }, 200),
    )
    .openapi(routes.uploadAvatar, async (c) => {
      const { file } = c.req.valid("form");
      if (file.size > deps.maxBytes) throw tooLarge(deps.maxBytes);
      const webp = await encodeAvatar(new Uint8Array(await file.arrayBuffer()));
      return c.json(await deps.avatars.upload(webp), 200);
    })
    .openapi(routes.getAvatar, async (c) => {
      const avatarId = c.req.valid("param").file.replace(/\.webp$/, "");
      const bytes = await deps.avatars.read(avatarId);
      if (bytes === null) throw new ApiFailure("not_found", "No such image.");
      // The name is the hash of the content, so the file never changes.
      return c.body(new Uint8Array(bytes), 200, {
        "content-type": "image/webp",
        "cache-control": "public, max-age=31536000, immutable",
      });
    });
}
