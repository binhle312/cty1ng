import { inflateRawSync } from "node:zlib";

// Reads the files of a zip that the app exported, from its central directory, so a test can
// check what is inside (M1 brief: "export contains v3"). Stored and deflated entries only.
export function readZip(zip: Buffer): Map<string, string> {
  const files = new Map<string, string>();
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0) throw new Error("not a zip: no end of central directory");
  const count = zip.readUInt16LE(end + 10);
  let at = zip.readUInt32LE(end + 16);
  for (let i = 0; i < count; i += 1) {
    const method = zip.readUInt16LE(at + 10);
    const compressedSize = zip.readUInt32LE(at + 20);
    const nameLength = zip.readUInt16LE(at + 28);
    const extraLength = zip.readUInt16LE(at + 30);
    const commentLength = zip.readUInt16LE(at + 32);
    const localOffset = zip.readUInt32LE(at + 42);
    const name = zip.toString("utf8", at + 46, at + 46 + nameLength);
    const dataStart =
      localOffset + 30 + zip.readUInt16LE(localOffset + 26) + zip.readUInt16LE(localOffset + 28);
    const data = zip.subarray(dataStart, dataStart + compressedSize);
    if (!name.endsWith("/")) {
      files.set(name, (method === 8 ? inflateRawSync(data) : data).toString("utf8"));
    }
    at += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}
