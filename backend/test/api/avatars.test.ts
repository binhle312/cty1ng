import { crc32, deflateSync } from "node:zlib";
import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { AvatarUpload } from "@cty1ng/shared/bots";
import { AVATAR_IMAGE } from "../../src/adapters/http/uploads/avatar-image.ts";
import { ORIGIN, testBackend } from "../helpers.ts";

// Avatar uploads (api.md §4, security.md §2.4): the accepted types, the size limits, the pixel
// limit, the re-encode, and the image URL.

let backend: ReturnType<typeof testBackend> | undefined;
afterEach(() => {
  backend?.close();
  backend = undefined;
});

function start(env: NodeJS.ProcessEnv = {}) {
  backend = testBackend(env);
  return backend;
}

const png = (width = 64, height = 48) =>
  sharp({ create: { width, height, channels: 3, background: "#3366ff" } })
    .png()
    .toBuffer();

// A real PNG of any size that stays small: 1-bit grey, every pixel black, so a 25 megapixel
// image is a few KB and passes AVATAR_MAX_BYTES. Built by hand, because only its pixel count
// must be over the limit, not its file size.
function blankPng(width: number, height: number): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 1; // bit depth 1; colour type 0 (grey), no interlace
  const rows = Buffer.alloc((Math.ceil(width / 8) + 1) * height); // filter 0, all black
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function upload(target: ReturnType<typeof testBackend>, bytes: Uint8Array, name = "a.png") {
  const form = new FormData();
  form.append("file", new File([new Uint8Array(bytes)], name, { type: "image/png" }));
  return target.request("/api/avatars", {
    method: "POST",
    headers: { origin: ORIGIN },
    body: form,
  });
}

async function codeOf(response: Response): Promise<string> {
  return z.object({ error: z.object({ code: z.string() }) }).parse(await response.json()).error
    .code;
}

describe("avatars", () => {
  it("GET /avatars/limits gives the size limit and the types", async () => {
    const response = await start({ AVATAR_MAX_BYTES: "5000" }).request("/api/avatars/limits");
    expect(await response.json()).toEqual({
      max_bytes: 5000,
      accepted_types: ["image/png", "image/jpeg", "image/webp"],
    });
  });

  it("re-encodes to a 256×256 WebP named by its SHA-256, served with long cache headers", async () => {
    const target = start();
    const response = await upload(target, await png());
    expect(response.status).toBe(200);
    const { avatar_id: id, url } = AvatarUpload.parse(await response.json());
    expect(id).toMatch(/^[0-9a-f]{64}$/);
    const image = await target.request(url);
    expect(image.status).toBe(200);
    expect(image.headers.get("content-type")).toBe("image/webp");
    expect(image.headers.get("cache-control")).toContain("immutable");
    const meta = await sharp(Buffer.from(await image.arrayBuffer())).metadata();
    expect(meta).toMatchObject({ format: "webp", width: 256, height: 256 });
    expect(meta.exif).toBeUndefined();
    // The same image again gives the same id.
    const again = AvatarUpload.parse(await (await upload(target, await png())).json());
    expect(again.avatar_id).toBe(id);
  });

  it.each([
    ["an SVG", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>')],
    ["text named .png", Buffer.from("hello, not an image")],
  ])("refuses %s with 422", async (_label, bytes) => {
    const response = await upload(start(), bytes);
    expect(response.status).toBe(422);
    expect(await codeOf(response)).toBe("validation_error");
  });

  it.each(["jpeg", "png", "webp"] as const)(
    "removes EXIF, ICC and XMP that a %s upload carries",
    async (format) => {
      const xmp =
        '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
        '<rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator>Secret Author</dc:creator>' +
        "</rdf:Description></rdf:RDF></x:xmpmeta>";
      const input = await sharp({
        create: { width: 64, height: 48, channels: 3, background: "#3366ff" },
      })
        .toFormat(format)
        .withExif({ IFD0: { Copyright: "Secret Author", Artist: "Secret Author" } })
        .withIccProfile("p3")
        .withXmp(xmp)
        .toBuffer();
      const before = await sharp(input).metadata();
      expect(before.exif?.toString("latin1")).toContain("Secret Author");
      expect(before.icc).toBeDefined();
      expect(before.xmpAsString).toContain("Secret Author");

      const target = start();
      const response = await upload(target, input, `a.${format}`);
      expect(response.status).toBe(200);
      const { url } = AvatarUpload.parse(await response.json());
      const output = Buffer.from(await (await target.request(url)).arrayBuffer());
      const after = await sharp(output).metadata();
      expect(after).toMatchObject({ format: "webp", width: 256, height: 256 });
      expect(after.exif).toBeUndefined();
      expect(after.icc).toBeUndefined();
      expect(after.xmp).toBeUndefined();
      expect(output.toString("latin1")).not.toContain("Secret Author");
    },
  );

  it.each([
    ["a text field", "note", (): string => "hello"],
    ["a second file part", "other", (image: Buffer) => new File([new Uint8Array(image)], "b.png")],
    ["two files named file", "file", (image: Buffer) => new File([new Uint8Array(image)], "b.png")],
  ])("refuses an upload with %s beside the file with 422", async (_label, name, part) => {
    const image = await png();
    const form = new FormData();
    form.append("file", new File([new Uint8Array(image)], "a.png", { type: "image/png" }));
    form.append(name, part(image));
    const response = await start().request("/api/avatars", {
      method: "POST",
      headers: { origin: ORIGIN },
      body: form,
    });
    expect(response.status).toBe(422);
    expect(await codeOf(response)).toBe("validation_error");
  });

  it("refuses a GIF and a TIFF, which sharp could read, with 422", async () => {
    const target = start();
    const gif = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#000" } })
      .gif()
      .toBuffer();
    const tiff = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#000" } })
      .tiff()
      .toBuffer();
    expect((await upload(target, gif)).status).toBe(422);
    expect((await upload(target, tiff)).status).toBe(422);
  });

  // Review of PR #57: the test below alone cannot prove the limit, because its broken file fails
  // with the limit off too. This one is a real image that decodes with the limit off.
  it("refuses a real image one row over 25 million pixels, and passes one at the limit", async () => {
    const over = blankPng(5_001, 5_000);
    const atLimit = blankPng(5_000, 5_000);
    expect(5_001 * 5_000).toBeGreaterThan(AVATAR_IMAGE.pixelLimit);
    expect(5_000 * 5_000).toBe(AVATAR_IMAGE.pixelLimit);
    // The file is valid: with no pixel limit, sharp decodes it.
    const decoded = await sharp(over, { limitInputPixels: false }).resize(8, 8).png().toBuffer();
    expect((await sharp(decoded).metadata()).width).toBe(8);
    const target = start();
    const refused = await upload(target, over);
    expect(refused.status).toBe(422);
    expect(await refused.json()).toMatchObject({
      error: { code: "validation_error", field: "file" },
    });
    expect((await upload(target, atLimit)).status).toBe(200);
  });

  it("refuses an image whose header claims over 25 million pixels, before it decodes", async () => {
    const big = await png(1, 1);
    // Rewrite the IHDR size to 100000 × 100000; the header check refuses it.
    const view = new DataView(big.buffer, big.byteOffset, big.byteLength);
    view.setUint32(16, 100_000);
    view.setUint32(20, 100_000);
    const response = await upload(start(), big);
    expect(response.status).toBe(422);
    expect(AVATAR_IMAGE.pixelLimit).toBe(25_000_000);
  });

  it("passes a file of exactly AVATAR_MAX_BYTES, and refuses one byte more with 413", async () => {
    const image = await png();
    const target = start({ AVATAR_MAX_BYTES: String(image.length) });
    expect((await upload(target, image)).status).toBe(200);
    const padded = Buffer.concat([image, Buffer.from([0])]);
    const response = await upload(target, padded);
    expect(response.status).toBe(413);
    expect(await codeOf(response)).toBe("too_large");
  });

  it("refuses a request over AVATAR_MAX_BYTES + 64 KB with 413", async () => {
    const target = start({ AVATAR_MAX_BYTES: "1000" });
    const response = await upload(
      target,
      new Uint8Array(1000 + AVATAR_IMAGE.multipartOverheadBytes),
    );
    expect(response.status).toBe(413);
  });

  it("GET of an unknown image gives 404, and of a bad name 422", async () => {
    const target = start();
    expect((await target.request(`/api/avatars/${"a".repeat(64)}.webp`)).status).toBe(404);
    expect((await target.request("/api/avatars/..%2Fapp.db")).status).toBe(422);
  });
});
