// The owner-quote check (owner, 2026-11-19, order 109): a rule counts only when each of its
// "Owner said:" quotes is in the owner's own words. The record of those words is the `.md` files of
// `.agents/chief/memories/short-term/owner/`, which git ignores, so only a local run can read it:
// `pnpm check:memory --local` and `pnpm merge:check`. CI cannot. Pure: the caller reads the files.
//
// A match is a substring match after each run of white space becomes one space. Case and
// punctuation must be the same. Not checked: the date of a quote, and what it means.

export const OWNER_RECORD = ".agents/chief/memories/short-term/owner";

const fold = (text: string): string => text.replace(/\s+/g, " ").trim();
const countWords = (text: string): number => fold(text).split(" ").filter(Boolean).length;

// Each quote in double quotes on an "Owner said:" line, in order.
export function ownerQuotes(text: string): string[] {
  return text
    .split("\n")
    .filter((line) => line.startsWith("Owner said:"))
    .flatMap((line) => [...line.matchAll(/"([^"]*)"/g)].map((match) => match[1] ?? ""));
}

// `record` holds the text of each record file; undefined or only white space means no record.
// With no record, `noRecord` is true and no quote is checked: the caller decides if that fails.
export function checkOwnerQuotes(input: {
  rules: readonly { path: string; text: string }[];
  record: readonly string[] | undefined;
  minWords: number;
}): { problems: string[]; noRecord: boolean } {
  const record = fold((input.record ?? []).join(" "));
  if (record === "") return { problems: [], noRecord: true };
  const problems: string[] = [];
  for (const { path, text } of input.rules) {
    const quotes = ownerQuotes(text);
    if (quotes.length === 0) {
      problems.push(
        `${path}: no "Owner said:" quote, so the rule has no words of the owner to compare`,
      );
    }
    for (const quote of quotes) {
      const words = countWords(quote);
      if (words < input.minWords) {
        problems.push(
          `${path}: the quote "${quote}" has ${words} words; a quote that the check compares needs ${input.minWords} or more (setting quote_min_words)`,
        );
      } else if (!record.includes(fold(quote))) {
        problems.push(
          `${path}: the quote "${quote}" is not in the owner record; a rule counts only with the owner's own words (order 109)`,
        );
      }
    }
  }
  return { problems, noRecord: false };
}
