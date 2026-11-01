import sharp from "sharp";
import { ApiFailure } from "../errors.ts";

// Avatar images (security.md §2.4, M2 plan P2). Fixed security rules, not settings: three layers
// keep every other image format out, the pixel limit is read from the header before a decode,
// and the output is a fresh 256×256 WebP with no metadata.

export const AVATAR_IMAGE = {
  pixelLimit: 25_000_000,
  size: 256,
  multipartOverheadBytes: 64 * 1024,
} as const;

// Layer 1, once per process: only the PNG, JPEG and WebP buffer loaders can run. Every other
// libvips loader (SVG, GIF, TIFF, HEIF, PDF, …) is blocked before it reads a byte.
let loadersLocked = false;
export function lockImageLoaders(): void {
  if (loadersLocked) return;
  sharp.block({ operation: ["VipsForeignLoad"] });
  sharp.unblock({
    operation: [
      "VipsForeignLoadPngBuffer",
      "VipsForeignLoadJpegBuffer",
      "VipsForeignLoadWebpBuffer",
    ],
  });
  loadersLocked = true;
}

type ImageKind = "png" | "jpeg" | "webp";

// Layer 2: the magic bytes, before sharp sees the buffer.
function sniff(bytes: Uint8Array): ImageKind | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && png.every((byte, index) => bytes[index] === byte)) return "png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  return null;
}

function notAccepted(): ApiFailure {
  return new ApiFailure("validation_error", "Use a PNG, JPEG or WebP image.", "file");
}

// Decodes, checks and re-encodes one upload. Throws 422 for anything that is not an accepted
// image; the message never repeats what the file said about itself.
export async function encodeAvatar(input: Uint8Array): Promise<Uint8Array> {
  lockImageLoaders();
  const kind = sniff(input);
  if (kind === null) throw notAccepted();
  const image = sharp(input, {
    limitInputPixels: AVATAR_IMAGE.pixelLimit,
    failOn: "error",
    autoOrient: true,
    animated: false,
  });
  let output: Buffer;
  try {
    // Layer 3: the header agrees with the magic bytes (metadata reads the header only).
    const metadata = await image.metadata();
    if (metadata.format !== kind) throw notAccepted();
    if (metadata.width * metadata.height > AVATAR_IMAGE.pixelLimit) {
      throw new ApiFailure(
        "validation_error",
        "The image has too many pixels. Use one under 25 megapixels.",
        "file",
      );
    }
    output = await image
      .resize(AVATAR_IMAGE.size, AVATAR_IMAGE.size, { fit: "cover", position: "centre" })
      .webp({ quality: 82, effort: 4 })
      .toBuffer();
  } catch (error) {
    if (error instanceof ApiFailure) throw error;
    // sharp refuses a broken file or one over the pixel limit before it decodes.
    throw new ApiFailure(
      "validation_error",
      "The image could not be read. Try another file.",
      "file",
    );
  }
  return new Uint8Array(output);
}
