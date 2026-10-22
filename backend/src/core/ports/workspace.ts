/**
 * The workspace port (architecture.md §2, security.md §2.3). Types only: the local-git adapter
 * comes in M6. `resolve()` is the only way a workspace path becomes a storage location
 * (AGENTS.md §5 rule 7); every other method takes a path it returned.
 */
declare const resolvedPath: unique symbol;
/** A workspace path checked by `resolve()`. Only an adapter can make one. */
export type ResolvedPath = string & { readonly [resolvedPath]: true };

export interface Workspace {
  /** Refuses absolute paths, `..` escapes, symlinks out of the root and anything under `.git`. */
  resolve(path: string): ResolvedPath;
  read(path: ResolvedPath, input: { maxBytes: number }): Promise<Uint8Array>;
  write(path: ResolvedPath, content: Uint8Array): Promise<void>;
  list(dir: ResolvedPath, input: { maxEntries: number }): Promise<string[]>;
  commit(input: { message: string }): Promise<string>;
  changedSince(commit: string): Promise<string[]>;
}
