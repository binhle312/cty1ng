import yauzl from "yauzl";
import yazl from "yazl";
import type { ImportFolder } from "../../../core/skills/skill-import.service.ts";
import { ApiFailure } from "../errors.ts";

// Skill zips (security.md §2.4, M1 plan P3). Fixed security checks, not settings.
export const SKILL_ZIP = {
  // The file part of the upload; the whole request may add MULTIPART_OVERHEAD for headers.
  maxZipBytes: 5 * 1024 * 1024,
  multipartOverheadBytes: 64 * 1024,
  maxEntries: 200,
  maxTotalUncompressedBytes: 20 * 1024 * 1024,
  // No valid SKILL.md comes near this (M1 plan, decision 2); a bigger one is `invalid`, unread.
  maxSkillMdBytes: 1024 * 1024,
} as const;

// Reads a skill zip into folders. Only `<folder>/SKILL.md` is opened; every other file is
// listed as skipped. Zip slip and absolute paths fail the whole zip (yauzl `strictFileNames`),
// and yauzl stops an entry that is longer than its header says.
export function readSkillZip(zip: Uint8Array): Promise<ImportFolder[]> {
  return new Promise<ImportFolder[]>((resolve, reject) => {
    const folders = new Map<string, ImportFolder>();
    const folderOf = (name: string): ImportFolder => {
      const existing = folders.get(name);
      if (existing !== undefined) return existing;
      const created: ImportFolder = { folder: name, skillMd: "missing", skippedFiles: [] };
      folders.set(name, created);
      return created;
    };
    const fail = (failure: ApiFailure): void => {
      reject(failure);
    };

    yauzl.fromBuffer(
      Buffer.from(zip),
      { lazyEntries: true, strictFileNames: true, validateEntrySizes: true },
      (openError, archive) => {
        if (openError !== null) {
          fail(new ApiFailure("invalid_import", "The file is not a zip."));
          return;
        }
        let entries = 0;
        let total = 0;
        archive.on("error", (error: Error) => {
          archive.close();
          fail(new ApiFailure("invalid_import", zipErrorMessage(error)));
        });
        archive.on("end", () => {
          // Loose files at the top of the zip belong to no skill folder; they are dropped.
          resolve([...folders.values()].filter((found) => found.folder !== ""));
        });
        archive.on("entry", (entry: yauzl.Entry) => {
          entries += 1;
          if (entries > SKILL_ZIP.maxEntries) {
            archive.close();
            fail(
              new ApiFailure(
                "invalid_import",
                `The zip has more than ${String(SKILL_ZIP.maxEntries)} files.`,
              ),
            );
            return;
          }
          const name = entry.fileName;
          if (name.endsWith("/")) {
            archive.readEntry();
            return;
          }
          const [folder = "", ...rest] = name.split("/");
          const isSkillMd = rest.length === 1 && rest[0] === "SKILL.md";
          if (rest.length === 0) {
            // A file at the top of the zip belongs to no skill folder.
            folderOf("").skippedFiles.push(name);
            archive.readEntry();
            return;
          }
          if (!isSkillMd) {
            folderOf(folder).skippedFiles.push(rest.join("/"));
            archive.readEntry();
            return;
          }
          if (entry.uncompressedSize > SKILL_ZIP.maxSkillMdBytes) {
            folderOf(folder).skillMd = "too_large";
            archive.readEntry();
            return;
          }
          total += entry.uncompressedSize;
          if (total > SKILL_ZIP.maxTotalUncompressedBytes) {
            archive.close();
            fail(new ApiFailure("too_large", "The zip unpacks to more than 20 MB."));
            return;
          }
          archive.openReadStream(entry, (streamError, stream) => {
            if (streamError !== null) {
              archive.close();
              fail(new ApiFailure("invalid_import", "A file in the zip cannot be read."));
              return;
            }
            const chunks: Buffer[] = [];
            stream.on("data", (chunk: Buffer) => chunks.push(chunk));
            stream.on("error", () => {
              archive.close();
              fail(new ApiFailure("invalid_import", "A file in the zip is damaged."));
            });
            stream.on("end", () => {
              folderOf(folder).skillMd = new Uint8Array(Buffer.concat(chunks));
              archive.readEntry();
            });
          });
        });
        archive.readEntry();
      },
    );
  });
}

function zipErrorMessage(error: Error): string {
  if (/relative path|absolute path|invalid characters/i.test(error.message)) {
    return "The zip has a file path outside its folders. The app imports nothing from it.";
  }
  return "The zip is damaged.";
}

// Writes `<slug>/SKILL.md` files into one zip (export, UI-7.8).
export async function writeSkillZip(
  files: readonly { path: string; text: string }[],
): Promise<Uint8Array<ArrayBuffer>> {
  const zip = new yazl.ZipFile();
  for (const file of files) {
    zip.addBuffer(Buffer.from(file.text, "utf8"), file.path);
  }
  zip.end();
  const chunks: Buffer[] = [];
  for await (const chunk of zip.outputStream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return new Uint8Array(Buffer.concat(chunks));
}
