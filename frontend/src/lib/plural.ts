// A count and its word: "1 new skill", "2 new skills" (the word with an "s").
export function plural(n: number, word: string): string {
  return `${String(n)} ${n === 1 ? word : `${word}s`}`;
}
