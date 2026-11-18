import { posix } from "node:path";
import ts from "typescript";
import {
  applyEdits,
  type BreakList,
  type Claim,
  coverageProblems,
  linkProblems,
  projectsOf,
  type TestCall,
  testCalls,
} from "./breaks.ts";

// The rules of a break list that need no test run (testing.md §5, "Break lists"). The runner
// (`pnpm check:breaks`) and the CI job (`pnpm check:breaks:static`) both use them.

const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/;

// The problems of the list before any test runs: the links of `claims`, and when the list runs
// whole (`complete`), a claim or an exemption for each test of the PR. `changed` holds the
// changed lines of each file since the base, `newFiles` the files that git does not track yet
// (each test of such a file counts), and `read` gives a file of the tested tree, or null.
export function prProblems(at: {
  list: BreakList;
  claims: readonly Claim[];
  complete: boolean;
  changed: ReadonlyMap<string, ReadonlySet<number>>;
  newFiles: readonly string[];
  read: (path: string) => string | null;
}): string[] {
  const tests = new Map<string, TestCall[]>();
  for (const file of [...at.changed.keys(), ...at.newFiles].filter((path) =>
    TEST_FILE.test(path),
  )) {
    const text = at.read(file);
    if (text === null) continue;
    const lines = at.changed.get(file);
    const calls = testCalls(text, file).filter(
      (call) =>
        lines === undefined || [...lines].some((line) => call.start <= line && line <= call.end),
    );
    tests.set(file, calls);
  }
  return [
    ...linkProblems({ claims: [...at.claims] }, at.read),
    ...(at.complete ? coverageProblems(at.list, tests) : []),
  ];
}

const TYPESCRIPT = /\.[cm]?tsx?$/;

interface Project {
  service: ts.LanguageService;
  // The text of a broken file, in place of the file on the disk, and the version of each file.
  texts: Map<string, string>;
  versions: Map<string, number>;
}

// One language service for a project of `projectsOf` (a folder or a config file), under `root`.
function project(root: string, name: string): Project {
  const file = name.endsWith(".json") ? name : posix.join(name, "tsconfig.json");
  // The runner allows a variable that a break leaves unused.
  const unused = { noUnusedLocals: false, noUnusedParameters: false };
  const config = ts.getParsedCommandLineOfConfigFile(posix.join(root, file), unused, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
      throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, " "));
    },
  });
  if (config === undefined) throw new Error(`cannot read ${file}`);
  const texts = new Map<string, string>();
  const versions = new Map<string, number>();
  const host: ts.LanguageServiceHost = {
    getScriptFileNames: () => config.fileNames,
    getScriptVersion: (path) => String(versions.get(path) ?? 0),
    getScriptSnapshot: (path) => {
      const text = texts.get(path) ?? ts.sys.readFile(path);
      return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text);
    },
    getCurrentDirectory: () => root,
    getCompilationSettings: () => config.options,
    getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
    fileExists: (path) => texts.has(path) || ts.sys.fileExists(path),
    readFile: (path) => texts.get(path) ?? ts.sys.readFile(path),
    readDirectory: (...args) => ts.sys.readDirectory(...args),
    directoryExists: (path) => ts.sys.directoryExists(path),
    getDirectories: (path) => ts.sys.getDirectories(path),
    // pnpm links each package. Without the real path, one package has two paths, and its types
    // do not match: false errors on code that the break keeps.
    realpath: (path) => (ts.sys.realpath === undefined ? path : ts.sys.realpath(path)),
    useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
  };
  return { service: ts.createLanguageService(host), texts, versions };
}

// The first TypeScript error of each break in the broken file, and each broken TypeScript file
// that no project compiles. Cheaper than the runner's `tsc` of each whole project: an error that
// a break causes in another file is not found here. A break whose edits do not apply is left to
// `linkProblems`.
export function compileProblems(at: {
  claims: readonly Claim[];
  root: string;
  read: (path: string) => string | null;
}): string[] {
  const projects = new Map<string, Project>();
  const problems: string[] = [];
  for (const step of at.claims.flatMap((claim) => claim.breaks)) {
    if (!TYPESCRIPT.test(step.file)) continue;
    const edited = applyEdits(at.read(step.file) ?? "", step.edits);
    if ("problem" in edited) continue;
    const path = posix.join(at.root, step.file);
    let compiled = false;
    let error: string | undefined;
    for (const name of projectsOf(step.file, at.read)) {
      const known = projects.get(name) ?? project(at.root, name);
      projects.set(name, known);
      if (known.service.getProgram()?.getSourceFile(path) === undefined) continue;
      compiled = true;
      const bump = () => known.versions.set(path, (known.versions.get(path) ?? 0) + 1);
      known.texts.set(path, edited.text);
      bump();
      const [first] = [
        ...known.service.getSyntacticDiagnostics(path),
        ...known.service.getSemanticDiagnostics(path),
      ];
      known.texts.delete(path);
      bump();
      if (first !== undefined && error === undefined) {
        const line = first.file?.getLineAndCharacterOfPosition(first.start ?? 0).line ?? 0;
        const text = ts.flattenDiagnosticMessageText(first.messageText, " ");
        error = `${step.file}:${String(line + 1)} TS${String(first.code)} ${text}`.slice(0, 300);
      }
    }
    if (!compiled) problems.push(`${step.id}: no TypeScript project compiles ${step.file}`);
    else if (error !== undefined) problems.push(`${step.id}: the break does not compile: ${error}`);
  }
  return problems;
}
