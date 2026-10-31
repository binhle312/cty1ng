import { typeIdToUuid, uuidToTypeId } from "../adapters/ids/typeid-ids.ts";
import { ConfigError, loadConfig } from "./config.ts";

// Small owner commands (architecture.md §4): `pnpm --filter backend cli <command>`.
const USAGE = `Usage:
  cli ids decode <typeid>          the UUID stored in the database (D36)
  cli ids decode <uuid> <prefix>   the TypeID shown everywhere else
  cli db migrate                   apply pending migrations (the same runner as at start)
  cli skills import <folder> [--apply]
                                   preview <folder>/<slug>/SKILL.md; --apply imports the good rows
  cli skills export <folder> [--slug <slug> ...]
                                   write the latest versions into a new or empty folder
  cli skills trash                 list the skills in Trash (until the Trash page, M5b)
  cli skills restore <slug>        restore a skill from Trash (until the Trash page, M5b)`;

async function run(args: readonly string[]): Promise<number> {
  const [group, command, ...rest] = args;
  if (group === "ids" && command === "decode" && rest.length >= 1 && rest.length <= 2) {
    const [value = "", prefix] = rest;
    try {
      process.stdout.write(
        `${prefix === undefined ? typeIdToUuid(value) : uuidToTypeId(prefix, value)}\n`,
      );
      return 0;
    } catch (error) {
      process.stderr.write(`${error instanceof Error ? error.message : "Not an id"}\n`);
      return 1;
    }
  }
  if (group === "db" && command === "migrate" && rest.length === 0) {
    try {
      // Loaded only here, so `ids decode` starts fast.
      const { openDatabase } = await import("./database.ts");
      const { writer, applied } = openDatabase(loadConfig(process.env));
      writer.close();
      process.stdout.write(`${applied} migration(s) applied\n`);
      return 0;
    } catch (error) {
      process.stderr.write(
        `Migration failed: ${error instanceof ConfigError || error instanceof Error ? error.message : "unknown error"}\n`,
      );
      return 1;
    }
  }
  if (group === "skills") {
    const code = await skillsCommand(command, rest);
    if (code !== null) return code;
  }
  process.stderr.write(`${USAGE}\n`);
  return 2;
}

type Commands = typeof import("./skill-commands.ts");
type Work = (
  commands: Commands,
  backend: Parameters<Commands["importSkills"]>[0],
  out: (line: string) => void,
) => Promise<number>;

// Null when the arguments match no command.
async function skillsCommand(
  command: string | undefined,
  rest: readonly string[],
): Promise<number | null> {
  const work = parseSkillsCommand(command, rest);
  if (work === null) return null;
  const out = (line: string) => process.stdout.write(`${line}\n`);
  // Loaded only here, so `ids decode` starts fast.
  const [{ compose }, { createLogger }, commands] = await Promise.all([
    import("./compose.ts"),
    import("../adapters/log/pino-logger.ts"),
    import("./skill-commands.ts"),
  ]);
  const config = loadConfig(process.env);
  const backend = compose(config, createLogger({ level: "error", secrets: config.secrets }));
  try {
    return await commands.reportDomainErrors(() => work(commands, backend, out), out);
  } finally {
    backend.close();
  }
}

function parseSkillsCommand(command: string | undefined, rest: readonly string[]): Work | null {
  if (command === "import") {
    const apply = rest.includes("--apply");
    const folders = rest.filter((arg) => arg !== "--apply");
    const [folder] = folders;
    if (folder === undefined || folders.length !== 1) return null;
    return (commands, backend, out) => commands.importSkills(backend, folder, apply, out);
  }
  if (command === "export") {
    const [folder, ...flags] = rest;
    if (folder === undefined || folder.startsWith("--")) return null;
    const slugs: string[] = [];
    for (let index = 0; index < flags.length; index += 2) {
      const slug = flags[index + 1];
      if (flags[index] !== "--slug" || slug === undefined) return null;
      slugs.push(slug);
    }
    return (commands, backend, out) => commands.exportSkills(backend, folder, slugs, out);
  }
  if (command === "trash" && rest.length === 0) {
    return (commands, backend, out) => commands.listTrash(backend, out);
  }
  const [slug] = rest;
  if (command === "restore" && slug !== undefined && rest.length === 1) {
    return (commands, backend, out) => commands.restoreSkill(backend, slug, out);
  }
  return null;
}

process.exitCode = await run(process.argv.slice(2));
