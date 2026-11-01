import { expect, test } from "@playwright/test";
import { createClient } from "../../src/lib/api/generated/client/index.ts";
import { getAvatar, getAvatarLimits, uploadAvatar } from "../../src/lib/api/generated/sdk.gen.ts";

// An avatar upload through the generated client against the real app (M2 plan §5): the
// client's multipart serializer, its request and response validators, and the backend's
// form parser and re-encode work together. The page has no avatar screen yet (M2b), so the
// client runs in the test process, with the Origin header a browser would send.

// A 40 × 30 PNG of one colour. The frontend has no image library, so the bytes are fixed.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAACgAAAAeCAMAAABpA6zvAAAAA1BMVEUzZv+f8kW/AAAACXBIWXMAAAPoAAAD6AG1e1Jr" +
    "AAAAEklEQVQ4y2NgGAWjYBSMguEAAATOAAHHK9RWAAAAAElFTkSuQmCC",
  "base64",
);

test("the generated client uploads an avatar and reads back a 256 × 256 WebP", async ({
  page,
  baseURL,
}) => {
  const origin = baseURL ?? "";
  const client = createClient({ baseUrl: origin, headers: { origin } });

  const limits = await getAvatarLimits({ client, throwOnError: true });
  expect(limits.data.accepted_types).toContain("image/png");
  expect(PNG.length).toBeLessThanOrEqual(limits.data.max_bytes);

  const uploaded = await uploadAvatar({
    client,
    body: { file: new File([new Uint8Array(PNG)], "avatar.png", { type: "image/png" }) },
    throwOnError: true,
  });
  const id = uploaded.data.avatar_id;
  expect(id).toMatch(/^[0-9a-f]{64}$/);
  expect(uploaded.data.url).toBe(`/api/avatars/${id}.webp`);

  const image = await getAvatar({ client, path: { file: `${id}.webp` }, throwOnError: true });
  expect(image.response.headers.get("content-type")).toBe("image/webp");
  const bytes = new Uint8Array(await image.data.arrayBuffer());
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  expect([ascii(0, 4), ascii(8, 12)]).toEqual(["RIFF", "WEBP"]);

  // The browser decodes the stored file: the 40 × 30 input became a 256 × 256 square.
  await page.goto("/");
  const size = await page.evaluate(async (url) => {
    const img = new Image();
    img.src = url;
    await img.decode();
    return [img.naturalWidth, img.naturalHeight];
  }, uploaded.data.url);
  expect(size).toEqual([256, 256]);
});
