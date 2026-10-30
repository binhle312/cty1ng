// Prints a check's problems and sets the exit code. The scripts are CLI tools, so they write to
// the terminal directly; `no-console` is off for scripts/ in eslint.config.js.
export function report(
  name: string,
  problems: readonly string[],
  warnings: readonly string[] = [],
): void {
  for (const warning of warnings) console.warn(`warning: ${warning}`);
  if (problems.length === 0) {
    console.log(`${name}: ok`);
    return;
  }
  for (const problem of problems) console.error(problem);
  console.error(`${name}: ${problems.length} problem(s)`);
  process.exitCode = 1;
}
