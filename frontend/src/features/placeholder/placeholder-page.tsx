// An empty page of the M0 shell: the page title and the slice that builds it (M0 brief,
// "empty pages"). Each slice replaces its page.
export function PlaceholderPage({ title, line }: { title: string; line: string }) {
  return (
    <div className="px-8 py-6">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-1 text-on-surface-muted">{line}</p>
    </div>
  );
}

export function emptyIn(slice: string): string {
  return `This page is empty. It comes in slice ${slice}.`;
}
